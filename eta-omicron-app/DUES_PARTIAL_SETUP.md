# Partial dues payments — setup

Brothers can now pay dues in full or in parts, and officers can record cash, check,
CashApp and PayPal payments. Once a brother's payments add up to his dues, he shows as
**Paid** everywhere (Members tab, Dues tab, Command Center), exactly as before.

Deploy in this order. **Don't merge the app changes before step 2 is live**: until the
checkout function knows about partial amounts, a brother who has already paid part would
be charged his full dues again.

## 1. Run the database update
Supabase → SQL Editor → paste `supabase/migrations/20261122_partial_dues.sql` → Run.
It's safe to run again.

Before running, check that `dues_payments` accepts a row with just `member_id` and `year`
(Table Editor → dues_payments → any other column marked "not null" with no default?).
If there is one, give it a default or tell the webmaster first.

## 2. Update the two Stripe functions
These live in Supabase (Edge Functions), not in this repo.

### `create-checkout-session` — the `type: "dues"` branch
The app now sends an optional `amount` (dollars). No `amount` = pay the whole balance.

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

## 3. Test with Stripe test mode
1. Sign in as a brother, tap **Pay part of it**, pay $25 with card `4242 4242 4242 4242`.
   He should show "Paid $25.00 of $428.00 so far" and **Partial** in the officer list.
2. As an officer, **Record payment** for him in cash for part of the rest.
3. As the brother, **Pay remaining**. He should flip to **Paid**.
4. A brother who's paid nothing should still be charged his full dues with **Pay in full**.

## 4. Merge and deploy the app
Vercel deploys on merge.
