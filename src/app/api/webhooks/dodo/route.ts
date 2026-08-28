import { NextResponse } from "next/server";
import { Webhooks } from "@dodopayments/nextjs";

const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;

const handler = webhookKey
  ? Webhooks({
      webhookKey,
      onPaymentSucceeded: async (payload) => {
        const meta = payload.data?.metadata as Record<string, string> | undefined;
        console.log("[dodo] payment.succeeded", {
          payment_id: payload.data?.payment_id,
          trackId: meta?.trackId,
          bid: meta?.bid,
          title: meta?.title,
        });
      },
      onPaymentFailed: async (payload) => {
        console.warn("[dodo] payment.failed", payload.data?.payment_id);
      },
    })
  : null;

export async function POST(request: Request) {
  if (!handler) {
    return NextResponse.json(
      { error: "DODO_PAYMENTS_WEBHOOK_KEY is not configured." },
      { status: 503 },
    );
  }
  return handler(request as never);
}
