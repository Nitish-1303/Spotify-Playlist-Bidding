import { NextResponse } from "next/server";
import { boardIsDurable, readBoard } from "@/lib/tape-store";
import type { Spot } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Projected field by field rather than spread, so a private field added to the
 * stored record later cannot leak onto the public tape by accident.
 */
function publicSpot(spot: Spot) {
  return {
    id: spot.id,
    trackId: spot.trackId,
    trackUrl: spot.trackUrl,
    title: spot.title,
    artist: spot.artist,
    thumbnailUrl: spot.thumbnailUrl,
    bid: spot.bid,
    clicks: spot.clicks,
    raisedAt: spot.raisedAt,
  };
}

/**
 * The tape, as everyone sees it. Public by design: positions, songs, the price
 * holding each slot, plays, and when each last moved. No buyers, no payment ids,
 * no transaction data — those live behind the owner-token endpoint.
 */
export async function GET() {
  const board = await readBoard();
  return NextResponse.json(
    {
      spots: board.spots.map(publicSpot),
      activity: board.activity,
      prevRanks: board.prevRanks,
      durable: boardIsDurable(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
