/**
 * Pure link helpers, safe in a client bundle.
 *
 * Anything that talks to Spotify — and therefore reads credentials — lives in
 * ./spotify-api instead. Client components import from here.
 */

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
