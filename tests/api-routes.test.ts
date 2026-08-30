import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Same trick as the service tests: durable enough to quote, memory underneath. */
vi.mock("@/lib/tape-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tape-store")>();
  return { ...actual, boardIsDurable: () => true };
});

import { startPurchase } from "@/lib/payment-service";
import { rankOf } from "@/lib/ranks";
import { getTransaction, readBoard } from "@/lib/tape-store";
import type { Spot } from "@/lib/types";

const TRACK = "1111111111111111111111";
const TRACK_URL = `https://open.spotify.com/track/${TRACK}`;
const OTHER = "2222222222222222222222";
const WEBHOOK_KEY = `whsec_${Buffer.from("playlistbid-test-secret").toString("base64")}`;

let checkoutCalls: Record<string, unknown>[] = [];

function stubNetwork() {
  checkoutCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("open.spotify.com/oembed")) {
        return Response.json({
          title: "Real Title",
          author_name: "Real Artist",
          thumbnail_url: "https://img.test/cover.jpg",
        });
      }
      // The artist source of last resort. Answered rather than thrown so the
      // fallback path runs the way it does in production, where oEmbed carries
      // no artist field at all.
      if (url.includes("/embed/track/")) {
        return new Response("<html></html>", { status: 200 });
      }
      if (url.includes("dodopayments.com/checkouts")) {
        checkoutCalls.push(
          JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        );
        return Response.json({
          checkout_url: "https://test.dodopayments.com/session/abc",
          session_id: `sess_${checkoutCalls.length}`,
        });
      }
      throw new Error(`unexpected fetch to ${url}`);
    }),
  );
}

beforeEach(() => {
  delete (globalThis as { __pbTape?: unknown }).__pbTape;
  process.env.DODO_PAYMENTS_API_KEY = "test_key";
  process.env.DODO_PAYMENTS_PRODUCT_ID = "prod_test";
  vi.resetModules();
  stubNetwork();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/payments/create-checkout", () => {
  it("prices the slot server-side and ignores an amount in the body", async () => {
    const { POST } = await import("@/app/api/payments/create-checkout/route");

    const res = await POST(
      post("https://playlistbid.test/api/payments/create-checkout", {
        track: TRACK_URL,
        position: 1,
        // All of this is noise: the route reads track and position, nothing else.
        amount: 1,
        price: 1,
        title: "Free Slot",
        status: "SUCCESS",
        paid: true,
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.amount).toBe(10);
    expect(body.checkoutUrl).toBe("https://test.dodopayments.com/session/abc");

    const cart = checkoutCalls[0].product_cart as { amount?: number }[];
    expect(cart[0].amount).toBe(1000);

    const tx = await getTransaction(String(body.transactionId));
    expect(tx).toMatchObject({ amount: 10, status: "PENDING", title: "Real Title" });
  });

  it("never returns the owner token to anyone but the caller who asked", async () => {
    const { POST } = await import("@/app/api/payments/create-checkout/route");
    const res = await POST(
      post("https://playlistbid.test/api/payments/create-checkout", {
        track: TRACK_URL,
        position: 1,
      }),
    );
    const body = (await res.json()) as Record<string, unknown>;

    // The token is the caller's own capability; the stored record keeps only a hash.
    expect(body.ownerToken).toHaveLength(64);
    const tx = await getTransaction(String(body.transactionId));
    expect(tx?.ownerTokenHash).not.toBe(body.ownerToken);
    expect(JSON.stringify(body)).not.toContain(tx?.ownerTokenHash);
  });

  it("rejects a position that is not a track number without calling Dodo", async () => {
    const { POST } = await import("@/app/api/payments/create-checkout/route");
    const before = await readBoard();

    const res = await POST(
      post("https://playlistbid.test/api/payments/create-checkout", {
        track: TRACK_URL,
        // The old side-code form. Positions are plain track numbers now.
        position: "A99",
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "That is not a track position on this tape.",
    });
    expect(checkoutCalls).toHaveLength(0);
    expect((await readBoard()).spots).toEqual(before.spots);
  });

  it("cannot be talked into moving the tape by claiming a payment succeeded", async () => {
    const { POST } = await import("@/app/api/payments/create-checkout/route");
    const before = await readBoard();

    const res = await POST(
      post("https://playlistbid.test/api/payments/create-checkout", {
        paid: true,
        status: "SUCCESS",
        track: TRACK_URL,
        position: 1,
      }),
    );

    // A checkout opens, because that is all this endpoint does. The tape does not.
    expect(res.status).toBe(200);
    const after = await readBoard();
    expect(after.spots).toEqual(before.spots);
    expect(rankOf(after.spots, TRACK)).toBeNull();
  });

  it("refuses malformed bodies without leaking anything", async () => {
    const { POST } = await import("@/app/api/payments/create-checkout/route");
    const res = await POST(
      post("https://playlistbid.test/api/payments/create-checkout", "{not json"),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Malformed request." });
  });

  it("reports the provider as unconfigured rather than crashing", async () => {
    delete process.env.DODO_PAYMENTS_API_KEY;
    const { POST } = await import("@/app/api/payments/create-checkout/route");

    const res = await POST(
      post("https://playlistbid.test/api/payments/create-checkout", {
        track: TRACK_URL,
        position: 1,
      }),
    );

    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.unconfigured).toBe(true);
    expect(String(body.error)).not.toContain("test_key");
  });

  it("keeps provider internals out of the response when Dodo refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("oembed")) {
          return Response.json({ title: "T", author_name: "A" });
        }
        return Response.json(
          { message: "product_id not found", trace_id: "trace-123" },
          { status: 422 },
        );
      }),
    );
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });

    const { POST } = await import("@/app/api/payments/create-checkout/route");
    const res = await POST(
      post("https://playlistbid.test/api/payments/create-checkout", {
        track: TRACK_URL,
        position: 1,
      }),
    );

    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toBe(
      JSON.stringify({ error: "Unable to start payment. Please try again." }),
    );
    expect(text).not.toContain("trace-123");
    // The detail is still available to whoever runs the server.
    expect(JSON.stringify(errors)).toContain("trace-123");
  });
});

/* —— webhook —— */

/**
 * A payment event shaped exactly like Dodo's own schema, which the adapter
 * parses strictly. Fields were read off the installed package rather than
 * guessed, so a payload that passes here is one the real handler accepts.
 */
function paymentPayload(
  type: string,
  transactionId: string,
  paymentId = "pay_1",
) {
  return {
    business_id: "biz_test",
    type,
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Payment",
      billing: {
        city: "Bengaluru",
        country: "IN",
        state: "KA",
        street: "1 Test Road",
        zipcode: "560001",
      },
      brand_id: "brand_test",
      business_id: "biz_test",
      created_at: new Date().toISOString(),
      currency: "USD",
      customer: {
        customer_id: "cus_test",
        email: "buyer@test.invalid",
        name: "Buyer",
      },
      digital_products_delivered: true,
      disputes: [],
      is_update_payment_method: false,
      // Written by our checkout route, and it comes back inside the signature.
      metadata: { transactionId, trackId: TRACK, position: "1" },
      payment_id: paymentId,
      payment_provider: "dodo",
      refunds: [],
      retry_attempt: 0,
      settlement_amount: 1000,
      settlement_currency: "USD",
      total_amount: 1000,
    },
  };
}

/** Signs a body the way Dodo does: HMAC-SHA256 over `id.timestamp.body`. */
function signed(body: string, key = WEBHOOK_KEY, id = "msg_1") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secret = Buffer.from(key.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return new Request("https://playlistbid.test/api/webhooks/dodo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${sig}`,
    },
    body,
  });
}

/** Opens a real checkout, so the webhook has a PENDING transaction to settle. */
async function openCheckout(position: string | number = 1, track = TRACK_URL) {
  return startPurchase({
    track,
    position,
    origin: "https://playlistbid.test",
  });
}

/**
 * A refund event. Note what it does not carry: our own transaction id. Dodo's
 * refund object has a `metadata` field of its own, and the route is written not
 * to depend on it holding the payment's, so it is left empty here — which is the
 * unfavourable case, and the one that must still work.
 */
function refundPayload(type: string, paymentId = "pay_1", isPartial = false) {
  return {
    business_id: "biz_test",
    type,
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Refund",
      brand_id: "brand_test",
      business_id: "biz_test",
      created_at: new Date().toISOString(),
      customer: {
        customer_id: "cus_test",
        email: "buyer@test.invalid",
        name: "Buyer",
      },
      is_partial: isPartial,
      metadata: {},
      payment_id: paymentId,
      refund_id: "ref_1",
      status: "succeeded",
      amount: 1000,
      currency: "USD",
      reason: "requested_by_customer",
    },
  };
}

/** A dispute event. Carries no metadata field at all — only the payment id. */
function disputePayload(
  type: string,
  disputeStatus: string,
  paymentId = "pay_1",
) {
  return {
    business_id: "biz_test",
    type,
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Dispute",
      amount: "1000",
      brand_id: "brand_test",
      business_id: "biz_test",
      created_at: new Date().toISOString(),
      currency: "USD",
      customer: {
        customer_id: "cus_test",
        email: "buyer@test.invalid",
        name: "Buyer",
      },
      dispute_id: "dis_1",
      dispute_stage: "dispute",
      dispute_status: disputeStatus,
      payment_id: paymentId,
      payment_provider: "stripe",
      remarks: "cardholder does not recognise the charge",
    },
  };
}

describe("POST /api/webhooks/dodo", () => {
  beforeEach(() => {
    process.env.DODO_PAYMENTS_WEBHOOK_KEY = WEBHOOK_KEY;
  });

  it("moves the tape for a correctly signed payment.succeeded", async () => {
    const started = await openCheckout();
    const { POST } = await import("@/app/api/webhooks/dodo/route");

    const body = JSON.stringify(
      paymentPayload("payment.succeeded", started.transactionId),
    );
    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const board = await readBoard();
    expect(rankOf(board.spots, TRACK)).toBe(1);
    expect(await getTransaction(started.transactionId)).toMatchObject({
      status: "SUCCESS",
      providerPaymentId: "pay_1",
      landedPosition: 1,
    });
  });

  it("rejects a bogus signature and leaves the tape alone", async () => {
    const started = await openCheckout();
    const before = await readBoard();
    const { POST } = await import("@/app/api/webhooks/dodo/route");

    const body = JSON.stringify(
      paymentPayload("payment.succeeded", started.transactionId),
    );
    const forged = new Request("https://playlistbid.test/api/webhooks/dodo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": "msg_forged",
        "webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
        "webhook-signature": "v1,YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=",
      },
      body,
    });

    expect((await POST(forged)).status).toBe(401);
    expect((await readBoard()).spots).toEqual(before.spots);
    expect(rankOf((await readBoard()).spots, TRACK)).toBeNull();
    expect((await getTransaction(started.transactionId))?.status).toBe("PENDING");
  });

  it("rejects a payload signed with the wrong key", async () => {
    const started = await openCheckout();
    const before = await readBoard();
    const { POST } = await import("@/app/api/webhooks/dodo/route");

    const body = JSON.stringify(
      paymentPayload("payment.succeeded", started.transactionId),
    );
    const otherKey = `whsec_${Buffer.from("not-the-real-secret").toString("base64")}`;

    expect((await POST(signed(body, otherKey))).status).toBe(401);
    expect((await readBoard()).spots).toEqual(before.spots);
  });

  it("refuses an unsigned POST", async () => {
    const started = await openCheckout();
    const { POST } = await import("@/app/api/webhooks/dodo/route");

    const res = await POST(
      post(
        "https://playlistbid.test/api/webhooks/dodo",
        paymentPayload("payment.succeeded", started.transactionId),
      ),
    );

    expect(res.status).toBe(401);
    expect((await getTransaction(started.transactionId))?.status).toBe("PENDING");
  });

  it("moves the tape once when the same delivery arrives twice", async () => {
    const started = await openCheckout();
    const { POST } = await import("@/app/api/webhooks/dodo/route");
    const body = JSON.stringify(
      paymentPayload("payment.succeeded", started.transactionId),
    );

    expect((await POST(signed(body))).status).toBe(200);
    const afterFirst = await readBoard();

    // A retry carries a fresh delivery id, so the guard cannot lean on that
    // being repeated — it is the payment and event type that must be claimed.
    expect((await POST(signed(body, WEBHOOK_KEY, "msg_2"))).status).toBe(200);

    const afterSecond = await readBoard();
    expect(afterSecond.spots).toHaveLength(13);
    expect(afterSecond.spots).toEqual(afterFirst.spots);
    expect(afterSecond.activity).toEqual(afterFirst.activity);
  });

  it.each([
    ["payment.failed", "FAILED"],
    ["payment.cancelled", "CANCELLED"],
    ["payment.processing", "PROCESSING"],
  ])("records %s without moving the tape", async (type, status) => {
    const started = await openCheckout();
    const before = await readBoard();
    const { POST } = await import("@/app/api/webhooks/dodo/route");

    const body = JSON.stringify(paymentPayload(type, started.transactionId));
    expect((await POST(signed(body))).status).toBe(200);

    const after = await readBoard();
    expect(after.spots).toEqual(before.spots);
    expect(after.activity).toEqual(before.activity);
    expect((await getTransaction(started.transactionId))?.status).toBe(status);
  });

  it("ignores a signed event for a transaction it never issued", async () => {
    const before = await readBoard();
    const { POST } = await import("@/app/api/webhooks/dodo/route");

    const body = JSON.stringify(
      paymentPayload("payment.succeeded", "not-a-real-transaction"),
    );
    // Accepted, because arguing with a webhook only earns retries.
    expect((await POST(signed(body))).status).toBe(200);
    expect((await readBoard()).spots).toEqual(before.spots);
  });

  it("says webhooks are unconfigured rather than trusting an unverified body", async () => {
    delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    const started = await openCheckout();
    const before = await readBoard();
    const { POST } = await import("@/app/api/webhooks/dodo/route");

    const body = JSON.stringify(
      paymentPayload("payment.succeeded", started.transactionId),
    );
    const res = await POST(signed(body));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Webhooks are not configured." });
    expect((await readBoard()).spots).toEqual(before.spots);
  });
});

/**
 * The reversal half of the same route. These go through the real signature
 * verification and the real payload schemas, so they check the wiring the unit
 * tests cannot: that Dodo's handler names are the ones we registered, and that a
 * payload carrying nothing but a payment id still finds its transaction.
 */
describe("POST /api/webhooks/dodo, reversals", () => {
  beforeEach(() => {
    process.env.DODO_PAYMENTS_WEBHOOK_KEY = WEBHOOK_KEY;
  });

  /** Buys the top slot for real, through the webhook, and returns the tape. */
  async function settled() {
    const started = await openCheckout();
    const { POST } = await import("@/app/api/webhooks/dodo/route");
    const body = JSON.stringify(
      paymentPayload("payment.succeeded", started.transactionId),
    );
    expect((await POST(signed(body))).status).toBe(200);
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);
    return { started, POST };
  }

  it("takes the song off the tape on refund.succeeded", async () => {
    const before = (await readBoard()).spots.map((s) => s.trackId);
    const { started, POST } = await settled();

    const body = JSON.stringify(refundPayload("refund.succeeded"));
    expect((await POST(signed(body, WEBHOOK_KEY, "msg_refund"))).status).toBe(200);

    expect((await readBoard()).spots.map((s) => s.trackId)).toEqual(before);
    expect((await getTransaction(started.transactionId))?.status).toBe("REFUNDED");
  });

  it("takes the song off the tape on dispute.lost", async () => {
    const { started, POST } = await settled();

    const body = JSON.stringify(disputePayload("dispute.lost", "dispute_lost"));
    expect((await POST(signed(body, WEBHOOK_KEY, "msg_dispute"))).status).toBe(200);

    expect(rankOf((await readBoard()).spots, TRACK)).toBeNull();
    expect((await getTransaction(started.transactionId))?.status).toBe("CHARGEBACK");
  });

  it("takes the song off the tape on dispute.accepted", async () => {
    // Dodo: "The dispute was accepted (not contested). The funds are returned to
    // the cardholder." Same outcome as losing one.
    const { started, POST } = await settled();

    const body = JSON.stringify(
      disputePayload("dispute.accepted", "dispute_accepted"),
    );
    expect((await POST(signed(body, WEBHOOK_KEY, "msg_accepted"))).status).toBe(200);

    expect(rankOf((await readBoard()).spots, TRACK)).toBeNull();
    expect((await getTransaction(started.transactionId))?.status).toBe("CHARGEBACK");
  });

  it("keeps the song on the tape for a partial refund", async () => {
    const { started, POST } = await settled();
    const held = await readBoard();

    const body = JSON.stringify(refundPayload("refund.succeeded", "pay_1", true));
    expect((await POST(signed(body, WEBHOOK_KEY, "msg_partial"))).status).toBe(200);

    expect((await readBoard()).spots).toEqual(held.spots);
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);
    expect((await getTransaction(started.transactionId))?.status).toBe("REFUNDED");
  });

  it.each([
    ["dispute.opened", "dispute_opened"],
    ["dispute.won", "dispute_won"],
    ["dispute.expired", "dispute_expired"],
  ])("leaves the tape alone on %s", async (type, status) => {
    const { started, POST } = await settled();
    const held = await readBoard();

    const body = JSON.stringify(disputePayload(type, status));
    expect((await POST(signed(body, WEBHOOK_KEY, `msg_${status}`))).status).toBe(200);

    // Funds are only held while a dispute is open, and a won one is kept. Pulling
    // a song off on suspicion would punish a buyer who is about to be vindicated.
    expect((await readBoard()).spots).toEqual(held.spots);
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);
    expect((await getTransaction(started.transactionId))?.status).toBe("SUCCESS");
  });

  it("moves the tape once when a refund is redelivered", async () => {
    const { POST } = await settled();
    const body = JSON.stringify(refundPayload("refund.succeeded"));

    expect((await POST(signed(body, WEBHOOK_KEY, "msg_a"))).status).toBe(200);
    const afterFirst = await readBoard();

    // A fresh delivery id, so it is the payment-and-event claim that has to hold.
    expect((await POST(signed(body, WEBHOOK_KEY, "msg_b"))).status).toBe(200);

    expect((await readBoard()).spots).toEqual(afterFirst.spots);
  });

  it("ignores a refund for a payment it never took", async () => {
    const before = await readBoard();
    const { POST } = await import("@/app/api/webhooks/dodo/route");

    const body = JSON.stringify(refundPayload("refund.succeeded", "pay_elsewhere"));
    // Accepted rather than argued with, same as any other unknown event.
    expect((await POST(signed(body))).status).toBe(200);
    expect((await readBoard()).spots).toEqual(before.spots);
  });

  it("rejects an unsigned refund and leaves the tape alone", async () => {
    const { started } = await settled();
    const held = await readBoard();
    const { POST } = await import("@/app/api/webhooks/dodo/route");

    const res = await POST(
      post(
        "https://playlistbid.test/api/webhooks/dodo",
        refundPayload("refund.succeeded"),
      ),
    );

    expect(res.status).toBe(401);
    expect((await readBoard()).spots).toEqual(held.spots);
    expect((await getTransaction(started.transactionId))?.status).toBe("SUCCESS");
  });
});

/* —— the buyer's own receipt —— */

/** The route takes its params as a promise, the way Next 15 hands them over. */
function params(transactionId: string) {
  return { params: Promise.resolve({ transactionId }) };
}

describe("GET /api/payments/[transactionId]", () => {
  it("shows the owner their own payment and nothing about the provider", async () => {
    const started = await openCheckout();
    const { GET } = await import("@/app/api/payments/[transactionId]/route");

    const res = await GET(
      new Request(
        `https://playlistbid.test/api/payments/${started.transactionId}?token=${started.ownerToken}`,
      ),
      params(started.transactionId),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ status: "PENDING", position: 1, amount: 10 });

    const text = JSON.stringify(body);
    for (const secret of [
      "providerCheckoutId",
      "ownerTokenHash",
      "sess_",
      started.ownerToken,
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("accepts the token in a header as well as the query string", async () => {
    const started = await openCheckout();
    const { GET } = await import("@/app/api/payments/[transactionId]/route");

    const res = await GET(
      new Request(
        `https://playlistbid.test/api/payments/${started.transactionId}`,
        { headers: { "x-payment-token": started.ownerToken } },
      ),
      params(started.transactionId),
    );

    expect(res.status).toBe(200);
  });

  it.each([
    ["no token at all", ""],
    ["a guessed token", "0".repeat(64)],
    ["a short token", "abc"],
  ])("answers 404 for %s", async (_label, token) => {
    const started = await openCheckout();
    const { GET } = await import("@/app/api/payments/[transactionId]/route");

    const res = await GET(
      new Request(
        `https://playlistbid.test/api/payments/${started.transactionId}?token=${token}`,
      ),
      params(started.transactionId),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found." });
  });

  it("answers a made-up id exactly as it answers a wrong token", async () => {
    const started = await openCheckout();
    const { GET } = await import("@/app/api/payments/[transactionId]/route");

    const unknown = await GET(
      new Request(
        `https://playlistbid.test/api/payments/nope?token=${started.ownerToken}`,
      ),
      params("nope"),
    );
    const wrongToken = await GET(
      new Request(
        `https://playlistbid.test/api/payments/${started.transactionId}?token=wrong`,
      ),
      params(started.transactionId),
    );

    // Identical, so ids cannot be enumerated by watching the difference.
    expect(unknown.status).toBe(wrongToken.status);
    expect(await unknown.text()).toBe(await wrongToken.text());
  });

  it("does not let one buyer read another buyer's payment", async () => {
    const mine = await openCheckout(1);
    const theirs = await openCheckout(2, `https://open.spotify.com/track/${OTHER}`);
    const { GET } = await import("@/app/api/payments/[transactionId]/route");

    const res = await GET(
      new Request(
        `https://playlistbid.test/api/payments/${theirs.transactionId}?token=${mine.ownerToken}`,
      ),
      params(theirs.transactionId),
    );

    expect(res.status).toBe(404);
  });
});

/* —— the public tape —— */

describe("GET /api/board", () => {
  it("publishes the tape without a trace of who paid for it", async () => {
    const started = await openCheckout();
    process.env.DODO_PAYMENTS_WEBHOOK_KEY = WEBHOOK_KEY;
    const { POST: hook } = await import("@/app/api/webhooks/dodo/route");
    await hook(
      signed(
        JSON.stringify(
          paymentPayload("payment.succeeded", started.transactionId),
        ),
      ),
    );

    const { GET } = await import("@/app/api/board/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as { spots: Spot[] };
    expect(rankOf(body.spots, TRACK)).toBe(1);

    // Every field is named on purpose; nothing private can ride along.
    expect(Object.keys(body.spots[0]).sort()).toEqual([
      "artist",
      "bid",
      "clicks",
      "id",
      "raisedAt",
      "thumbnailUrl",
      "title",
      "trackId",
      "trackUrl",
    ]);

    const text = JSON.stringify(body);
    for (const secret of [
      started.transactionId,
      started.ownerToken,
      "pay_1",
      "sess_",
      "ownerToken",
      "buyer@test.invalid",
    ]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("POST /api/board/play", () => {
  const VISITOR = "visitor-abcdef12";

  it("counts a play once per visitor and never touches the price", async () => {
    const { POST } = await import("@/app/api/board/play/route");
    const before = await readBoard();
    const target = before.spots[3];

    const first = await POST(
      post("https://playlistbid.test/api/board/play", {
        trackId: target.trackUrl,
        visitorId: VISITOR,
      }),
    );
    expect(await first.json()).toEqual({ counted: true });

    // Holding the button down must not inflate anything.
    const second = await POST(
      post("https://playlistbid.test/api/board/play", {
        trackId: target.trackUrl,
        visitorId: VISITOR,
      }),
    );
    expect(await second.json()).toEqual({ counted: false });

    const after = await readBoard();
    const moved = after.spots.find((s) => s.trackId === target.trackId);
    expect(moved?.clicks).toBe(target.clicks + 1);
    expect(moved?.bid).toBe(target.bid);
    expect(after.spots.map((s) => s.trackId)).toEqual(
      before.spots.map((s) => s.trackId),
    );
    expect(after.activity).toEqual(before.activity);
  });

  it.each([
    ["a bid smuggled alongside the play", { bid: 999 }],
    ["a position", { position: 1 }],
    ["a payment claim", { paid: true, status: "SUCCESS" }],
  ])("ignores %s", async (_label, extra) => {
    const { POST } = await import("@/app/api/board/play/route");
    const before = await readBoard();
    const target = before.spots[0];

    await POST(
      post("https://playlistbid.test/api/board/play", {
        trackId: target.trackUrl,
        visitorId: VISITOR,
        ...extra,
      }),
    );

    const after = await readBoard();
    expect(after.spots.map((s) => s.bid)).toEqual(before.spots.map((s) => s.bid));
    expect(after.spots.map((s) => s.trackId)).toEqual(
      before.spots.map((s) => s.trackId),
    );
  });

  it.each([
    ["an unparseable body", "{not json"],
    ["a missing track", { visitorId: VISITOR }],
    ["a track that is not a Spotify song", { trackId: "https://evil.test/x", visitorId: VISITOR }],
    ["a visitor id too short to be one", { trackId: TRACK_URL, visitorId: "abc" }],
  ])("refuses %s", async (_label, body) => {
    const { POST } = await import("@/app/api/board/play/route");
    const res = await POST(post("https://playlistbid.test/api/board/play", body));
    expect(res.status).toBe(400);
  });
});

/**
 * The paste-time lookup. It sells nothing, so everything here is about telling
 * the truth early: what song a link is, and whether the tape already has it.
 */
describe("GET /api/track", () => {
  function get(query: string) {
    return new Request(`https://playlistbid.test/api/track?${query}`);
  }

  it("resolves a link and says the tape does not have it", async () => {
    const { GET } = await import("@/app/api/track/route");
    const board = await readBoard();

    const res = await GET(get(`url=${encodeURIComponent(TRACK_URL)}`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      trackId: TRACK,
      title: "Real Title",
      alreadyOnTape: false,
      position: null,
    });
    // Every filled slot plus one on the open end.
    expect(body.openPositions).toHaveLength(board.spots.length + 1);
  });

  it("strips ?si= tracking parameters before matching", async () => {
    const { GET } = await import("@/app/api/track/route");
    const board = await readBoard();
    const seated = board.spots[4];

    const res = await GET(
      get(`url=${encodeURIComponent(`${seated.trackUrl}?si=abc123&utm_source=x`)}`),
    );

    const body = await res.json();
    expect(body.trackId).toBe(seated.trackId);
    expect(body.alreadyOnTape).toBe(true);
    expect(body.position).toBe(5);
  });

  it("offers only the positions above a song already on the tape", async () => {
    const { GET } = await import("@/app/api/track/route");
    const board = await readBoard();
    const seated = board.spots[3];

    const res = await GET(get(`url=${encodeURIComponent(seated.trackUrl)}`));
    const body = await res.json();

    expect(body.alreadyOnTape).toBe(true);
    expect(body.position).toBe(4);
    // Not 4, and nothing below it: paying to sit where you already sit, or
    // lower, takes money and changes nothing.
    expect(body.openPositions).toEqual([1, 2, 3]);
  });

  it("leaves nothing to buy for the song holding track 1", async () => {
    const { GET } = await import("@/app/api/track/route");
    const board = await readBoard();

    const res = await GET(get(`url=${encodeURIComponent(board.spots[0].trackUrl)}`));
    const body = await res.json();

    expect(body.position).toBe(1);
    expect(body.openPositions).toEqual([]);
  });

  it("recognises a typed title that is already on the tape", async () => {
    // No catalogue search exists — Spotify refuses /v1/search to this app — so
    // the only titles this can know are the ones the tape is already holding.
    // That is the case worth catching: adding something twice by name.
    const { GET } = await import("@/app/api/track/route");
    const board = await readBoard();
    const seated = board.spots[2];

    const res = await GET(get(`q=${encodeURIComponent(seated.title.toUpperCase())}`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      trackId: seated.trackId,
      title: seated.title,
      matchedByTitle: true,
      alreadyOnTape: true,
      position: 3,
    });
    // The canonical link comes back, so the paddle can price it as a paste.
    expect(body.trackUrl).toContain(seated.trackId);
  });

  it("refuses text that is neither a link nor a song on the tape", async () => {
    const { GET } = await import("@/app/api/track/route");
    const res = await GET(get("q=something%20nobody%20bought"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Paste a song link/);
  });

  it("refuses a single character rather than matching half the tape", async () => {
    const { GET } = await import("@/app/api/track/route");
    const res = await GET(get("q=a"));
    expect(res.status).toBe(400);
  });
});

