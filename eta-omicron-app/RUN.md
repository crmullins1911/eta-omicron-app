# Running the real app

This is a small Vite + React project, separate from the `supabase/` folder
you already have — put this `eta-omicron-app` folder anywhere on your Mac
(they don't need to be nested inside each other).

## 1. Install dependencies
```bash
cd eta-omicron-app
npm install
```

## 2. Add your Supabase credentials
```bash
cp .env.example .env
```
Open `.env` and fill in:
- `VITE_SUPABASE_URL` — Supabase Dashboard → Settings → API → "Project URL"
- `VITE_SUPABASE_ANON_KEY` — same page → "anon public" key

(These two are safe to use in frontend code — they're the public keys, not
the service role key, which never goes in this app.)

## 3. Run it
```bash
npm run dev
```
It'll print a local URL (usually `http://localhost:5173`) — open that in
your browser.

## 4. Sign in
Use the email of the officer row you seeded in `schema.sql`. You'll get a
magic-link email from Supabase — click it, and it'll bring you back to the
app signed in.

## 5. Try the flow
- As the officer, add a second member with an email you can also access.
- Sign in as that member (different browser or incognito window) and try
  "Pay Dues" — it should send you to a real Stripe Checkout page.
- Complete a test payment with card `4242 4242 4242 4242`, any future
  expiry, any CVC.
- Check back in the app (or the Supabase table editor) — `dues_paid`
  should flip to true within a couple seconds via the webhook.

## Troubleshooting
- **Nothing loads / blank screen** — open your browser's dev console
  (Cmd+Option+I) and check for errors; almost always a missing/wrong
  value in `.env`.
- **"No roster entry found"** after signing in — the email you signed in
  with doesn't match a row in the `members` table exactly. Check for
  typos or case differences.
- **Pay Dues does nothing** — check the Network tab in dev tools for the
  call to `create-checkout-session`; if it 401s, your Supabase session
  may have expired — sign out and back in.

## Command Center stats

`supabase/functions/command-center-stats` gives Neil's Command Center the chapter's numbers
(members, dues paid this year, upcoming events, posts in the last 30 days, and the roster's growth).
It returns counts only: no names, emails or messages. It answers only when sent the shared
`STATS_TOKEN` (the same value as in the Command Center's `.env`).

**Deploy it from the Supabase dashboard (no CLI needed)**
1. **Edge Functions → Deploy a new function → Via Editor.** Name it `command-center-stats`,
   replace the sample code with the contents of `supabase/functions/command-center-stats/index.ts`,
   and deploy.
2. Open the function's **Details** (or settings) and turn **Verify JWT / Enforce JWT verification** off.
   The function checks its own token instead; with JWT on, the Command Center gets a 401.
3. **Edge Functions → Secrets** (or Project Settings → Edge Functions): add `STATS_TOKEN` with the
   same value as the Command Center's.

**Or with the Supabase CLI**, from the folder that holds your `supabase/` project:
```bash
supabase secrets set STATS_TOKEN=the-shared-value
supabase functions deploy command-center-stats --no-verify-jwt
```

**Then in the Command Center**, add this to the Chapter app line in `data/projects.json`
(your project URL is `VITE_SUPABASE_URL`):
```json
"stats": "https://YOUR-PROJECT.supabase.co/functions/v1/command-center-stats"
```
