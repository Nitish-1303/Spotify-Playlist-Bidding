import { NextResponse } from "next/server";
import { parseSpotifyTrackId } from "@/lib/spotify";

/**
 * Creates a Dodo Payments hosted checkout session for one slot on the tape.
 * The secret key never leaves this route; the browser only ever sees the
 * checkout URL that comes back.
 */

type BidCheckoutBody = {
  trackId?: string;
  bid?: number;
  title?: string;
  artist?: string;
  thumbnailUrl?: string;
  genre?: string;
  targetRank?: number;
};

function paymentsConfigured() {
  return Boolean(
    process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PAYMENTS_PRODUCT_ID,
  );
}

function apiBase() {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

/** Lets the paddle tell the payer up front whether card payments are live. */
export async function GET() {
  return NextResponse.json({
    configured: paymentsConfigured(),
    mode: process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode",
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as BidCheckoutBody;
  const trackId = body.trackId ? parseSpotifyTrackId(body.trackId) : null;
  const bid = Math.round(Number(body.bid));

  if (!trackId) {
    return NextResponse.json(
      { error: "A valid song link is required." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(bid) || bid < 1) {
    return NextResponse.json(
      { error: "A slot costs at least $1." },
      { status: 400 },
    );
  }
  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: "Track title is required." },
      { status: 400 },
    );
  }

  if (!paymentsConfigured()) {
    return NextResponse.json(
      {
        unconfigured: true,
        message:
          "Card payments are not switched on yet — DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_PRODUCT_ID are unset.",
      },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const returnUrl = process.env.DODO_PAYMENTS_RETURN_URL || `${origin}/success`;
  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID!;
  const pricingMode = process.env.DODO_PAYMENTS_PRICING_MODE || "pwyw";

  // pwyw: one unit at the bid amount, in cents. quantity: a $1 product bought
  // `bid` times. Which one is right depends on how the Dodo product is set up.
  const productCartItem =
    pricingMode === "quantity"
      ? { product_id: productId, quantity: bid }
      : { product_id: productId, quantity: 1, amount: bid * 100 };

  const payload = {
    product_cart: [productCartItem],
    return_url: returnUrl,
    metadata: {
      trackId,
      bid: String(bid),
      targetRank: String(body.targetRank ?? ""),
      title: body.title.trim().slice(0, 200),
      artist: (body.artist || "Unknown artist").slice(0, 200),
      thumbnailUrl: (body.thumbnailUrl || "").slice(0, 500),
      genre: (body.genre || "Other").slice(0, 40),
    },
  };

  let data: {
    checkout_url?: string;
    session_id?: string;
    message?: string;
    error?: string;
  };
  let ok: boolean;

  try {
    const res = await fetch(`${apiBase()}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    ok = res.ok;
    data = (await res.json()) as typeof data;
  } catch {
    return NextResponse.json(
      { error: "Could not reach Dodo Payments. Try again in a moment." },
      { status: 502 },
    );
  }

  if (!ok || !data.checkout_url) {
    // Log the provider's reason server-side; the payer gets a short version.
    console.error("[dodo] checkout session failed", data);
    return NextResponse.json(
      {
        error:
          data.message ||
          data.error ||
          "Could not open checkout. Check the Dodo product id and API key.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    checkout_url: data.checkout_url,
    session_id: data.session_id,
  });
}
