import type { Spot } from "./types";

/** Every song opens here. */
export const OPENING_PRICE = 1;

/**
 * Chart order: biggest backing first, and when two songs are backed the same
 * the one that got there first stays above. That tie rule is what makes
 * buying a track position exact — paying $1 clear of the holder lands you on
 * their slot and nudges them down one, never two.
 */
export function chartOrder(spots: Spot[]) {
  return [...spots].sort((a, b) => b.bid - a.bid || a.raisedAt - b.raisedAt);
}

function without(spots: Spot[], trackId?: string) {
  return trackId ? spots.filter((s) => s.trackId !== trackId) : spots;
}

/**
 * What it costs to hold a given track position: a dollar clear of whoever
 * holds it now. A position past the end of the tape opens at $1.
 */
export function priceForRank(
  spots: Spot[],
  rank: number,
  excludeTrackId?: string,
) {
  const holder = chartOrder(without(spots, excludeTrackId))[rank - 1];
  return holder ? holder.bid + 1 : OPENING_PRICE;
}

/** Positions someone can buy right now: every filled slot, plus one on the end. */
export function openRanks(spots: Spot[], excludeTrackId?: string) {
  const total = without(spots, excludeTrackId).length;
  return Array.from({ length: total + 1 }, (_, i) => i + 1);
}

/** Where a song actually sits on the tape, or null if it is not on it. */
export function rankOf(spots: Spot[], trackId: string) {
  const index = chartOrder(spots).findIndex((s) => s.trackId === trackId);
  return index === -1 ? null : index + 1;
}

/** Side A is the first six; everything after is side B. */
export function sideOf(rank: number) {
  return rank <= 6 ? "A" : "B";
}

/** Position within its side, so labels read "SIDE B · TRACK 2". */
export function trackOnSide(rank: number) {
  return rank <= 6 ? rank : rank - 6;
}

/** How the wire names a position: rank 1 is "A1", rank 8 is "B2". */
export function slotCode(rank: number) {
  return `${sideOf(rank)}${trackOnSide(rank)}`;
}

/**
 * Reads a slot code back to a rank. Returns null for anything that is not a
 * side letter followed by a track number, so a hostile position is rejected
 * before it reaches the pricing code rather than being coerced to 1.
 */
export function parseSlotCode(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isInteger(input) && input >= 1 ? input : null;
  }
  if (typeof input !== "string") return null;
  const match = input.trim().toUpperCase().match(/^([AB])([1-9][0-9]{0,2})$/);
  if (!match) return null;
  const track = Number(match[2]);
  if (match[1] === "A") return track <= 6 ? track : null;
  return track + 6;
}
