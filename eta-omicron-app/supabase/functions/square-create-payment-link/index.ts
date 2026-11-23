// Makes a Square payment link for a brother's dues: his whole balance, or part of it.
// The app calls this with the brother's Supabase session, so deploy with JWT verification ON.
//
// Secrets (Edge Functions → Secrets):
//   SQUARE_ACCESS_TOKEN   from the Square Developer dashboard (Credentials)
//   SQUARE_LOCATION_ID    from the Square Developer dashboard (Locations)
//   SQUARE_ENVIRONMENT    "sandbox" while testing, "production" when live
//   APP_URL               https://app.etaomicron.org
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Body: { type: "dues", amount?: number }   no amount = pay the whole balance
// Answer: { url } to send the brother to, or { error }.
import { createClient } from "npm:@supabase/supabase-js@2";

export const MIN_PARTIAL = 25; // keep in step with src/dues.js

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Pure: checks the amount a brother asked to pay against what he owes. Kept separate so it can be tested.
export function checkDuesAmount(requested, balance, minPartial = MIN_PARTIAL) {
  const owed = Math.round(Number(balance) * 100) / 100;
  if (!(owed > 0)) return { error: "Your dues are already paid for this year." };
  if (requested == null || requested === "") return { amount: owed, partial: false };
  const amount = Math.round(Number(requested) * 100) / 100;
  const min = Math.min(minPartial, owed);
  if (!Number.isFinite(amount) || amount < min || amount > owed + 0.005) {
    return { error: `Enter an amount between $${min.toFixed(2)} and $${owed.toFixed(2)}.` };
  }
  return { amount: Math.min(amount, owed), partial: amount < owed - 0.005 };
}

async function handle(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const env = (k) => Deno.env.get(k);
  for (const k of ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"]) {
    if (!env(k)) return json({ error: `Square isn't set up yet (missing ${k}).` }, 500);
  }
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

  // Who is paying?
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (authError || !user) return json({ error: "Please sign in again." }, 401);

  const { data: member } = await admin.from("members").select("*").eq("auth_user_id", user.id).maybeSingle();
  if (!member) return json({ error: "No roster entry found for your login." }, 403);

  let body = {};
  try { body = await req.json(); } catch { /* empty body */ }
  if (body.type !== "dues") return json({ error: "Only dues can be paid with Square right now." }, 400);

  // How much does he still owe this year?
  const { data: bal, error: balError } = await admin
    .from("dues_balances")
    .select("year, balance, paid_in_full")
    .eq("member_id", member.id)
    .single();
  if (balError || !bal) return json({ error: "Couldn't look up your balance. Try again in a minute." }, 500);
  if (bal.paid_in_full) return json({ error: "Your dues are already paid for this year." }, 400);

  const check = checkDuesAmount(body.amount, bal.balance);
  if (check.error) return json({ error: check.error }, 400);

  const base = env("SQUARE_ENVIRONMENT") === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
  const appUrl = (env("APP_URL") ?? "https://app.etaomicron.org").replace(/\/$/, "");

  const squareRes = await fetch(`${base}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("SQUARE_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      quick_pay: {
        name: check.partial ? `${bal.year} Dues (partial payment)` : `${bal.year} Dues`,
        price_money: { amount: Math.round(check.amount * 100), currency: "USD" },
        location_id: env("SQUARE_LOCATION_ID"),
      },
      checkout_options: { redirect_url: `${appUrl}/?paid=1` },
      ...(member.email ? { pre_populated_data: { buyer_email: member.email } } : {}),
      payment_note: `Eta Omicron ${bal.year} dues · ${member.name ?? "member"}`,
    }),
  });
  const squareBody = await squareRes.json().catch(() => ({}));
  const link = squareBody.payment_link;
  if (!squareRes.ok || !link?.url || !link?.order_id) {
    console.error("Square payment link failed:", squareRes.status, JSON.stringify(squareBody.errors ?? squareBody));
    return json({ error: "Square couldn't start the payment. Try again, or use card." }, 502);
  }

  // Remember who this link is for, so the webhook can credit him. No record, no link.
  const { error: saveError } = await admin.from("square_checkouts").insert({
    order_id: link.order_id,
    payment_link_id: link.id,
    member_id: member.id,
    kind: "dues",
    year: bal.year,
    amount: check.amount,
  });
  if (saveError) {
    console.error("Saving square_checkouts failed:", saveError.message);
    return json({ error: "Couldn't start the payment. Try again in a minute." }, 500);
  }

  return json({ url: link.url });
}

if (import.meta.main) Deno.serve(handle);
