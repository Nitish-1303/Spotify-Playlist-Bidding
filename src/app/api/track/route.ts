import { NextResponse } from "next/server";
import { fetchTrackMeta, parseSpotifyTrackId } from "@/lib/spotify";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("url") || searchParams.get("id") || "";
  const trackId = parseSpotifyTrackId(q);
  if (!trackId) {
    return NextResponse.json(
      { error: "Paste a song link (open.spotify.com/track/…)." },
      { status: 400 },
    );
  }
  try {
    const meta = await fetchTrackMeta(trackId);
    return NextResponse.json({ trackId, ...meta });
  } catch {
    return NextResponse.json(
      { error: "Could not load that song." },
      { status: 404 },
    );
  }
}
