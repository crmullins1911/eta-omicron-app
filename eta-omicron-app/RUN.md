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
