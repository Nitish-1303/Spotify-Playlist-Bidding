import { NextResponse } from "next/server";
import { openRanks, rankOf } from "@/lib/ranks";
import { parseSpotifyTrackId, spotifyTrackUrl } from "@/lib/spotify";
import { fetchTrackMeta } from "@/lib/spotify-api";
import { readBoard } from "@/lib/tape-store";
import { findSpotByTitle } from "@/lib/tape-rules";
import type { BoardState } from "@/lib/types";

/**
 * What a pasted link resolves to, before any money is involved.
 *
 * Read-only and public: everything it answers with is either public Spotify
 * catalogue data or something already on the tape for anyone to see. It decides
 * nothing — the price and the position a payment actually gets are worked out
 * again inside startPurchase, from the tape as it stands at that moment.
 *
 * Its job is to tell the paster the two things they need before paying: what
 * song this is, and whether it is already on the tape.
 */

/**
 * The tape's answer about one song, in the shape the paddle needs.
 *
 * `openPositions` is the same filter the paddle applies and the same rule
 * startPurchase enforces: a song already on the tape can only be bought
 * upwards, because paying to sit lower than you already sit would take money
 * and change nothing.
 */
function tapeState(board: BoardState, trackId: string) {
  const position = rankOf(board.spots, trackId);
  return {
    alreadyOnTape: position !== null,
    position,
    openPositions: openRanks(board.spots, trackId).filter(
      (r) => position === null || r < position,
    ),
  };
}

/**
 * The tape, or an empty one.
 *
 * A metadata lookup must not fail because the store is unreachable: the answer
 * without tape state is still the useful half, and the authoritative duplicate
 * check happens at purchase time regardless of what this said.
 */
async function boardOrEmpty(): Promise<BoardState> {
  try {
    return await readBoard();
  } catch (err) {
    console.error("[track] tape unreadable", err);
    return { spots: [], activity: [], prevRanks: {} };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q =
    searchParams.get("url") ||
    searchParams.get("id") ||
    searchParams.get("q") ||
    "";

  const board = await boardOrEmpty();
  const trackId = parseSpotifyTrackId(q);

  // Not a link. Before refusing, check whether the typed text names a song that
  // is already on the tape — that person is not making a mistake, they are
  // adding something twice, and they deserve to be told which it is.
  if (!trackId) {
    const onTape = findSpotByTitle(board.spots, q);
    if (!onTape) {
      return NextResponse.json(
        { error: "Paste a song link (open.spotify.com/track/…)." },
        { status: 400 },
      );
    }
    // The tape's own stored metadata, which came from this same lookup when the
    // song was bought. No Spotify request is made: the answer is already here.
    return NextResponse.json({
      trackId: onTape.trackId,
      title: onTape.title,
      artist: onTape.artist,
      thumbnailUrl: onTape.thumbnailUrl,
      trackUrl: spotifyTrackUrl(onTape.trackId),
      matchedByTitle: true,
      ...tapeState(board, onTape.trackId),
    });
  }

  try {
    const meta = await fetchTrackMeta(trackId);
    return NextResponse.json({
      trackId,
      ...meta,
      trackUrl: spotifyTrackUrl(trackId),
      ...tapeState(board, trackId),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load that song." },
      { status: 404 },
    );
  }
}
