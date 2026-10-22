// Command Center stats for the chapter app: counts only, never names, emails or messages.
// Deploy with JWT verification OFF and a STATS_TOKEN secret (see RUN.md, "Command Center stats").
// Callers must send:  Authorization: Bearer <STATS_TOKEN>
import { createClient } from "npm:@supabase/supabase-js@2";

const TZ = "America/New_York";
const etDay = (ts) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));

// Pure: turns rows into the Command Center's stats answer. Kept separate so it can be tested on its own.
export function buildStats({ members = [], duesPaid = [], events = [], posts = [] }, now = Date.now()) {
  const linkKey = ["user_id", "auth_user_id", "auth_id"].find((k) => members.some((m) => k in m));
  const metrics = {
    members: members.length,
    dues_paid: new Set(duesPaid.map((d) => d.member_id)).size,
    upcoming_events: events.filter((e) => e.event_date && String(e.event_date).slice(0, 10) >= etDay(now)).length,
    posts_30d: posts.filter((p) => p.created_at && Date.parse(p.created_at) >= now - 30 * 864e5).length,
  };
  const labels = {
    members: "Members",
    dues_paid: "Dues paid this year",
    upcoming_events: "Upcoming events",
    posts_30d: "Posts, last 30 days",
  };
  if (linkKey) {
    metrics.signed_up = members.filter((m) => m[linkKey] != null).length;
    labels.signed_up = "Signed up in the app";
  }

  // Roster size by the day each member was added, when the table records it.
  const history = [];
  const dated = members.map((m) => m.created_at).filter(Boolean).map((t) => etDay(t)).sort();
  if (dated.length === members.length) {
    let total = 0;
    for (let i = 0; i < dated.length; i++) {
      total += 1;
      if (i === dated.length - 1 || dated[i + 1] !== dated[i]) history.push({ day: dated[i], metrics: { members: total } });
    }
  }

  return { ok: true, app: "Chapter app", primary: "members", labels, metrics, history, time: new Date(now).toISOString() };
}

async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const ua = new Uint8Array(x), ub = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve(async (req) => {
    const TOKEN = Deno.env.get("STATS_TOKEN") || "";
    if (!TOKEN) return json(404, { error: "Stats are off. Set the STATS_TOKEN secret to turn them on." });
    if (req.method !== "GET") return json(405, { error: "Use GET." });
    const sent = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!(await sameSecret(sent, TOKEN))) return json(401, { error: "Wrong stats token." });

    const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" }).format(new Date()));
    const since = new Date(Date.now() - 31 * 864e5).toISOString();
    const [m, d, e, p] = await Promise.all([
      db.from("members").select("*"),
      db.from("dues_payments").select("member_id").eq("year", year),
      db.from("events").select("event_date"),
      db.from("posts").select("created_at").gte("created_at", since),
    ]);
    if (m.error) return json(500, { error: `Couldn't read members: ${m.error.message}` });
    // Only counts and dates leave this function; names, emails and other fields are dropped here.
    const members = (m.data || []).map((r) => ({
      created_at: r.created_at ?? null,
      user_id: r.user_id ?? r.auth_user_id ?? r.auth_id ?? null,
    }));
    if (!(m.data || []).some((r) => "user_id" in r || "auth_user_id" in r || "auth_id" in r)) members.forEach((r) => delete r.user_id);
    return json(200, buildStats({ members, duesPaid: d.data || [], events: e.data || [], posts: p.data || [] }));
  });
}
