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
      position: "A1",
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

  it("prices the slot itself and ignores any amount the caller sends", async () => {
    // Whatever a crafted request adds, the signature has nowhere to put it.
    const started = await startPurchase({
      track: TRACK_URL,
      position: "A1",
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
      position: "A1",
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
      position: "A2",
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

  it.each(["Z9", "A0", "A7", "C1", "1; DROP TABLE", "", null, {}, -3, 1.5])(
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
      startPurchase({ track: TRACK_URL, position: "B9", origin: ORIGIN }),
    ).rejects.toThrow(/not on the tape/);
    expect(checkoutCalls).toHaveLength(0);
  });

  it("refuses anything that is not a song link", async () => {
    await expect(
      startPurchase({
        track: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
        position: "A1",
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
        position: "A6",
        origin: ORIGIN,
      }),
    ).rejects.toThrow(/already sits/);
    expect(checkoutCalls).toHaveLength(0);
  });
});

/** Starts a checkout the way the route would, and hands back its handle. */
async function pending(track = TRACK_URL, position: string | number = "A1") {
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
    const started = await pending(TRACK_URL, "A3");

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
    const second = await pending(`https://open.spotify.com/track/${OTHER}`, "A1");

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
      position: "A1",
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
    const a = await pending(TRACK_URL, "A1");
    const b = await pending(`https://open.spotify.com/track/${OTHER}`, "A1");

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
      position: "A1",
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
    const theirs = await pending(`https://open.spotify.com/track/${OTHER}`, "A2");

    expect(await readOwnTransaction(theirs.transactionId, mine.ownerToken)).toBeNull();
  });
});


