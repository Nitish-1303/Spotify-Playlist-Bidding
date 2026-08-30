import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Durability is forced on so the paddle will quote a price, while the store
 * itself stays on its in-memory path — the real functions below keep their own
 * internal reference to the real `boardIsDurable`. So these tests exercise the
 * genuine commit logic against a clean tape, with no Redis and no network.
 */
vi.mock("@/lib/tape-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tape-store")>();
  return { ...actual, boardIsDurable: () => true };
});

import {
  finalizePayment,
  mapProviderStatus,
  PurchaseError,
  readOwnTransaction,
  reversePayment,
  startPurchase,
} from "@/lib/payment-service";
import { rankOf } from "@/lib/ranks";
import { getTransaction, readBoard } from "@/lib/tape-store";

const TRACK = "1111111111111111111111";
const TRACK_URL = `https://open.spotify.com/track/${TRACK}`;
const OTHER = "2222222222222222222222";
const ORIGIN = "https://playlistbid.test";

/** Every checkout Dodo was asked to create, in order. */
let checkoutCalls: { url: string; body: Record<string, unknown> }[] = [];

function stubNetwork() {
  checkoutCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("open.spotify.com/oembed")) {
        return new Response(
          JSON.stringify({
            title: "Real Title",
            author_name: "Real Artist",
            thumbnail_url: "https://img.test/cover.jpg",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("dodopayments.com/checkouts")) {
        checkoutCalls.push({
          url,
          body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        });
        return new Response(
          JSON.stringify({
            checkout_url: "https://test.dodopayments.com/session/abc",
            session_id: `sess_${checkoutCalls.length}`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`unexpected fetch to ${url}`);
    }),
  );
}

beforeEach(() => {
  // A fresh tape per test: the in-memory store hangs off globalThis.
  delete (globalThis as { __pbTape?: unknown }).__pbTape;
  process.env.DODO_PAYMENTS_API_KEY = "test_key";
  process.env.DODO_PAYMENTS_PRODUCT_ID = "prod_test";
  delete process.env.DODO_PAYMENTS_PRICING_MODE;
  stubNetwork();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The cart line Dodo was sent, in minor units. */
function chargedCents(call = 0) {
  const cart = checkoutCalls[call].body.product_cart as { amount?: number }[];
  return cart[0].amount;
}

describe("startPurchase", () => {
  it("opens a checkout and records a PENDING transaction", async () => {
    const started = await startPurchase({
      track: TRACK_URL,
      position: 1,
      origin: ORIGIN,
    });

    expect(started.checkoutUrl).toBe("https://test.dodopayments.com/session/abc");
    expect(started.transactionId).toBeTruthy();
    expect(started.ownerToken).toHaveLength(64);
    // The seed tape holds $9 at the top, so the top slot costs $10.
    expect(started.amount).toBe(10);

    const tx = await getTransaction(started.transactionId);
    expect(tx).toMatchObject({
      status: "PENDING",
      amount: 10,
      position: 1,
      currency: "USD",
      provider: "dodo",
      providerCheckoutId: "sess_1",
      trackId: TRACK,
    });
    expect(checkoutCalls).toHaveLength(1);
  });

  /* —— Nothing is charged for a song that cannot be read ——
   *
   * The lookup runs before createCheckout, so both refusals happen with no money
   * involved at all. What matters is which of the two the payer is handed: one
   * says fix your link, the other says try again shortly, and getting them the
   * wrong way round sends somebody off to edit a link that was always fine.
   */
  function stubUnreadableSong(reply: () => Response) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("open.spotify.com/oembed")) return reply();
        if (url.includes("dodopayments.com")) {
          throw new Error("no checkout may be opened for an unreadable song");
        }
        throw new Error(`unexpected fetch to ${url}`);
      }),
    );
  }

  it("refuses a link Spotify has no track for", async () => {
    stubUnreadableSong(() => new Response("not found", { status: 404 }));

    await expect(
      startPurchase({ track: TRACK_URL, position: 1, origin: ORIGIN }),
    ).rejects.toMatchObject({
      name: "PurchaseError",
      status: 400,
      message: expect.stringContaining("no track at that link"),
    });
  });

  it("says Spotify is not answering rather than blaming the link", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    stubUnreadableSong(() => new Response("busy", { status: 503 }));

    await expect(
      startPurchase({ track: TRACK_URL, position: 1, origin: ORIGIN }),
    ).rejects.toMatchObject({
      name: "PurchaseError",
      // 503, not 502: the site is fine, its upstream is not, and the payer is
      // being told to come back — which is only true if nothing was charged.
      status: 503,
      message: expect.stringContaining("Nothing has been charged"),
    });

    expect(await readBoard()).toMatchObject({ spots: expect.any(Array) });
    errors.mockRestore();
  });

  it("prices the slot itself and ignores any amount the caller sends", async () => {
    // Whatever a crafted request adds, the signature has nowhere to put it.
    const started = await startPurchase({
      track: TRACK_URL,
      position: 1,
      origin: ORIGIN,
      // @ts-expect-error deliberately passing a field the type does not have
      amount: 1,
    });

    expect(started.amount).toBe(10);
    expect(chargedCents()).toBe(1000);
  });

  it("reads the song's own title and artist rather than trusting the caller", async () => {
    const started = await startPurchase({
      track: TRACK_URL,
      position: 1,
      origin: ORIGIN,
      // @ts-expect-error deliberately passing fields the type does not have
      title: "Free Slot",
      artist: "Nobody",
    });

    const tx = await getTransaction(started.transactionId);
    expect(tx?.title).toBe("Real Title");
    expect(tx?.artist).toBe("Real Artist");
  });

  it("writes its own checkout metadata", async () => {
    const started = await startPurchase({
      track: TRACK_URL,
      position: 2,
      origin: ORIGIN,
    });

    expect(checkoutCalls[0].body.metadata).toEqual({
      transactionId: started.transactionId,
      trackId: TRACK,
      position: "2",
    });
    expect(checkoutCalls[0].body.return_url).toBe(
      `${ORIGIN}/success?tx=${started.transactionId}`,
    );
  });

  // Positions are plain track numbers now, so the old side codes are refused
  // alongside everything else that is not a whole number of at least 1.
  it.each(["A1", "B2", "1abc", "1; DROP TABLE", "", null, {}, -3, 0, 1.5])(
    "refuses %o as a position without touching Dodo",
    async (position) => {
      await expect(
        startPurchase({ track: TRACK_URL, position, origin: ORIGIN }),
      ).rejects.toBeInstanceOf(PurchaseError);
      expect(checkoutCalls).toHaveLength(0);
    },
  );

  it("refuses a position past the end of the tape", async () => {
    // 12 songs on the seed tape, so 13 is the last buyable slot.
    await expect(
      startPurchase({ track: TRACK_URL, position: 15, origin: ORIGIN }),
    ).rejects.toThrow(/not on the tape/);
    expect(checkoutCalls).toHaveLength(0);
  });

  it("refuses anything that is not a song link", async () => {
    await expect(
      startPurchase({
        track: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
        position: 1,
        origin: ORIGIN,
      }),
    ).rejects.toThrow(/not a song link/);
    expect(checkoutCalls).toHaveLength(0);
  });

  it("refuses to sell a song a position at or below where it already sits", async () => {
    const board = await readBoard();
    const seated = board.spots[5];

    await expect(
      startPurchase({
        track: seated.trackUrl,
        position: 6,
        origin: ORIGIN,
      }),
    ).rejects.toThrow(/already on the tape at track 6/);
    expect(checkoutCalls).toHaveLength(0);
  });

  it("says there is nothing above track 1 when the song holds it", async () => {
    // The one duplicate that is a flat refusal rather than a redirection: there
    // is no position above the top of the tape to sell.
    const board = await readBoard();
    const top = board.spots[0];

    await expect(
      startPurchase({ track: top.trackUrl, position: 1, origin: ORIGIN }),
    ).rejects.toThrow(/nothing above it to buy/);
    expect(checkoutCalls).toHaveLength(0);
  });

  it("still sells a song already on the tape a position above it", async () => {
    // The rule the site states: a song moves, it never repeats. Blocking every
    // duplicate outright would delete this, so the refusal above is deliberately
    // narrow.
    const board = await readBoard();
    const seated = board.spots[5];

    const started = await startPurchase({
      track: seated.trackUrl,
      position: 2,
      origin: ORIGIN,
    });
    expect(started.checkoutUrl).toBeTruthy();
  });
});

/** Starts a checkout the way the route would, and hands back its handle. */
async function pending(track = TRACK_URL, position: string | number = 1) {
  return startPurchase({ track, position, origin: ORIGIN });
}

describe("finalizePayment", () => {
  it("writes the song onto the tape when the payment succeeded", async () => {
    const started = await pending();

    const outcome = await finalizePayment({
      eventId: "pay_1:payment.succeeded",
      transactionId: started.transactionId,
      providerPaymentId: "pay_1",
      status: "SUCCESS",
    });

    expect(outcome).toBe("finalized");

    const board = await readBoard();
    expect(rankOf(board.spots, TRACK)).toBe(1);
    expect(board.spots).toHaveLength(13);

    const tx = await getTransaction(started.transactionId);
    expect(tx).toMatchObject({
      status: "SUCCESS",
      providerPaymentId: "pay_1",
      landedPosition: 1,
    });
    expect(tx?.completedAt).toBeTypeOf("number");
  });

  it("shifts the songs below the bought slot one track later", async () => {
    const before = (await readBoard()).spots.map((s) => s.trackId);
    const started = await pending(TRACK_URL, 3);

    await finalizePayment({
      eventId: "pay_1:payment.succeeded",
      transactionId: started.transactionId,
      status: "SUCCESS",
    });

    const after = (await readBoard()).spots.map((s) => s.trackId);
    expect(after[2]).toBe(TRACK);
    expect(after.filter((id) => id !== TRACK)).toEqual(before);
  });

  it("moves one mutation only when the same event is delivered twice", async () => {
    const started = await pending();
    const event = {
      eventId: "pay_1:payment.succeeded",
      transactionId: started.transactionId,
      providerPaymentId: "pay_1",
      status: "SUCCESS" as const,
    };

    expect(await finalizePayment(event)).toBe("finalized");
    const afterFirst = await readBoard();

    // Dodo retries; the tape must not move a second time.
    expect(await finalizePayment(event)).toBe("already-final");

    const afterSecond = await readBoard();
    expect(afterSecond.spots).toHaveLength(13);
    expect(afterSecond.spots).toEqual(afterFirst.spots);
    expect(afterSecond.activity).toEqual(afterFirst.activity);
  });

  it("treats a redelivery racing a fresh transaction as a duplicate", async () => {
    const first = await pending();
    const second = await pending(`https://open.spotify.com/track/${OTHER}`, 1);

    await finalizePayment({
      eventId: "shared-event-id",
      transactionId: first.transactionId,
      status: "SUCCESS",
    });

    // Same delivery id, different transaction: the claim is already taken.
    const outcome = await finalizePayment({
      eventId: "shared-event-id",
      transactionId: second.transactionId,
      status: "SUCCESS",
    });

    expect(outcome).toBe("duplicate");
    const board = await readBoard();
    expect(board.spots).toHaveLength(13);
    expect(rankOf(board.spots, OTHER)).toBeNull();
  });

  it.each(["FAILED", "CANCELLED", "PROCESSING"] as const)(
    "leaves the tape untouched on %s",
    async (status) => {
      const before = await readBoard();
      const started = await pending();

      const outcome = await finalizePayment({
        eventId: `pay_1:${status}`,
        transactionId: started.transactionId,
        providerPaymentId: "pay_1",
        status,
      });

      expect(outcome).toBe("recorded");
      const after = await readBoard();
      expect(after.spots).toEqual(before.spots);
      expect(after.activity).toEqual(before.activity);
      expect(rankOf(after.spots, TRACK)).toBeNull();
      expect((await getTransaction(started.transactionId))?.status).toBe(status);
    },
  );

  it("still finalises a payment that was processing first", async () => {
    const started = await pending();

    await finalizePayment({
      eventId: "pay_1:payment.processing",
      transactionId: started.transactionId,
      status: "PROCESSING",
    });
    const outcome = await finalizePayment({
      eventId: "pay_1:payment.succeeded",
      transactionId: started.transactionId,
      status: "SUCCESS",
    });

    expect(outcome).toBe("finalized");
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);
  });

  it("never walks a finalised payment backwards", async () => {
    const started = await pending();
    await finalizePayment({
      eventId: "pay_1:payment.succeeded",
      transactionId: started.transactionId,
      status: "SUCCESS",
    });

    // A late "failed" for a payment that already settled.
    const outcome = await finalizePayment({
      eventId: "pay_1:payment.failed",
      transactionId: started.transactionId,
      status: "FAILED",
    });

    expect(outcome).toBe("already-final");
    expect((await getTransaction(started.transactionId))?.status).toBe("SUCCESS");
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);
  });

  it("holds SUCCESS when a slow earlier event lands alongside it", async () => {
    const started = await pending();

    // Dodo retries a delivery it thinks failed, so "processing" can arrive
    // after — or at the same instant as — the "succeeded" that overtook it.
    const [, late] = await Promise.all([
      finalizePayment({
        eventId: "pay_1:payment.succeeded",
        transactionId: started.transactionId,
        status: "SUCCESS",
      }),
      finalizePayment({
        eventId: "pay_1:payment.processing",
        transactionId: started.transactionId,
        status: "PROCESSING",
      }),
    ]);

    // Whichever order they interleaved in, the payment is settled and stays so.
    expect(["already-final", "recorded"]).toContain(late);
    expect((await getTransaction(started.transactionId))?.status).toBe("SUCCESS");
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);
  });

  it("keeps a PROCESSING transaction readable while it is still open", async () => {
    const started = await pending();

    expect(
      await finalizePayment({
        eventId: "pay_1:payment.processing",
        transactionId: started.transactionId,
        status: "PROCESSING",
      }),
    ).toBe("recorded");

    // Not settled, so nothing is marked and the later success still lands.
    expect(
      await finalizePayment({
        eventId: "pay_1:payment.succeeded",
        transactionId: started.transactionId,
        status: "SUCCESS",
      }),
    ).toBe("finalized");
  });

  it("does nothing for a transaction it never issued", async () => {
    const before = await readBoard();

    const outcome = await finalizePayment({
      eventId: "forged:payment.succeeded",
      transactionId: "not-a-real-transaction",
      providerPaymentId: "pay_x",
      status: "SUCCESS",
    });

    expect(outcome).toBe("unknown-transaction");
    expect((await readBoard()).spots).toEqual(before.spots);
  });

  it("moves a song that is already on the tape instead of repeating it", async () => {
    const first = await pending();
    await finalizePayment({
      eventId: "pay_1:payment.succeeded",
      transactionId: first.transactionId,
      status: "SUCCESS",
    });

    // Now buy the top slot for the same song from further down.
    const board = await readBoard();
    const seated = board.spots[4];
    const second = await startPurchase({
      track: seated.trackUrl,
      position: 1,
      origin: ORIGIN,
    });
    await finalizePayment({
      eventId: "pay_2:payment.succeeded",
      transactionId: second.transactionId,
      status: "SUCCESS",
    });

    const after = await readBoard();
    expect(after.spots).toHaveLength(13);
    expect(
      after.spots.filter((s) => s.trackId === seated.trackId),
    ).toHaveLength(1);
    expect(rankOf(after.spots, seated.trackId)).toBe(1);
  });

  it("keeps the tape consistent when two payments settle at once", async () => {
    const a = await pending(TRACK_URL, 1);
    const b = await pending(`https://open.spotify.com/track/${OTHER}`, 1);

    await Promise.all([
      finalizePayment({
        eventId: "pay_a:payment.succeeded",
        transactionId: a.transactionId,
        status: "SUCCESS",
      }),
      finalizePayment({
        eventId: "pay_b:payment.succeeded",
        transactionId: b.transactionId,
        status: "SUCCESS",
      }),
    ]);

    const board = await readBoard();
    // Both songs went on, neither overwrote the other, nothing was duplicated.
    expect(board.spots).toHaveLength(14);
    expect(rankOf(board.spots, TRACK)).not.toBeNull();
    expect(rankOf(board.spots, OTHER)).not.toBeNull();
    expect(rankOf(board.spots, TRACK)).not.toBe(rankOf(board.spots, OTHER));
    expect(new Set(board.spots.map((s) => s.trackId)).size).toBe(14);
    expect(
      [...board.spots].sort((x, y) => y.bid - x.bid).map((s) => s.bid),
    ).toEqual(board.spots.map((s) => s.bid));
    expect(
      (await getTransaction(a.transactionId))?.status,
    ).toBe("SUCCESS");
    expect(
      (await getTransaction(b.transactionId))?.status,
    ).toBe("SUCCESS");
  });
});

describe("mapProviderStatus", () => {
  it.each([
    ["succeeded", "SUCCESS"],
    ["failed", "FAILED"],
    ["cancelled", "CANCELLED"],
    ["processing", "PROCESSING"],
    ["requires_customer_action", "PROCESSING"],
    ["requires_capture", "PROCESSING"],
    ["something_new", "PROCESSING"],
  ])("maps %s to %s", (input, expected) => {
    expect(mapProviderStatus(input)).toBe(expected);
  });
});

describe("readOwnTransaction", () => {
  it("hands the owner a safe view of their own payment", async () => {
    const started = await pending();
    const view = await readOwnTransaction(
      started.transactionId,
      started.ownerToken,
    );

    expect(view).toMatchObject({
      status: "PENDING",
      position: 1,
      title: "Real Title",
      amount: 10,
      currency: "USD",
    });
    // Nothing about the provider, and nothing about ownership, comes back.
    expect(Object.keys(view ?? {})).toEqual([
      "status",
      "position",
      "landedPosition",
      "title",
      "artist",
      "amount",
      "currency",
      "note",
    ]);
    expect(JSON.stringify(view)).not.toContain("sess_");
  });

  it("answers the same way for a wrong token and a transaction that does not exist", async () => {
    const started = await pending();

    expect(await readOwnTransaction(started.transactionId, "wrong")).toBeNull();
    expect(
      await readOwnTransaction(started.transactionId, "0".repeat(64)),
    ).toBeNull();
    expect(await readOwnTransaction("made-up-id", started.ownerToken)).toBeNull();
    expect(await readOwnTransaction(started.transactionId, "")).toBeNull();
  });

  it("does not let one buyer read another buyer's payment", async () => {
    const mine = await pending();
    const theirs = await pending(`https://open.spotify.com/track/${OTHER}`, 2);

    expect(await readOwnTransaction(theirs.transactionId, mine.ownerToken)).toBeNull();
  });
});

/**
 * The product is Pay What You Want, so the amount box on Dodo's checkout page
 * belongs to the customer. A settled payment therefore proves money moved, not
 * that the slot's price was paid, and the tape records the server's figure.
 */
describe("finalizePayment guards the amount", () => {
  it("refuses to move the tape when less than the slot price arrived", async () => {
    const started = await pending();
    const before = await readBoard();

    const outcome = await finalizePayment({
      eventId: "pay_short:payment.succeeded",
      transactionId: started.transactionId,
      providerPaymentId: "pay_short",
      status: "SUCCESS",
      // The slot costs $10; a dollar turned up.
      paidMinorUnits: 100,
      currency: "USD",
    });

    expect(outcome).toBe("underpaid");

    const after = await readBoard();
    expect(after.spots).toEqual(before.spots);
    expect(rankOf(after.spots, TRACK)).toBeNull();

    const tx = await getTransaction(started.transactionId);
    expect(tx?.status).toBe("FAILED");
    expect(tx?.completedAt).toBeUndefined();
  });

  it("sells the slot when the exact price arrived", async () => {
    const started = await pending();

    const outcome = await finalizePayment({
      eventId: "pay_exact:payment.succeeded",
      transactionId: started.transactionId,
      status: "SUCCESS",
      paidMinorUnits: 1000,
      currency: "USD",
    });

    expect(outcome).toBe("finalized");
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);
  });

  it("sells the slot when more than the price arrived, tax included", async () => {
    const started = await pending();

    const outcome = await finalizePayment({
      eventId: "pay_over:payment.succeeded",
      transactionId: started.transactionId,
      status: "SUCCESS",
      paidMinorUnits: 1180,
      currency: "USD",
    });

    expect(outcome).toBe("finalized");
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);
  });

  it("falls through rather than refusing when the payload carries no amount", async () => {
    const started = await pending();

    const outcome = await finalizePayment({
      eventId: "pay_noamount:payment.succeeded",
      transactionId: started.transactionId,
      status: "SUCCESS",
    });

    expect(outcome).toBe("finalized");
  });

  it("does not compare figures across currencies", async () => {
    const started = await pending();

    // 850 paise is not 850 cents. Refusing here would take a slot from someone
    // who paid, so the mismatched currency is logged and allowed instead.
    const outcome = await finalizePayment({
      eventId: "pay_inr:payment.succeeded",
      transactionId: started.transactionId,
      status: "SUCCESS",
      paidMinorUnits: 850,
      currency: "INR",
    });

    expect(outcome).toBe("finalized");
  });

  it("leaves a failed payment reported as failed, not as underpaid", async () => {
    const started = await pending();

    const outcome = await finalizePayment({
      eventId: "pay_failed:payment.failed",
      transactionId: started.transactionId,
      status: "FAILED",
      paidMinorUnits: 0,
      currency: "USD",
    });

    expect(outcome).toBe("recorded");
    expect((await getTransaction(started.transactionId))?.status).toBe("FAILED");
  });
});

/** Buys a slot outright: checkout, then the succeeded webhook. */
async function bought(
  paymentId: string,
  track = TRACK_URL,
  position: string | number = 1,
) {
  const started = await startPurchase({ track, position, origin: ORIGIN });
  const outcome = await finalizePayment({
    eventId: `${paymentId}:payment.succeeded`,
    transactionId: started.transactionId,
    providerPaymentId: paymentId,
    status: "SUCCESS",
  });
  expect(outcome).toBe("finalized");
  return started;
}

/**
 * Money going back has to take the slot with it, or a refunded buyer keeps a
 * position they were paid to give up. A refund and a lost dispute both mean the
 * cardholder has the money, per Dodo's own description of those events, so both
 * run the purchase backwards.
 */
describe("reversePayment", () => {
  it("takes the song off the tape when the payment is refunded", async () => {
    const before = (await readBoard()).spots.map((s) => s.trackId);
    const started = await bought("pay_1");
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);

    const outcome = await reversePayment({
      eventId: "pay_1:refund.succeeded",
      providerPaymentId: "pay_1",
      kind: "refund",
    });

    expect(outcome).toBe("reversed");

    // The gap closes by itself: positions are read off the order, so everything
    // below the removed song moves up one and the tape is as it started.
    const after = (await readBoard()).spots.map((s) => s.trackId);
    expect(after).toEqual(before);
    expect(rankOf((await readBoard()).spots, TRACK)).toBeNull();

    const tx = await getTransaction(started.transactionId);
    expect(tx?.status).toBe("REFUNDED");
    expect(tx?.reversedAt).toBeTypeOf("number");
    expect(tx?.note).toContain("refunded");
  });

  it("shifts the songs below the removed slot one track earlier", async () => {
    const before = (await readBoard()).spots.map((s) => s.trackId);
    await bought("pay_1", TRACK_URL, 3);
    const mid = (await readBoard()).spots.map((s) => s.trackId);
    expect(mid[2]).toBe(TRACK);

    await reversePayment({
      eventId: "pay_1:refund.succeeded",
      providerPaymentId: "pay_1",
      kind: "refund",
    });

    expect((await readBoard()).spots.map((s) => s.trackId)).toEqual(before);
  });

  it("records a chargeback under its own status", async () => {
    const started = await bought("pay_1");

    const outcome = await reversePayment({
      eventId: "pay_1:dispute.lost",
      providerPaymentId: "pay_1",
      kind: "chargeback",
      reason: "fraudulent",
    });

    expect(outcome).toBe("reversed");
    expect(rankOf((await readBoard()).spots, TRACK)).toBeNull();

    const tx = await getTransaction(started.transactionId);
    expect(tx?.status).toBe("CHARGEBACK");
    expect(tx?.note).toContain("charged back");
  });

  it("finds the transaction from the payment id alone", async () => {
    // Refund and dispute payloads do not carry our checkout metadata, so this is
    // the path every real reversal takes.
    await bought("pay_xyz");

    const outcome = await reversePayment({
      eventId: "pay_xyz:refund.succeeded",
      providerPaymentId: "pay_xyz",
      kind: "refund",
    });

    expect(outcome).toBe("reversed");
  });

  it("refuses a payment id it has no record of", async () => {
    const before = await readBoard();

    const outcome = await reversePayment({
      eventId: "pay_someone_else:refund.succeeded",
      providerPaymentId: "pay_someone_else",
      kind: "refund",
    });

    expect(outcome).toBe("unknown-transaction");
    expect((await readBoard()).spots).toEqual(before.spots);
  });

  it("moves the tape once when the same reversal is delivered twice", async () => {
    await bought("pay_1");
    const event = {
      eventId: "pay_1:refund.succeeded",
      providerPaymentId: "pay_1",
      kind: "refund" as const,
    };

    expect(await reversePayment(event)).toBe("reversed");
    const afterFirst = await readBoard();

    expect(await reversePayment(event)).toBe("duplicate");
    expect((await readBoard()).spots).toEqual(afterFirst.spots);
  });

  it("ignores a lost dispute on a payment already refunded", async () => {
    const started = await bought("pay_1");

    await reversePayment({
      eventId: "pay_1:refund.succeeded",
      providerPaymentId: "pay_1",
      kind: "refund",
    });
    const afterRefund = await readBoard();

    // Different delivery id, so the event claim does not catch it. The status
    // does: the money has already gone back once.
    const outcome = await reversePayment({
      eventId: "pay_1:dispute.lost",
      providerPaymentId: "pay_1",
      kind: "chargeback",
    });

    expect(outcome).toBe("duplicate");
    expect((await readBoard()).spots).toEqual(afterRefund.spots);
    expect((await getTransaction(started.transactionId))?.status).toBe("REFUNDED");
  });

  it("leaves the song alone on a partial refund", async () => {
    const started = await bought("pay_1");
    const before = await readBoard();

    const outcome = await reversePayment({
      eventId: "pay_1:refund.succeeded",
      providerPaymentId: "pay_1",
      kind: "refund",
      partial: true,
    });

    expect(outcome).toBe("recorded");
    expect((await readBoard()).spots).toEqual(before.spots);
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);

    const tx = await getTransaction(started.transactionId);
    expect(tx?.status).toBe("REFUNDED");
    expect(tx?.note).toContain("still on the tape");
  });

  it("does not take a slot from a larger payment for the same song", async () => {
    // The song is bought onto A3, then lifted to A1 for more money. `applyPurchase`
    // keeps the larger of the two, so it is the second payment that holds it.
    const small = await bought("pay_small", TRACK_URL, 3);
    const big = await bought("pay_big", TRACK_URL, 1);
    expect(big.amount).toBeGreaterThan(small.amount);

    const held = await readBoard();
    expect(held.spots.find((s) => s.trackId === TRACK)?.bid).toBe(big.amount);

    // The smaller payment is refunded. That payer is made whole, but the money
    // holding the position belongs to someone who has not been refunded, so
    // taking the song off would rob them of a slot they paid for.
    const outcome = await reversePayment({
      eventId: "pay_small:refund.succeeded",
      providerPaymentId: "pay_small",
      kind: "refund",
    });

    expect(outcome).toBe("recorded");
    expect((await readBoard()).spots).toEqual(held.spots);
    expect(rankOf((await readBoard()).spots, TRACK)).toBe(1);
    expect((await getTransaction(small.transactionId))?.note).toContain(
      "stayed on the tape",
    );
  });

  it("records a reversal on a payment that never settled", async () => {
    const started = await pending();
    const before = await readBoard();

    await finalizePayment({
      eventId: "pay_1:payment.failed",
      transactionId: started.transactionId,
      providerPaymentId: "pay_1",
      status: "FAILED",
    });

    const outcome = await reversePayment({
      eventId: "pay_1:refund.succeeded",
      providerPaymentId: "pay_1",
      kind: "refund",
    });

    expect(outcome).toBe("not-settled");
    expect((await readBoard()).spots).toEqual(before.spots);
    expect((await getTransaction(started.transactionId))?.status).toBe("REFUNDED");
  });

  it("will not let a late processing event revive a refunded payment", async () => {
    const started = await bought("pay_1");

    await reversePayment({
      eventId: "pay_1:refund.succeeded",
      providerPaymentId: "pay_1",
      kind: "refund",
    });

    const outcome = await finalizePayment({
      eventId: "pay_1:payment.processing",
      transactionId: started.transactionId,
      status: "PROCESSING",
    });

    expect(outcome).toBe("already-final");
    expect((await getTransaction(started.transactionId))?.status).toBe("REFUNDED");
    expect(rankOf((await readBoard()).spots, TRACK)).toBeNull();
  });
});


