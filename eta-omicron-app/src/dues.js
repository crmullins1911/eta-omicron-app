// Eta Omicron annual dues schedule. Change amounts here only.
// Each brother's members.dues_amount holds his category's annual amount (what Stripe charges);
// the category is recognised from that amount. CashApp/PayPal adds the processing fee.
export const DUES_SCHEDULE = [
  { code: "GM", label: "General Member", annual: 428.0, cashApp: 440.84 },
  { code: "GSLM", label: "Georgia State Life Member", annual: 412.5, cashApp: 424.88 },
  { code: "7DLM", label: "Seventh District Life Member", annual: 409.0, cashApp: 421.27 },
  { code: "LM", label: "International Life Member", annual: 303.0, cashApp: 312.09 },
  { code: "GSLM + 7DLM", label: "Georgia State + Seventh District Life Member", annual: 393.5, cashApp: 405.31 },
  { code: "GSLM + LM", label: "Georgia State + International Life Member", annual: 287.5, cashApp: 296.13 },
  { code: "7DLM + LM", label: "Seventh District + International Life Member", annual: 284.0, cashApp: 292.52 },
  { code: "LM + 7DLM + GSLM", label: "International + Seventh District + Georgia State Life Member", annual: 268.5, cashApp: 276.56 },
];

export const DEFAULT_DUES = 428.0; // General Member

export const duesCategoryFor = (amount) =>
  DUES_SCHEDULE.find((c) => Math.abs(c.annual - Number(amount)) < 0.005) ?? null;

export const money = (n) => `$${Number(n).toFixed(2)}`;

// Smallest partial payment a brother can make through Stripe (unless his balance is smaller).
// Keep in step with MIN_PARTIAL in the create-checkout-session function.
export const MIN_PARTIAL = 25;

// Ways an officer can record a payment made outside the app.
export const OFFLINE_METHODS = [
  { code: "cash", label: "Cash" },
  { code: "check", label: "Check" },
  { code: "cashapp", label: "CashApp" },
  { code: "paypal", label: "PayPal" },
];

export const METHOD_LABELS = { stripe: "Card (Stripe)", square: "Square", cash: "Cash", check: "Check", cashapp: "CashApp", paypal: "PayPal" };

// Stripe charges a brother's full dues until the create-checkout-session function in Supabase is
// updated for partial amounts (see DUES_PARTIAL_SETUP.md). Until then, partial and remaining-balance
// payments go through Square only. Flip to true once the Stripe functions are updated.
export const STRIPE_PARTIAL_READY = false;

// Round to cents, so 0.1 + 0.2 sums don't leave a brother owing $0.0000001.
export const cents = (n) => Math.round(Number(n) * 100) / 100;
