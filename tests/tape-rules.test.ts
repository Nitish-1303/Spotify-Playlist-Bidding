import { describe, expect, it } from "vitest";
import { chartOrder } from "@/lib/ranks";
import { applyPlay, applyPurchase, rankMap } from "@/lib/tape-rules";
import type { BoardState, Spot } from "@/lib/types";

/** Prices descending from $5, each written on an hour apart. */
function tape(prices: number[]): BoardState {
  const base = 1_700_000_000_000;
  const spots: Spot[] = prices.map((bid, i) => ({
    id: `s${i + 1}`,
    trackId: `t${i + 1}`,
    trackUrl: `https://open.spotify.com/track/t${i + 1}`,
    title: `Song ${i + 1}`,
    artist: `Artist ${i + 1}`,
    thumbnailUrl: "",
    bid,
    clicks: i,
    raisedAt: base + i * 3_600_000,
  }));
  return { spots, activity: [], prevRanks: rankMap(spots) };
}

const NEW_SONG = {
  trackId: "fresh",
  trackUrl: "https://open.spotify.com/track/fresh",
  title: "Fresh",
  artist: "Someone",
  thumbnailUrl: "",
};

describe("applyPurchase", () => {
  it("lands a new song at the position that was paid for", () => {
    const board = tape([5, 4, 3]);
    // A dollar clear of whoever holds position 2.
    const result = applyPurchase(
      board,
      { ...NEW_SONG, amount: 5, position: 2 },
      Date.now(),
      "new-1",
    );

    expect(result.landedPosition).toBe(2);
    expect(result.note).toBeUndefined();
    expect(result.board.spots.map((s) => s.trackId)).toEqual([
      "t1",
      "fresh",
      "t2",
      "t3",
    ]);
  });

  it("shifts everything below the bought slot one track later", () => {
    const board = tape([5, 4, 3]);
    const before = board.spots.map((s) => s.trackId);
    const result = applyPurchase(
      board,
      { ...NEW_SONG, amount: 6, position: 1 },
      Date.now(),
      "new-1",
    );

    expect(result.board.spots[0].trackId).toBe("fresh");
    expect(result.board.spots.slice(1).map((s) => s.trackId)).toEqual(before);
  });

  it("moves a song already on the tape instead of writing it on twice", () => {
    const board = tape([5, 4, 3]);
    const result = applyPurchase(
      board,
      {
        trackId: "t3",
        trackUrl: "https://open.spotify.com/track/t3",
        title: "Song 3",
        artist: "Artist 3",
        thumbnailUrl: "",
        amount: 6,
        position: 1,
      },
      Date.now(),
      "should-not-be-used",
    );

    expect(result.board.spots).toHaveLength(3);
    expect(result.board.spots.filter((s) => s.trackId === "t3")).toHaveLength(1);
    expect(result.landedPosition).toBe(1);
    // Same record, so the play count it had earned survives the move.
    expect(result.board.spots[0].id).toBe("s3");
    expect(result.board.spots[0].clicks).toBe(2);
  });

  it("never drags a song down when the payment is smaller than what it holds", () => {
    const board = tape([5, 4, 3]);
    const result = applyPurchase(
      board,
      {
        trackId: "t1",
        trackUrl: "https://open.spotify.com/track/t1",
        title: "Song 1",
        artist: "Artist 1",
        thumbnailUrl: "",
        amount: 2,
        position: 1,
      },
      Date.now(),
      "unused",
    );

    expect(result.board.spots[0].trackId).toBe("t1");
    expect(result.board.spots[0].bid).toBe(5);
  });

  it("records where the song actually landed when the tape moved underneath", () => {
    // Someone paid $9 for the top slot after this buyer was quoted $6.
    const board = tape([9, 4, 3]);
    const result = applyPurchase(
      board,
      { ...NEW_SONG, amount: 6, position: 1 },
      Date.now(),
      "new-1",
    );

    expect(result.landedPosition).toBe(2);
    expect(result.note).toContain("2");
    // The larger, newer payment keeps its slot.
    expect(result.board.spots[0].trackId).toBe("t1");
    // And the song still went on the tape — the money bought something.
    expect(result.board.spots.map((s) => s.trackId)).toContain("fresh");
  });

  it("snapshots the ranks from before the payment", () => {
    const board = tape([5, 4, 3]);
    const result = applyPurchase(
      board,
      { ...NEW_SONG, amount: 6, position: 1 },
      Date.now(),
      "new-1",
    );

    expect(result.board.prevRanks).toEqual({ s1: 1, s2: 2, s3: 3 });
  });

  it("writes the payment into the activity strip", () => {
    const board = tape([5]);
    const now = Date.now();
    const result = applyPurchase(
      board,
      { ...NEW_SONG, amount: 6, position: 1 },
      now,
      "new-1",
    );

    expect(result.board.activity[0]).toMatchObject({
      trackId: "fresh",
      bid: 6,
      at: now,
    });
  });

  it("keeps the tie rule that makes a bought slot exact", () => {
    const board = tape([5, 5, 5]);
    const result = applyPurchase(
      board,
      { ...NEW_SONG, amount: 5, position: 1 },
      Date.now(),
      "new-1",
    );

    // Equal money, so the ones already on the tape stay above.
    expect(result.board.spots.map((s) => s.trackId)).toEqual([
      "t1",
      "t2",
      "t3",
      "fresh",
    ]);
  });
});

describe("applyPlay", () => {
  it("bumps one song's play count and nothing else", () => {
    const board = tape([5, 4]);
    const next = applyPlay(board, "t2");
    expect(next.spots.find((s) => s.trackId === "t2")?.clicks).toBe(2);
    expect(next.spots.find((s) => s.trackId === "t1")?.clicks).toBe(0);
  });

  it("leaves the tape alone for a song that is not on it", () => {
    const board = tape([5]);
    expect(applyPlay(board, "nope")).toBe(board);
  });
});

describe("chartOrder", () => {
  it("orders by money, then by who got there first", () => {
    const board = tape([3, 5, 5]);
    expect(chartOrder(board.spots).map((s) => s.trackId)).toEqual([
      "t2",
      "t3",
      "t1",
    ]);
  });
});
