const TRACK_PATTERNS = [
  /open\.spotify\.com\/(?:intl-\w+\/)?track\/([A-Za-z0-9]+)/i,
  /spotify:track:([A-Za-z0-9]+)/i,
];

export function parseSpotifyTrackId(input: string): string | null {
  const trimmed = input.trim();
  for (const pattern of TRACK_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

export function spotifyTrackUrl(trackId: string) {
  return `https://open.spotify.com/track/${trackId}`;
}

export function spotifyEmbedUrl(trackId: string) {
  return `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
}

export type SpotifyMeta = {
  title: string;
  artist: string;
  thumbnailUrl: string;
};

/** Public oEmbed only — no page scraping. Playback stays in Spotify’s official embed. */
export async function fetchTrackMeta(trackId: string): Promise<SpotifyMeta> {
  const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyTrackUrl(trackId))}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Could not load that track. Paste a song link, not a playlist.");
  }
  const data = (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  return {
    title: data.title?.trim() || "Unknown track",
    artist: data.author_name?.trim() || "Unknown artist",
    thumbnailUrl: data.thumbnail_url || "",
  };
}
