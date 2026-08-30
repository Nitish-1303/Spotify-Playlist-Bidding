/**
 * The payment lifecycle, in one place.
 *
 * Two entry points, and the split between them is the whole security model:
 *
 *   startPurchase   — anything a browser can ask for. Prices the slot itself,
 *                     records a PENDING transaction, opens a Dodo checkout.
 *   finalizePayment — only ever called from a signature-verified webhook. The
 *                     one path that can move the tape.
 *
 * Server-only.
 */
import {
  createCheckout,
  DodoNotConfiguredError,
  dodoConfigured,
} from "./dodo";
import { openRanks, parsePosition, priceForRank, rankOf } from "./ranks";
import { fetchTrackMeta, TrackNotFoundError } from "./spotify-api";
import { parseSpotifyTrackId, spotifyTrackUrl } from "./spotify";
import { applyPurchase, applyReversal } from "./tape-rules";
import {
  boardIsDurable,
  findTransactionByProviderPayment,
  getTransaction,
  linkProviderPayment,
  putTransaction,
  readBoard,
  withBoard,
} from "./tape-store";
import type { PaymentStatus, PaymentTransaction } from "./types";

/** A refusal the payer is allowed to see, with nothing internal in it. */
export class PurchaseError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PurchaseError";
  }
}

function randomHex(bytes: number) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent comparison, so a wrong token leaks nothing by timing. */
function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type StartPurchaseInput = {
  /** A Spotify track link, id, or URI. Anything else is refused. */
  track: string;
  /** Track number on the tape, counted from the top. Never an amount. */
  position: unknown;
  /** Origin of the request, used to build the return URL. */
  origin: string;
};

export type StartedPurchase = {
  transactionId: string;
  /** Handed to the buyer's browser once. Proves ownership of the transaction. */
  ownerToken: string;
  checkoutUrl: string;
  amount: number;
  position: number;
};

/**
 * Prices a slot and opens a checkout for it.
 *
 * The amount is computed here from the tape as it stands. Whatever the request
 * body claims the price is, it is not read — the only inputs taken from the
 * browser are which song and which position, and both are validated against the
 * live tape before a checkout exists.
 */
export async function startPurchase(
  input: StartPurchaseInput,
): Promise<StartedPurchase> {
  const trackId = parseSpotifyTrackId(String(input.track ?? ""));
  if (!trackId) {
    throw new PurchaseError(
      "That is not a song link. Use open.spotify.com/track/…",
    );
  }

  const position = parsePosition(input.position);
  if (position === null) {
    throw new PurchaseError("That is not a track position on this tape.");
  }

  if (!dodoConfigured()) throw new DodoNotConfiguredError();
  if (!boardIsDurable()) {
    // Memory-backed tapes are per-instance and vanish on redeploy. Taking money
    // for a slot on one would be taking money for nothing.
    throw new PurchaseError(
      "The tape is not on durable storage yet, so slots cannot be sold. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      503,
    );
  }

  const board = await readBoard();
  const held = rankOf(board.spots, trackId);

  if (!openRanks(board.spots, trackId).includes(position)) {
    throw new PurchaseError("That track position is not on the tape.");
  }
  // The duplicate rule, and the only place it is enforced with money at stake.
  // A song on the tape is never written on twice — applyPurchase moves the entry
  // it already has — so the only thing left to refuse is paying for a position
  // that would not move it: the one it holds, or one below.
  if (held !== null && position >= held) {
    throw new PurchaseError(
      held === 1
        ? "This song is already on the tape at track 1. There is nothing above it to buy."
        : `This song is already on the tape at track ${held}. Only positions above it are for sale.`,
    );
  }

  // Priced against the tape with this song lifted off it, so moving a song up
  // is not charged for the slot it already occupies.
  const amount = priceForRank(board.spots, position, trackId);

  // Title, artist and artwork are read here rather than accepted from the
  // browser, so a crafted request cannot put its own text on the tape.
  //
  // Both failures refuse the sale, because a song this server cannot name must
  // not go on the tape — but they are different refusals. A bad link is the
  // payer's to fix; Spotify not answering is nobody's, and saying so is the
  // difference between someone correcting a link and someone assuming the site
  // is broken. Nothing has been charged either way: the checkout does not exist
  // yet at this line.
  const meta = await fetchTrackMeta(trackId).catch((err) => {
    if (err instanceof TrackNotFoundError) {
      throw new PurchaseError(
        "Spotify has no track at that link. Check the link and try again.",
      );
    }
    throw new PurchaseError(
      "Spotify is not answering right now, so this song could not be read. Nothing has been charged — please try again in a moment.",
      503,
    );
  });

  const id = crypto.randomUUID();
  const ownerToken = randomHex(32);
  const now = Date.now();

  const tx: PaymentTransaction = {
    id,
    ownerTokenHash: await sha256(ownerToken),
    trackId,
    trackUrl: spotifyTrackUrl(trackId),
    title: meta.title,
    artist: meta.artist,
    thumbnailUrl: meta.thumbnailUrl,
    position,
    amount,
    currency: "USD",
    provider: "dodo",
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  };

  // Written before the checkout exists, so there is no window in which a buyer
  // could pay against a transaction this server has no record of. If the store
  // is unreachable the checkout is never created, and a checkout the buyer
  // abandons leaves nothing behind but a PENDING record that expires.
  await putTransaction(tx);

  const checkout = await createCheckout({
    amount,
    returnUrl: `${input.origin}/success?tx=${id}`,
    metadata: {
      // Written by the server, so the webhook can trust what comes back.
      transactionId: id,
      trackId,
      position: String(position),
    },
  });

  await putTransaction({
    ...tx,
    providerCheckoutId: checkout.sessionId,
    updatedAt: Date.now(),
  });

  return {
    transactionId: id,
    ownerToken,
    checkoutUrl: checkout.checkoutUrl,
    amount,
    position,
  };
}

/** Dodo's payment intent statuses, mapped onto our own state machine. */
export function mapProviderStatus(status: string): PaymentStatus {
  switch (status) {
    case "succeeded":
      return "SUCCESS";
    case "failed":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    default:
      // processing, requires_customer_action, requires_capture, and the rest of
      // the intent statuses are all "not settled yet".
      return "PROCESSING";
  }
}

/** Statuses no later event may move a transaction out of. */
const FINAL: readonly PaymentStatus[] = ["SUCCESS", "REFUNDED", "CHARGEBACK"];

function isFinal(status: PaymentStatus) {
  return FINAL.includes(status);
}

/** True once the money has gone back, whether we sent it or a network took it. */
function isReversed(status: PaymentStatus) {
  return status === "REFUNDED" || status === "CHARGEBACK";
}

export type FinalizeInput = {
  /** Webhook delivery id, used to make redelivery a no-op. */
  eventId: string;
  transactionId: string;
  providerPaymentId?: string;
  status: PaymentStatus;
  /** What actually arrived, in minor units, when the provider reports it. */
  paidMinorUnits?: number;
  /** Currency of `paidMinorUnits`, as the provider spells it. */
  currency?: string;
};

export type FinalizeOutcome =
  | "finalized"
  | "recorded"
  | "duplicate"
  | "already-final"
  | "unknown-transaction"
  | "underpaid"
  | "conflict";

/**
 * True when less money arrived than the slot costs.
 *
 * This matters because the product is Pay What You Want: the amount box on the
 * provider's checkout page is editable, so "payment succeeded" is not by itself
 * proof that the slot's price was paid. The tape records the server's own
 * figure, so without this check a $40 position could be bought for a dollar.
 *
 * Deliberately permissive in two cases, because a false refusal takes a slot
 * from someone who did pay: an unrecognised payload shape (no amount at all)
 * and a non-USD settlement, where the figures are not comparable — adaptive
 * currency would report paise or cents of something else entirely. Both fall
 * through to the normal path and are logged instead.
 */
function underpaid(tx: PaymentTransaction, input: FinalizeInput) {
  const paid = input.paidMinorUnits;
  if (typeof paid !== "number" || !Number.isFinite(paid)) return false;
  if (input.currency && input.currency.toUpperCase() !== "USD") return false;
  return paid < tx.amount * 100;
}

/**
 * Applies a verified payment outcome. The only function in the codebase that
 * can move the tape.
 *
 * Idempotent three times over: the webhook delivery id is claimed in the same
 * indivisible step as the write, a transaction already at SUCCESS is left alone,
 * and the tape write is version-checked so a redelivery racing the original
 * cannot double-insert.
 */
export async function finalizePayment(
  input: FinalizeInput,
): Promise<FinalizeOutcome> {
  const tx = await getTransaction(input.transactionId);
  if (!tx) return "unknown-transaction";

  // Recorded before anything else and on every event, settled or not: a refund
  // or dispute payload names only Dodo's payment id, so this is the only route
  // back to the transaction. Writing it for a payment that then fails costs a
  // key nobody reads; not writing it for one that succeeds loses the reversal.
  if (input.providerPaymentId) {
    await linkProviderPayment(input.providerPaymentId, tx.id);
  }

  // SUCCESS is terminal, and so is a reversal: a late "processing" redelivery
  // must never walk a finished payment backwards, re-run the tape mutation, or
  // put a refunded transaction back on its feet.
  if (isFinal(tx.status)) return "already-final";

  const now = Date.now();

  // A short payment is treated as a failure, not as a cheap slot: the money is
  // settled, so it is the tape that must not move. Refund it from the provider
  // dashboard — nothing here can, and nothing here pretends to.
  const short = input.status === "SUCCESS" && underpaid(tx, input);
  if (short) {
    console.error("[dodo] short payment, tape left alone", {
      transactionId: tx.id,
      expectedMinorUnits: tx.amount * 100,
      paidMinorUnits: input.paidMinorUnits,
      currency: input.currency,
    });
  }

  if (input.status !== "SUCCESS" || short) {
    const next: PaymentTransaction = {
      ...tx,
      status: short ? "FAILED" : input.status,
      providerPaymentId: input.providerPaymentId ?? tx.providerPaymentId,
      updatedAt: now,
      ...(short ? { note: "Paid less than the slot price." } : {}),
    };
    const { outcome } = await withBoard(() => ({
      // No board in the commit: a payment that is not settled leaves the tape
      // exactly as it was. The guard is checked inside that same step, so a
      // "processing" retry that overtakes its own "succeeded" is refused rather
      // than walking a finished payment backwards.
      commit: {
        transaction: next,
        eventId: input.eventId,
        onlyIfUnsettled: tx.id,
      },
      result: null,
    }));
    if (outcome === "duplicate") return "duplicate";
    if (outcome === "stale") return "already-final";
    if (outcome !== "ok") return "conflict";
    return short ? "underpaid" : "recorded";
  }

  const { outcome } = await withBoard((board) => {
    const applied = applyPurchase(
      board,
      {
        trackId: tx.trackId,
        trackUrl: tx.trackUrl,
        title: tx.title,
        artist: tx.artist,
        thumbnailUrl: tx.thumbnailUrl,
        amount: tx.amount,
        position: tx.position,
      },
      now,
      crypto.randomUUID(),
    );

    const next: PaymentTransaction = {
      ...tx,
      status: "SUCCESS",
      providerPaymentId: input.providerPaymentId ?? tx.providerPaymentId,
      updatedAt: now,
      completedAt: now,
      landedPosition: applied.landedPosition,
      note: applied.note,
    };

    // Tape, transaction, event claim and the settled marker go in together.
    // There is no window in which the money is settled and the tape has not
    // moved, and none in which a later event can undo it.
    return {
      commit: {
        board: applied.board,
        transaction: next,
        eventId: input.eventId,
        settles: tx.id,
      },
      result: null,
    };
  });

  if (outcome === "duplicate") return "duplicate";
  if (outcome === "stale") return "already-final";
  return outcome === "ok" ? "finalized" : "conflict";
}

/** How the money went back. */
export type ReversalKind = "refund" | "chargeback";

export type ReverseInput = {
  /** Webhook delivery id, used to make redelivery a no-op. */
  eventId: string;
  /** Dodo's payment id. The only handle a refund or dispute payload always has. */
  providerPaymentId: string;
  /** Our own id, when the payload happens to carry our checkout metadata. */
  transactionId?: string;
  kind: ReversalKind;
  /**
   * True when only part of the payment went back. Taken from the provider's own
   * `is_partial` flag rather than worked out from the amount, which arrives in
   * different units and currencies depending on the event.
   */
  partial?: boolean;
  /** Free text from the provider. Logged, never shown to a browser. */
  reason?: string;
};

export type ReverseOutcome =
  /** The song came off the tape. */
  | "reversed"
  /** Marked, and the tape deliberately left as it was. */
  | "recorded"
  | "duplicate"
  | "unknown-transaction"
  /** The payment never settled here, so there is nothing on the tape to undo. */
  | "not-settled"
  | "conflict";

/**
 * Undoes a settled payment: a refund we issued, or a dispute the cardholder won.
 *
 * A separate entry point from `finalizePayment` rather than another status
 * through it, because the two run in opposite directions. `finalizePayment`
 * refuses to touch anything already final — which a refunded payment always is,
 * since a refund can only follow a success.
 *
 * Idempotent the same three ways: the delivery id is claimed inside the commit,
 * a transaction already reversed is left alone, and the tape write is version
 * checked. The settled marker is not touched — the payment did settle, and that
 * record is what stops a stray `payment.processing` redelivery later.
 */
export async function reversePayment(
  input: ReverseInput,
): Promise<ReverseOutcome> {
  const tx =
    (input.transactionId ? await getTransaction(input.transactionId) : null) ??
    (await findTransactionByProviderPayment(input.providerPaymentId));

  if (!tx) {
    console.warn("[dodo] reversal for a payment PlaylistBid has no record of", {
      kind: input.kind,
      providerPaymentId: input.providerPaymentId,
    });
    return "unknown-transaction";
  }

  if (isReversed(tx.status)) return "duplicate";

  const status: PaymentStatus =
    input.kind === "chargeback" ? "CHARGEBACK" : "REFUNDED";
  const now = Date.now();

  const stamp = (note: string): PaymentTransaction => ({
    ...tx,
    status,
    providerPaymentId: tx.providerPaymentId ?? input.providerPaymentId,
    updatedAt: now,
    reversedAt: now,
    note,
  });

  // Never settled here, so nothing was ever written onto the tape for it. The
  // reversal is still recorded, because the money did move: this is exactly what
  // a short payment looks like once it has been refunded from the dashboard —
  // marked FAILED by the amount guard above, then genuinely paid back.
  if (tx.status !== "SUCCESS") {
    const { outcome } = await withBoard(() => ({
      commit: { transaction: stamp(reverseNote(input.kind)), eventId: input.eventId },
      result: null,
    }));
    if (outcome === "duplicate") return "duplicate";
    return outcome === "ok" ? "not-settled" : "conflict";
  }

  // A partial refund is not a cancelled purchase. The slot was bought at one
  // price and part of that price came back, which is a judgement call about
  // whether the sale stands — so it is recorded and left to a person, rather
  // than guessed at by taking someone's song off the tape.
  if (input.partial) {
    console.warn("[dodo] partial reversal, tape left alone — review by hand", {
      kind: input.kind,
      transactionId: tx.id,
      providerPaymentId: input.providerPaymentId,
      reason: input.reason,
    });
    const { outcome } = await withBoard(() => ({
      commit: {
        transaction: stamp(
          "Part of this payment was refunded. The song is still on the tape.",
        ),
        eventId: input.eventId,
      },
      result: null,
    }));
    if (outcome === "duplicate") return "duplicate";
    return outcome === "ok" ? "recorded" : "conflict";
  }

  const { outcome, result } = await withBoard<string | null>((board) => {
    const applied = applyReversal(board, {
      trackId: tx.trackId,
      amount: tx.amount,
    });

    return {
      commit: {
        // No board key at all when nothing came off, so the version does not
        // move and a concurrent purchase is not made to retry for nothing.
        ...(applied.removed ? { board: applied.board } : {}),
        transaction: stamp(
          applied.removed
            ? reverseNote(input.kind)
            : `${reverseNote(input.kind)} The song stayed on the tape because ${applied.reason}.`,
        ),
        eventId: input.eventId,
      },
      // Why the tape was left alone, or null when the song came off. Carried out
      // through `withBoard` rather than a closure variable, because `decide` can
      // run more than once.
      result: applied.removed ? null : (applied.reason ?? "of an unstated reason"),
    };
  });

  if (outcome === "duplicate") return "duplicate";
  if (outcome !== "ok") return "conflict";

  if (result) {
    console.warn("[dodo] reversal did not move the tape", {
      kind: input.kind,
      transactionId: tx.id,
      trackId: tx.trackId,
      why: result,
    });
    return "recorded";
  }

  console.log("[dodo] song taken off the tape", {
    kind: input.kind,
    transactionId: tx.id,
    trackId: tx.trackId,
    amount: tx.amount,
  });
  return "reversed";
}

function reverseNote(kind: ReversalKind) {
  return kind === "chargeback"
    ? "This payment was charged back, so it no longer holds a slot."
    : "This payment was refunded, so it no longer holds a slot.";
}

/** What the buyer's own browser is allowed to see about their payment. */
export type TransactionView = {
  status: PaymentStatus;
  /** Track number bought, counted from the top of the tape. */
  position: number;
  /** Where the song actually landed, once settled. */
  landedPosition?: number;
  title: string;
  artist: string;
  amount: number;
  currency: string;
  note?: string;
};

export function transactionView(tx: PaymentTransaction): TransactionView {
  return {
    status: tx.status,
    position: tx.position,
    landedPosition: tx.landedPosition,
    title: tx.title,
    artist: tx.artist,
    amount: tx.amount,
    currency: tx.currency,
    note: tx.note,
  };
}

/**
 * Reads a transaction on behalf of its owner.
 *
 * There are no accounts on PlaylistBid, so ownership is the token minted when
 * the checkout was opened and kept by that one browser. Without it a caller
 * gets the same answer for a transaction that exists and one that does not, so
 * transaction ids cannot be probed.
 */
export async function readOwnTransaction(
  id: string,
  token: string,
): Promise<TransactionView | null> {
  if (!id || !token) return null;
  const tx = await getTransaction(id);
  if (!tx) return null;
  const presented = await sha256(token);
  if (!sameToken(presented, tx.ownerTokenHash)) return null;
  return transactionView(tx);
}
