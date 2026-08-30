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
import { openRanks, parseSlotCode, priceForRank, rankOf, slotCode } from "./ranks";
import { fetchTrackMeta, parseSpotifyTrackId, spotifyTrackUrl } from "./spotify";
import { applyPurchase } from "./tape-rules";
import {
  boardIsDurable,
  getTransaction,
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
  /** Slot code such as "A1", or a rank. Never an amount. */
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

  const position = parseSlotCode(input.position);
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
  if (held !== null && position >= held) {
    throw new PurchaseError(
      `That song already sits at ${slotCode(held)}. Only positions above it are for sale.`,
    );
  }

  // Priced against the tape with this song lifted off it, so moving a song up
  // is not charged for the slot it already occupies.
  const amount = priceForRank(board.spots, position, trackId);

  // Title, artist and artwork are read here rather than accepted from the
  // browser, so a crafted request cannot put its own text on the tape.
  const meta = await fetchTrackMeta(trackId).catch(() => {
    throw new PurchaseError("Could not load that song from Spotify.", 502);
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

  // SUCCESS is terminal. A late "processing" redelivery must never walk a
  // finalised payment backwards or re-run the tape mutation.
  if (tx.status === "SUCCESS") return "already-final";

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

/** What the buyer's own browser is allowed to see about their payment. */
export type TransactionView = {
  status: PaymentStatus;
  /** Slot code bought, e.g. "A1". */
  position: string;
  /** Where the song actually landed, once settled. */
  landedPosition?: string;
  title: string;
  artist: string;
  amount: number;
  currency: string;
  note?: string;
};

export function transactionView(tx: PaymentTransaction): TransactionView {
  return {
    status: tx.status,
    position: slotCode(tx.position),
    landedPosition:
      tx.landedPosition === undefined ? undefined : slotCode(tx.landedPosition),
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
