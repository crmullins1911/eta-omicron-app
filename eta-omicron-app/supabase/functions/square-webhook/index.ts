// Square webhook: credits a brother's dues when his Square payment completes.
// Square calls this directly, so deploy with JWT verification OFF. It checks Square's signature instead.
//
// Secrets (Edge Functions → Secrets):
//   SQUARE_WEBHOOK_SIGNATURE_KEY  shown on the webhook subscription in the Square Developer dashboard
//   SQUARE_WEBHOOK_URL            this function's URL, exactly as entered in that subscription
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Square sends this webhook for every payment on the account: ticket sales, swipes at events, and
// so on. Only payments whose order is in square_checkouts (made by square-create-payment-link) count
// as dues; everything else is acknowledged and ignored.
import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Square signs: base64( HMAC-SHA256( signature key, notification URL + raw body ) )
export async function squareSignatureValid(rawBody, signature, signatureKey, notificationUrl) {
  if (!signature || !signatureKey || !notificationUrl) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(signatureKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(notificationUrl + rawBody)));
  let bin = "";
  for (const byte of mac) bin += String.fromCharCode(byte);
  return safeEqual(btoa(bin), signature);
}

// Pure: the completed payment in a webhook event, or null if there's nothing to record.
export function completedPayment(event) {
  if (event?.type !== "payment.updated" && event?.type !== "payment.created") return null;
  const p = event?.data?.object?.payment;
  if (!p || p.status !== "COMPLETED" || !p.order_id || !p.id) return null;
  const cents = Number(p.amount_money?.amount);
  if (!(cents > 0)) return null;
  return { paymentId: p.id, orderId: p.order_id, amount: cents / 100 };
}

const ok = () => new Response("ok", { status: 200 });

async function handle(req) {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const env = (k) => Deno.env.get(k);

  const raw = await req.text();
  const valid = await squareSignatureValid(
    raw,
    req.headers.get("x-square-hmacsha256-signature"),
    env("SQUARE_WEBHOOK_SIGNATURE_KEY"),
    env("SQUARE_WEBHOOK_URL"),
  );
  if (!valid) return new Response("bad signature", { status: 401 });

  let event;
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const payment = completedPayment(event);
  if (!payment) return ok();

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

  const { data: checkout, error: lookupError } = await admin
    .from("square_checkouts")
    .select("order_id, member_id, year, kind")
    .eq("order_id", payment.orderId)
    .maybeSingle();
  if (lookupError) return new Response("lookup failed", { status: 500 }); // Square retries
  if (!checkout || checkout.kind !== "dues") return ok(); // not a dues payment

  const { error: insertError } = await admin.from("dues_installments").upsert(
    {
      member_id: checkout.member_id,
      year: checkout.year,
      amount: payment.amount, // what Square actually charged
      method: "square",
      square_payment_id: payment.paymentId,
    },
    { onConflict: "square_payment_id", ignoreDuplicates: true }, // Square sends updates more than once
  );
  if (insertError) {
    console.error("Recording Square dues payment failed:", insertError.message);
    return new Response("insert failed", { status: 500 }); // Square retries
  }

  await admin.from("square_checkouts")
    .update({ completed_at: new Date().toISOString() })
    .eq("order_id", payment.orderId)
    .is("completed_at", null);

  return ok();
}

if (import.meta.main) Deno.serve(handle);
