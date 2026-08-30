import { NextResponse } from "next/server";
import { cleanVisitorId } from "@/lib/stats-store";
import { applyPlay } from "@/lib/tape-rules";
import { claimPlay, withBoard } from "@/lib/tape-store";
import { parseSpotifyTrackId } from "@/lib/spotify";

/**
 * Records a play. Counted on this site only — it has no effect on Spotify
 * charts, playlists or stream counts.
 *
 * One play per visitor per song per hour, so holding down the button cannot
 * inflate a count. Plays never change prices or positions.
 */
export async function POST(request: Request) {
  let body: { trackId?: unknown; visitorId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const trackId = parseSpotifyTrackId(String(body.trackId ?? ""));
  const visitorId = cleanVisitorId(body.visitorId);
  if (!trackId || !visitorId) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (!(await claimPlay(visitorId, trackId))) {
    return NextResponse.json({ counted: false });
  }

  await withBoard((board) => ({
    commit: { board: applyPlay(board, trackId) },
    result: null,
  }));

  return NextResponse.json({ counted: true });
}
