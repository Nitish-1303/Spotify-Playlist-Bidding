import { chartOrder } from "./ranks";
import type { Activity, BoardState, Spot } from "./types";

const ACTIVITY_LIMIT = 60;

/** Rank every spot holds right now, keyed by spot id. */
export function rankMap(spots: Spot[]): Record<string, number> {
  const ranks: Record<string, number> = {};
  chartOrder(spots).forEach((spot, i) => {
    ranks[spot.id] = i + 1;
  });
  return ranks;
}

export type PurchaseInput = {
  trackId: string;
  trackUrl: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  /** Whole dollars actually paid. The price is the only thing that ranks. */
  amount: number;
  /** The position the buyer paid for, used only to report what happened. */
  position: number;
};

export type PurchaseResult = {
  board: BoardState;
  landedPosition: number;
  /** Set when the tape moved under the buyer and the slot could not be given. */
  note?: string;
};

/**
 * Writes a paid song onto the tape.
 *
 * The single source of truth for how a payment changes the tape — the durable
 * store and the in-memory fallback both go through here, so there is one
 * implementation of the ordering rules and one thing to test.
 *
 * Position follows the price, which is the rule the site has always stated. A
 * song is written on at the amount that was actually paid and the tape's own
 * ordering decides where that lands. Normally that is exactly the slot bought,
 * because the price was set a dollar clear of whoever held it. If someone paid
 * more for that slot in between, the song lands where its price puts it and
 * `note` records the difference — a newer, larger payment is never displaced,
 * and money is never taken without the song going on the tape.
 *
 * A song already on the tape moves rather than being written on twice.
 */
export function applyPurchase(
  board: BoardState,
  input: PurchaseInput,
  now: number,
  newId: string,
): PurchaseResult {
  const existing = board.spots.find((s) => s.trackId === input.trackId);

  const spot: Spot = existing
    ? {
        ...existing,
        trackUrl: input.trackUrl,
        title: input.title,
        artist: input.artist,
        thumbnailUrl: input.thumbnailUrl,
        // Paying can only ever lift a song. A cheaper payment on a song that is
        // already higher must not drag it down.
        bid: Math.max(existing.bid, input.amount),
        raisedAt: now,
      }
    : {
        id: newId,
        trackId: input.trackId,
        trackUrl: input.trackUrl,
        title: input.title,
        artist: input.artist,
        thumbnailUrl: input.thumbnailUrl,
        bid: input.amount,
        clicks: 0,
        raisedAt: now,
      };

  // Where everything stood before this payment, so the board can show a real
  // rank move afterwards.
  const prevRanks = rankMap(board.spots);

  const spots = chartOrder([
    spot,
    ...board.spots.filter((s) => s.trackId !== input.trackId),
  ]);

  const activity: Activity[] = [
    {
      id: `${spot.id}-${now}`,
      trackId: spot.trackId,
      title: spot.title,
      artist: spot.artist,
      bid: spot.bid,
      at: now,
    },
    ...board.activity,
  ].slice(0, ACTIVITY_LIMIT);

  const landedPosition = spots.findIndex((s) => s.trackId === spot.trackId) + 1;

  return {
    board: { spots, activity, prevRanks },
    landedPosition,
    note:
      landedPosition === input.position
        ? undefined
        : `The tape moved while the payment was being taken, so the song landed at position ${landedPosition} rather than ${input.position}.`,
  };
}

/** Bumps the play count on one song. Returns the board unchanged if unknown. */
export function applyPlay(board: BoardState, trackId: string): BoardState {
  if (!board.spots.some((s) => s.trackId === trackId)) return board;
  return {
    ...board,
    spots: board.spots.map((s) =>
      s.trackId === trackId ? { ...s, clicks: s.clicks + 1 } : s,
    ),
  };
}
