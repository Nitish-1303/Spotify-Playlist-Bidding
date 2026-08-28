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

async function fetchArtistFromTrackPage(trackId: string): Promise<string | null> {
  try {
    const res = await fetch(spotifyTrackUrl(trackId), {
      headers: { "User-Agent": "Mozilla/5.0 PlaylistBid" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const og = html.match(
      /property="og:description"\s+content="([^"]+)"/i,
    ) || html.match(/content="([^"]+)"\s+property="og:description"/i);
    if (!og?.[1]) return null;
    // Typical: "The Weeknd · Song · After Hours"
    const artist = decodeHTMLEntities(og[1]).split("·")[0]?.trim();
    return artist || null;
  } catch {
    return null;
  }
}

function decodeHTMLEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function fetchTrackMeta(trackId: string): Promise<SpotifyMeta> {
  const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyTrackUrl(trackId))}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Could not load that Spotify track. Paste a track link, not a playlist.");
  }
  const data = (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  const artist =
    data.author_name?.trim() ||
    (await fetchArtistFromTrackPage(trackId)) ||
    "Unknown artist";
  return {
    title: data.title?.trim() || "Unknown track",
    artist,
    thumbnailUrl: data.thumbnail_url || "",
  };
}
