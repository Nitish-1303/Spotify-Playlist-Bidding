import { NextResponse } from "next/server";
import { parseSpotifyTrackId } from "@/lib/spotify";

type BidCheckoutBody = {
  trackId?: string;
  bid?: number;
  title?: string;
  artist?: string;
  thumbnailUrl?: string;
  genre?: string;
  askingPrice?: number;
  email?: string;
  name?: string;
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

export async function GET() {
  return NextResponse.json({
    configured: paymentsConfigured(),
    mode: process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode",
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as BidCheckoutBody;
  const trackId = body.trackId ? parseSpotifyTrackId(body.trackId) : null;
  const bid = Number(body.bid);

  if (!trackId) {
    return NextResponse.json(
      { error: "A valid Spotify track is required." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(bid) || bid < 1) {
    return NextResponse.json({ error: "Bids start at $1." }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Track title is required." }, { status: 400 });
  }

  if (!paymentsConfigured()) {
    return NextResponse.json({
      demo: true,
      message:
        "Dodo Payments is not configured. Set DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_PRODUCT_ID in .env.local.",
    });
  }

  const origin = new URL(request.url).origin;
  const returnUrl =
    process.env.DODO_PAYMENTS_RETURN_URL || `${origin}/success`;
  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID!;
  const pricingMode = process.env.DODO_PAYMENTS_PRICING_MODE || "pwyw";

  const productCartItem =
    pricingMode === "quantity"
      ? { product_id: productId, quantity: Math.round(bid) }
      : {
          product_id: productId,
          quantity: 1,
          amount: Math.round(bid * 100),
        };

  const metadata: Record<string, string> = {
    trackId,
    bid: String(Math.round(bid)),
    title: body.title.trim().slice(0, 200),
    artist: (body.artist || "Unknown artist").slice(0, 200),
    thumbnailUrl: (body.thumbnailUrl || "").slice(0, 500),
    genre: (body.genre || "Other").slice(0, 40),
  };
  if (body.askingPrice && Number.isFinite(body.askingPrice)) {
    metadata.askingPrice = String(body.askingPrice);
  }

  const payload: Record<string, unknown> = {
    product_cart: [productCartItem],
    metadata,
    return_url: returnUrl,
  };

  if (body.email?.trim()) {
    payload.customer = {
      email: body.email.trim(),
      name: body.name?.trim() || "PlaylistBid bidder",
    };
  }

  const res = await fetch(`${apiBase()}/checkouts/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as {
    checkout_url?: string;
    session_id?: string;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.checkout_url) {
    return NextResponse.json(
      {
        error:
          data.message ||
          data.error ||
          "Could not create Dodo checkout session. Check your product ID and API key.",
        details: data,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    checkout_url: data.checkout_url,
    session_id: data.session_id,
  });
}
