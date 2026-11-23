# Partial dues payments + Square — setup

Brothers can pay dues in full or in parts, by card through **Stripe** or through **Square**
(Cash App Pay, Apple Pay, Google Pay or card). Officers can record cash, check, CashApp and
PayPal payments. Once a brother's payments add up to his dues, he shows as **Paid**
everywhere (Members tab, Dues tab, Command Center), exactly as before.

Steps 1–3 are all that's needed to go live. Step 5 (Stripe partial payments) can come later.

## 1. Run the database update
Supabase → SQL Editor → paste `supabase/migrations/20261122_partial_dues.sql` → Run.
It's safe to run again.

Before running, check that `dues_payments` accepts a row with just `member_id` and `year`
(Table Editor → dues_payments → any other column marked "not null" with no default?).
If there is one, give it a default or tell the webmaster first.

## 2. Set up Square
Use the same Square account as the ticketing app. Do this in **Sandbox** first, then repeat
with **Production** values when it works.

1. **developer.squareup.com** → sign in with the chapter's Square account → open the app the
   ticketing site uses (or **+ Create an application**).
2. **Credentials** → copy the **Access token**. **Locations** → copy the **Location ID**.
3. Supabase → **Edge Functions → Secrets**, add:
   - `SQUARE_ACCESS_TOKEN` = the access token
   - `SQUARE_LOCATION_ID` = the location ID
   - `SQUARE_ENVIRONMENT` = `sandbox` (change to `production` when going live)
   - `APP_URL` = `https://app.etaomicron.org`
4. Deploy the two functions (Dashboard → Edge Functions → Deploy a new function → Via Editor,
   paste the file, deploy — or with the CLI as below):
   - `square-create-payment-link` — leave **Verify JWT ON**.
   - `square-webhook` — turn **Verify JWT OFF** (Square signs its calls instead).
   ```bash
   supabase functions deploy square-create-payment-link
   supabase functions deploy square-webhook --no-verify-jwt
   ```
5. Square Developer dashboard → **Webhooks → Subscriptions → Add subscription**:
   - URL: `https://YOUR-PROJECT.supabase.co/functions/v1/square-webhook`
   - Events: `payment.created` and `payment.updated`
   - Save, then copy its **Signature key**.
6. Back in Supabase secrets, add:
   - `SQUARE_WEBHOOK_SIGNATURE_KEY` = the signature key
   - `SQUARE_WEBHOOK_URL` = the webhook URL, **exactly** as entered in step 5

Square sends this webhook for every payment on the account, including ticket sales and swipes
at events. The webhook only credits payments made from a dues link the app created, and
ignores the rest, so the ticketing app isn't affected.

## 3. Test, then merge
In Square Sandbox (test card `4111 1111 1111 1111`, any future date, any CVV):
1. As a brother, tap **Pay part of it**, enter $25, **Pay with Square**. Back in the app he
   should show "Paid $25.00 of $… so far" and **Partial** in the officer list (allow a few seconds).
2. As an officer, **Record payment** for him in cash for part of the rest.
3. As the brother, pay the rest with Square. He should flip to **Paid**.
4. A brother who's paid nothing should still see **Pay … by card** (Stripe) for his full dues,
   and it should work as before.

Then merge; Vercel deploys. Switch the Square secrets to Production values and re-add the
webhook subscription under Production.

## 4. Until Stripe is updated
`STRIPE_PARTIAL_READY` in `src/dues.js` is `false`. While it is, the card (Stripe) button only
appears for a brother's first, full payment — the current Stripe function always charges full
dues. Partial and remaining-balance payments go through Square. Nothing is double-charged.

## 5. Later: partial payments through Stripe too
Update the two Stripe functions in Supabase (they aren't in this repo), then set
`STRIPE_PARTIAL_READY = true`.

### `create-checkout-session` — the `type: "dues"` branch
The app sends an optional `amount` (dollars). No `amount` = pay the whole balance.

```ts
const MIN_PARTIAL = 25; // keep in step with src/dues.js

// `member` = the signed-in brother's members row, `admin` = service-role client (both already exist)
const { data: bal } = await admin
  .from("dues_balances")
  .select("year, balance, paid_in_full")
  .eq("member_id", member.id)
  .single();

if (!bal || bal.paid_in_full || Number(bal.balance) <= 0) {
  return json({ error: "Your dues are already paid for this year." }, 400);
}
const balance = Number(bal.balance);
const amount = body.amount == null ? balance : Math.round(Number(body.amount) * 100) / 100;
const min = Math.min(MIN_PARTIAL, balance);
if (!(amount >= min && amount <= balance + 0.005)) {
  return json({ error: `Enter an amount between $${min.toFixed(2)} and $${balance.toFixed(2)}.` }, 400);
}
const isPartial = amount < balance - 0.005;

// In the Stripe Checkout session:
//   unit_amount: Math.round(amount * 100)
//   product name: isPartial ? `${bal.year} Dues (partial payment)` : `${bal.year} Dues`
//   metadata: { type: "dues", member_id: String(member.id), year: String(bal.year) }
```

### Stripe webhook — the `type === "dues"` branch
Replace the direct insert into `dues_payments` with an installment. The database marks
him paid in full by itself once his installments cover his dues.

```ts
const { error } = await admin.from("dues_installments").upsert(
  {
    member_id: session.metadata.member_id,
    year: Number(session.metadata.year),
    amount: session.amount_total / 100,     // what Stripe actually charged
    method: "stripe",
    stripe_session_id: session.id,
  },
  { onConflict: "stripe_session_id", ignoreDuplicates: true } // Stripe retries are harmless
);
if (error) throw error; // return 500 so Stripe retries
```

Keep anything else the webhook does for dues (audit log, receipt email) as it is.

## Good to know
- A brother who opens two payment links and pays both can end up overpaid. His dues show as
  paid; refund the extra from the Square or Stripe dashboard.
- Square and Stripe each charge their own processing fees; the chapter absorbs them on in-app
  payments, as with Stripe today.
