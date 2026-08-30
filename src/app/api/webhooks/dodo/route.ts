import { NextResponse } from "next/server";
import { Webhooks } from "@dodopayments/nextjs";
import { finalizePayment } from "@/lib/payment-service";
import type { PaymentStatus } from "@/lib/types";

/**
 * The only thing on this site that can move the tape.
 *
 * `Webhooks` is Dodo's Next.js adapter: it reads the raw body, verifies the
 * standard-webhooks signature against DODO_PAYMENTS_WEBHOOK_KEY, and refuses
 * anything that does not check out before a handler is ever called. A forged or
 * replayed-with-edits POST therefore never reaches `finalizePayment`.
 *
 * The metadata read here was written by our own checkout route, not by a
 * browser, and it comes back inside the signed payload.
 */

const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;

type PaymentEventData = {
  payment_id: string;
  metadata?: Record<string, unknown> | null;
  /** Minor units, per Dodo's payment object. Absent on shapes we don't know. */
  total_amount?: number | null;
  currency?: string | null;
};

async function apply(
  event: string,
  status: PaymentStatus,
  data: PaymentEventData | undefined,
) {
  const paymentId = data?.payment_id;
  const transactionId = data?.metadata?.transactionId;

  if (!paymentId || typeof transactionId !== "string") {
    // Someone else's product, or a payment not started here. Nothing to do —
    // and nothing to complain about, or Dodo will keep retrying.
    console.warn("[dodo] verified event without a PlaylistBid transaction", {
      event,
      paymentId,
    });
    return;
  }

  const outcome = await finalizePayment({
    // Same payment, same event type, delivered twice → the second one is a
    // no-op. This is what stops one payment moving the tape twice.
    eventId: `${paymentId}:${event}`,
    transactionId,
    providerPaymentId: paymentId,
    status,
    // What was actually charged. The slot price is the server's figure, and the
    // amount box on a Pay What You Want checkout is the customer's, so the two
    // are compared before the tape moves.
    paidMinorUnits: typeof data?.total_amount === "number"
      ? data.total_amount
      : undefined,
    currency: typeof data?.currency === "string" ? data.currency : undefined,
  });

  console.log("[dodo]", event, { transactionId, outcome });
}

const handler = webhookKey
  ? Webhooks({
      webhookKey,
      onPaymentSucceeded: async (payload) =>
        apply("payment.succeeded", "SUCCESS", payload.data as PaymentEventData),
      onPaymentFailed: async (payload) =>
        apply("payment.failed", "FAILED", payload.data as PaymentEventData),
      onPaymentCancelled: async (payload) =>
        apply("payment.cancelled", "CANCELLED", payload.data as PaymentEventData),
      onPaymentProcessing: async (payload) =>
        apply(
          "payment.processing",
          "PROCESSING",
          payload.data as PaymentEventData,
        ),
    })
  : null;

export async function POST(request: Request) {
  if (!handler) {
    console.error("[dodo] webhook received but DODO_PAYMENTS_WEBHOOK_KEY is unset");
    return NextResponse.json(
      { error: "Webhooks are not configured." },
      { status: 503 },
    );
  }
  return handler(request as never);
}
