import { spotifyTrackUrl } from "./spotify";

/**
 * Track lookup against Spotify's public catalogue. Server-only: this module
 * reads SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET, so it must never be
 * imported from a "use client" component. The pure helpers that client
 * components do need — parseSpotifyTrackId, spotifyTrackUrl, spotifyEmbedUrl —
 * stay in ./spotify, which is why this is a separate file at all.
 */

export type SpotifyMeta = {
  title: string;
  artist: string;
  thumbnailUrl: string;
};

/* —— Web API, client credentials ——
 *
 * oEmbed answers with a title and a cover and nothing else: there is no artist
 * field in the response at all, which is why every song bought here used to
 * land on the tape as "Unknown artist". The Web API's track endpoint does carry
 * the artist, and client credentials are enough to read it — this is public
 * catalogue data, so no listener ever logs in and no listener's account is
 * touched.
 *
 * Enrichment, not a dependency. Missing credentials, a refused token, a slow
 * response or a rate limit all fall through to oEmbed below, because a song
 * must not fail to go on the tape over a missing artist name — the payment has
 * already been taken by then.
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

/** Cached per server instance. Spotify's tokens last an hour. */
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * A 403 from the catalogue is about the app, not the track: Spotify answers
 * "Active premium subscription required for the owner of the app" to every
 * /v1 read when the account that owns the credentials is not Premium. Retrying
 * it per lookup would spend a round trip on a refusal that cannot change
 * within the request, so it is parked for a while and oEmbed answers instead.
 */
let webApiBlockedUntil = 0;
const WEB_API_COOLDOWN_MS = 10 * 60_000;

function webApiConfigured() {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET,
  );
}

/** Drops the cached token. Exported for tests, which run several cases in one process. */
export function resetSpotifyToken() {
  cachedToken = null;
  webApiBlockedUntil = 0;
}

async function accessToken(): Promise<string | null> {
  if (!webApiConfigured()) return null;
  // A minute of slack, so a token that expires mid-flight is never the one sent.
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.value;
  }

  const basic = btoa(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  );
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!res.ok) {
      // The status, never the body: a token error can echo the credentials back.
      console.error("[spotify] token refused", res.status);
      return null;
    }
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return null;
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return cachedToken.value;
  } catch (err) {
    console.error("[spotify] token unreachable", err);
    return null;
  }
}

/** Largest under 400px if there is one — the covers render at 96px at most. */
function pickCover(images: { url?: string; width?: number }[] | undefined) {
  const usable = (images ?? []).filter((i) => i.url);
  if (usable.length === 0) return "";
  const small = usable
    .filter((i) => (i.width ?? 0) > 0 && (i.width ?? 0) <= 400)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return (small ?? usable[0]).url ?? "";
}

async function fetchFromWebApi(trackId: string): Promise<SpotifyMeta | null> {
  if (Date.now() < webApiBlockedUntil) return null;

  const token = await accessToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/tracks/${encodeURIComponent(trackId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      // 401 means the cached token died early. Drop it so the next caller gets
      // a fresh one rather than repeating the same failure for the full hour.
      if (res.status === 401) cachedToken = null;
      if (res.status === 403) webApiBlockedUntil = Date.now() + WEB_API_COOLDOWN_MS;
      // Logged, because the fallback is silent by design: without this line an
      // app whose credentials are refused for every track looks identical to
      // one with no credentials at all — every song simply arrives with no
      // artist and nothing says why.
      console.error("[spotify] track lookup refused", res.status);
      return null;
    }
    const data = (await res.json()) as {
      name?: string;
      artists?: { name?: string }[];
      album?: { images?: { url?: string; width?: number }[] };
    };

    const artist = (data.artists ?? [])
      .map((a) => a.name?.trim())
      .filter(Boolean)
      .join(", ");
    if (!data.name || !artist) return null;

    return {
      title: data.name.trim(),
      artist,
      thumbnailUrl: pickCover(data.album?.images),
    };
  } catch (err) {
    console.error("[spotify] track lookup failed", err);
    return null;
  }
}

/**
 * Title, artist and cover for a track id.
 *
 * The Web API answers when it is configured and reachable. oEmbed is the
 * fallback and stays the arbiter of whether a link is a real track: it is what
 * turns a mistyped id into the message the payer reads. When neither knows the
 * artist the field comes back empty rather than filled with a guess, and the
 * interface then prints the title alone.
 *
 * No page is scraped either way, and playback stays in Spotify's own embed.
 */
export async function fetchTrackMeta(trackId: string): Promise<SpotifyMeta> {
  const rich = await fetchFromWebApi(trackId);
  if (rich) return rich;

  const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyTrackUrl(trackId))}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      "Could not load that track. Paste a song link, not a playlist.",
    );
  }
  const data = (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  return {
    title: data.title?.trim() || "Unknown track",
    artist: data.author_name?.trim() || "",
    thumbnailUrl: data.thumbnail_url || "",
  };
}
