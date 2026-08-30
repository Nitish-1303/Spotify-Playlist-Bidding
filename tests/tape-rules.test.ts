import { describe, expect, it } from "vitest";
import { chartOrder } from "@/lib/ranks";
import {
  applyPlay,
  applyPurchase,
  applyReversal,
  findSpotByTitle,
  rankMap,
} from "@/lib/tape-rules";
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

describe("applyReversal", () => {
  it("removes the song and closes the gap behind it", () => {
    const board = tape([5, 4, 3]);
    const result = applyReversal(board, { trackId: "t2", amount: 4 });

    expect(result.removed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.board.spots.map((s) => s.trackId)).toEqual(["t1", "t3"]);
    // t3 was third and is now second — the songs below move up, they do not
    // leave a hole where the removed one was.
    expect(rankMap(result.board.spots).s3).toBe(2);
  });

  it("records where everything stood before the removal", () => {
    const board = tape([5, 4, 3]);
    const result = applyReversal(board, { trackId: "t1", amount: 5 });

    expect(result.board.prevRanks).toEqual({ s1: 1, s2: 2, s3: 3 });
  });

  it("leaves the activity feed alone", () => {
    const board = tape([5, 4]);
    board.activity = [
      { id: "a1", trackId: "t2", title: "Song 2", artist: "Artist 2", bid: 4, at: 1 },
    ];
    const result = applyReversal(board, { trackId: "t2", amount: 4 });

    expect(result.board.activity).toEqual(board.activity);
  });

  it("keeps the song when a larger payment is what holds the position", () => {
    // $4 was paid once, then $6 lifted the same song. `applyPurchase` keeps the
    // larger, so refunding the $4 must not move the tape.
    const board = tape([6, 4]);
    const result = applyReversal(board, { trackId: "t1", amount: 4 });

    expect(result.removed).toBe(false);
    expect(result.reason).toContain("$6");
    expect(result.board).toBe(board);
  });

  it("does nothing for a song that is not on the tape", () => {
    const board = tape([5]);
    const result = applyReversal(board, { trackId: "gone", amount: 5 });

    expect(result.removed).toBe(false);
    expect(result.board).toBe(board);
  });

  it("is exactly applyPurchase run backwards", () => {
    const board = tape([5, 4, 3]);
    const bought = applyPurchase(
      board,
      { ...NEW_SONG, amount: 5, position: 2 },
      board.spots[0].raisedAt + 1,
      "s-fresh",
    );
    const reversed = applyReversal(bought.board, {
      trackId: "fresh",
      amount: 5,
    });

    expect(reversed.removed).toBe(true);
    expect(reversed.board.spots).toEqual(board.spots);
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

describe("findSpotByTitle", () => {
  /** A tape with titles worth confusing. */
  function named(titles: string[]): Spot[] {
    return tape(titles.map((_, i) => 5 - i)).spots.map((s, i) => ({
      ...s,
      title: titles[i],
    }));
  }

  it("finds a song by the title someone typed", () => {
    const spots = named(["Blinding Lights", "Shape of You"]);
    expect(findSpotByTitle(spots, "blinding lights")?.trackId).toBe("t1");
  });

  it("ignores case, punctuation and stray spacing", () => {
    const spots = named(["Don't Stop Me Now"]);
    expect(findSpotByTitle(spots, "  dont stop me now  ")?.trackId).toBe("t1");
  });

  it("sees past the suffixes Spotify puts on a title", () => {
    // The tape stores whatever Spotify called it; nobody types that.
    const spots = named([
      "Blinding Lights - Remastered 2021",
      "Levitating (feat. DaBaby)",
    ]);
    expect(findSpotByTitle(spots, "Blinding Lights")?.trackId).toBe("t1");
    expect(findSpotByTitle(spots, "Levitating")?.trackId).toBe("t2");
  });

  it("does not match a song the tape does not have", () => {
    expect(findSpotByTitle(named(["Blinding Lights"]), "Shape of You")).toBeNull();
  });

  it("refuses to match on almost nothing", () => {
    // A one-character query would otherwise land on whatever sorts first.
    const spots = named(["A"]);
    expect(findSpotByTitle(spots, "a")).toBeNull();
    expect(findSpotByTitle(spots, "")).toBeNull();
    expect(findSpotByTitle(spots, "!!!")).toBeNull();
  });

  it("never matches a partial title", () => {
    // Exact after normalising, so "Lights" cannot take a payment to the wrong
    // song's slot.
    const spots = named(["Blinding Lights"]);
    expect(findSpotByTitle(spots, "Lights")).toBeNull();
    expect(findSpotByTitle(spots, "Blinding Lights Extra")).toBeNull();
  });
});
