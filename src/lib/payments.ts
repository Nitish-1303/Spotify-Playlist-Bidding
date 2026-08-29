/**
 * Checkout lives behind our own API route: the browser asks for a session, the
 * server talks to Dodo Payments with the secret key and hands back a hosted
 * checkout URL. The amount is never taken from the client's word alone — the
 * route re-derives it from the bid it was sent and rejects anything under $1.
 */

export type CheckoutRequest = {
  trackId: string;
  bid: number;
  title: string;
  artist: string;
  thumbnailUrl: string;
  genre: string;
  /** The track position being bought, carried into Dodo's metadata. */
  targetRank: number;
};

export type CheckoutSession = {
  checkoutUrl: string;
  sessionId?: string;
};

/** Thrown when Dodo has not been given keys yet, so nothing can be charged. */
export class CheckoutNotConfiguredError extends Error {}

/**
 * Ask the server for a Dodo checkout session. Resolves with the URL to send the
 * payer to, or throws with a message fit to show on the paddle.
 */
export async function createCheckoutSession(
  input: CheckoutRequest,
): Promise<CheckoutSession> {
  const res = await fetch("/api/bid/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await res.json()) as {
    checkout_url?: string;
    session_id?: string;
    error?: string;
    unconfigured?: boolean;
    message?: string;
  };

  if (data.unconfigured) {
    throw new CheckoutNotConfiguredError(
      data.message || "Card payments are not switched on yet.",
    );
  }
  if (!res.ok || !data.checkout_url) {
    throw new Error(data.error || "Could not open checkout. Try again.");
  }

  return { checkoutUrl: data.checkout_url, sessionId: data.session_id };
}
