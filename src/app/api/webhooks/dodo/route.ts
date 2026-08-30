import { NextResponse } from "next/server";
import { Webhooks } from "@dodopayments/nextjs";
import {
  finalizePayment,
  reversePayment,
  type ReversalKind,
} from "@/lib/payment-service";
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

/** Refund and dispute payloads. Both name the payment, neither is the payment. */
type ReversalEventData = {
  payment_id?: string;
  metadata?: Record<string, unknown> | null;
  /** Refunds only. Dodo's own word on whether the whole payment went back. */
  is_partial?: boolean | null;
  reason?: string | null;
  remarks?: string | null;
  /** Dispute auto-resolved by Visa RDR: a real refund, arriving as a lost one. */
  is_resolved_by_rdr?: boolean | null;
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

/**
 * Undoes a settled payment, for the events where Dodo's docs say the money has
 * gone back to the cardholder: `refund.succeeded`, `dispute.lost` ("Funds are
 * returned to the cardholder", which is also how a Visa RDR auto-refund
 * arrives), and `dispute.accepted` ("The dispute was accepted (not contested).
 * The funds are returned to the cardholder").
 *
 * `dispute.opened` is not one of them. Their docs suggest "consider revoking
 * access while it is open", but funds are only held at that point and a dispute
 * can still be won. Pulling a song off the tape on suspicion would punish a buyer
 * who then wins, and there is no way to hand a position back once the tape has
 * moved on beneath it — so an opened dispute is logged loudly and nothing more.
 */
async function reverse(
  event: string,
  kind: ReversalKind,
  data: ReversalEventData | undefined,
) {
  const paymentId = data?.payment_id;
  if (!paymentId) {
    console.warn("[dodo] verified reversal with no payment id", { event });
    return;
  }

  const transactionId = data?.metadata?.transactionId;

  const outcome = await reversePayment({
    eventId: `${paymentId}:${event}`,
    providerPaymentId: paymentId,
    // Refund payloads carry a metadata object; whether it is the payment's own
    // is not something to bank on, and dispute payloads have none at all. So it
    // is used when it is there and the payment id resolves the rest.
    transactionId: typeof transactionId === "string" ? transactionId : undefined,
    kind,
    partial: data?.is_partial === true,
    reason: data?.reason ?? data?.remarks ?? undefined,
  });

  console.log("[dodo]", event, { paymentId, outcome });
}

/** For the dispute events that do not move money. Visibility, nothing else. */
function note(event: string, data: ReversalEventData | undefined) {
  console.warn("[dodo]", event, {
    paymentId: data?.payment_id,
    reason: data?.reason ?? data?.remarks ?? undefined,
  });
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

      // The money has gone back. The song comes off the tape.
      onRefundSucceeded: async (payload) =>
        reverse("refund.succeeded", "refund", payload.data as ReversalEventData),
      onDisputeLost: async (payload) =>
        reverse("dispute.lost", "chargeback", payload.data as ReversalEventData),
      onDisputeAccepted: async (payload) =>
        reverse("dispute.accepted", "chargeback", payload.data as ReversalEventData),

      // The money has not gone anywhere yet, or has come back to us.
      onDisputeOpened: async (payload) =>
        note("dispute.opened", payload.data as ReversalEventData),
      onDisputeExpired: async (payload) =>
        note("dispute.expired", payload.data as ReversalEventData),
      onDisputeWon: async (payload) =>
        note("dispute.won", payload.data as ReversalEventData),
      onRefundFailed: async (payload) =>
        note("refund.failed", payload.data as ReversalEventData),
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
