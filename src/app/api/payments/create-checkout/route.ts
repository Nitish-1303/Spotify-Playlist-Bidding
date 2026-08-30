import { NextResponse } from "next/server";
import {
  DodoAmountBelowMinimumError,
  DodoNotConfiguredError,
  DodoRequestError,
  dodoConfigured,
} from "@/lib/dodo";
import { PurchaseError, startPurchase } from "@/lib/payment-service";
import { boardIsDurable } from "@/lib/tape-store";

/** Whether the paddle can take money at all. Nothing secret in the answer. */
export async function GET() {
  return NextResponse.json({
    configured: dodoConfigured() && boardIsDurable(),
    durableTape: boardIsDurable(),
  });
}

/**
 * Opens a checkout for a track position.
 *
 * Reads exactly two things from the body — which song, which position. An
 * `amount` in the request is ignored: the price comes from the tape, server
 * side. Nothing here moves the tape; only the webhook can do that.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    const started = await startPurchase({
      track: String(body.track ?? body.trackId ?? ""),
      position: body.position,
      origin: new URL(request.url).origin,
    });

    return NextResponse.json({
      transactionId: started.transactionId,
      ownerToken: started.ownerToken,
      checkoutUrl: started.checkoutUrl,
      amount: started.amount,
    });
  } catch (err) {
    if (err instanceof PurchaseError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof DodoNotConfiguredError) {
      return NextResponse.json(
        { error: err.message, unconfigured: true },
        { status: 503 },
      );
    }
    // A price the provider will not accept is a settings mismatch, so the log
    // says what to change rather than leaving an operator to read a status code.
    // 503, not 502: the site is asking for something its own configuration
    // forbids, and nothing about it is the payer's fault or their retry to make.
    if (err instanceof DodoAmountBelowMinimumError) {
      console.error(
        `[dodo] refused $${err.amount} as below the product's minimum — lower the Pay What You Want minimum on DODO_PAYMENTS_PRODUCT_ID to $${err.amount} or less, or raise OPENING_PRICE so no slot is ever quoted under it`,
        err.detail,
      );
      return NextResponse.json(
        {
          error: `This position costs $${err.amount}, which is under the minimum this checkout takes. A higher position can still be bought — nothing has been charged.`,
        },
        { status: 503 },
      );
    }
    // Provider internals stay in the server log. The payer gets a clean line.
    if (err instanceof DodoRequestError) {
      console.error("[dodo] checkout failed", err.message, err.detail);
    } else {
      console.error("[payments] create-checkout failed", err);
    }
    return NextResponse.json(
      { error: "Unable to start payment. Please try again." },
      { status: 502 },
    );
  }
}
