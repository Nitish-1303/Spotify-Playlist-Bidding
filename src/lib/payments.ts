import { PAYPAL_ME_URL, UPI_ID, UPI_NAME, USD_TO_INR } from "@/lib/site";

export type PaymentMethod = "paypal" | "upi";

export function paypalCheckoutUrl(amountUsd: number) {
  const dollars = Math.max(1, Math.round(amountUsd));
  return `${PAYPAL_ME_URL}/${dollars}`;
}

/** Convert board USD bid to INR for personal UPI intents. */
export function bidToInr(amountUsd: number) {
  const dollars = Math.max(1, Math.round(amountUsd));
  return Math.max(1, Math.round(dollars * USD_TO_INR));
}

export function formatInr(amountInr: number) {
  return `₹${amountInr.toLocaleString("en-IN")}`;
}

export function upiCheckoutUrl(amountUsd: number, note?: string) {
  const am = bidToInr(amountUsd).toFixed(2);
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_NAME,
    am,
    cu: "INR",
    tn: note || `PlaylistBid bid $${Math.round(amountUsd)}`,
  });
  return `upi://pay?${params.toString()}`;
}

export function paymentCheckoutUrl(method: PaymentMethod, amountUsd: number) {
  return method === "upi"
    ? upiCheckoutUrl(amountUsd)
    : paypalCheckoutUrl(amountUsd);
}
