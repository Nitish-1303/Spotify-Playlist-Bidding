/**
 * Dodo Payments REST client.
 *
 * Server-only: the API key never leaves this process. Verified against the
 * installed `@dodopayments/nextjs@0.3.9` / `@dodopayments/core` types and the
 * public API reference — `POST /checkouts`, bearer auth, `product_cart` items of
 * `{ product_id, quantity }` with an optional `amount` override in minor units
 * when the product has Pay What You Want enabled.
 */

export type CheckoutMetadata = Record<string, string>;

/** Raised when Dodo has not been given credentials, so nothing can be charged. */
export class DodoNotConfiguredError extends Error {
  constructor() {
    super(
      "Card payments are not switched on yet — DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_PRODUCT_ID are unset.",
    );
    this.name = "DodoNotConfiguredError";
  }
}

/** Raised when Dodo is reachable but refused the request. */
export class DodoRequestError extends Error {
  constructor(
    message: string,
    /** Kept server-side for the log; never shown to the payer. */
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "DodoRequestError";
  }
}

export function dodoConfigured() {
  return Boolean(
    process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PAYMENTS_PRODUCT_ID,
  );
}

export function dodoMode() {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "live_mode"
    : "test_mode";
}

function apiBase() {
  return dodoMode() === "live_mode"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

export type CreateCheckoutInput = {
  /** Whole dollars. Converted to minor units for Dodo. */
  amount: number;
  returnUrl: string;
  metadata: CheckoutMetadata;
};

export type CreatedCheckout = { checkoutUrl: string; sessionId?: string };

export async function createCheckout(
  input: CreateCheckoutInput,
): Promise<CreatedCheckout> {
  if (!dodoConfigured()) throw new DodoNotConfiguredError();

  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID as string;
  const pricingMode = process.env.DODO_PAYMENTS_PRICING_MODE || "pwyw";

  // pwyw: one unit at the paid amount, in cents — needs Pay What You Want on
  // the product. quantity: a product priced at $1, bought `amount` times.
  const item =
    pricingMode === "quantity"
      ? { product_id: productId, quantity: input.amount }
      : { product_id: productId, quantity: 1, amount: input.amount * 100 };

  let res: Response;
  try {
    res = await fetch(`${apiBase()}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [item],
        return_url: input.returnUrl,
        metadata: input.metadata,
      }),
      cache: "no-store",
    });
  } catch (err) {
    throw new DodoRequestError("Could not reach the payment provider.", err);
  }

  const data = (await res.json().catch(() => ({}))) as {
    checkout_url?: string;
    session_id?: string;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.checkout_url) {
    throw new DodoRequestError("The payment provider refused the request.", {
      status: res.status,
      body: data,
    });
  }

  return { checkoutUrl: data.checkout_url, sessionId: data.session_id };
}
