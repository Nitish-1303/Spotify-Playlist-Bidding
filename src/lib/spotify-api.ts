import { spotifyEmbedUrl, spotifyTrackUrl } from "./spotify";

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

/* —— Why there are two failures and not one ——
 *
 * A lookup can fail for two completely different reasons, and telling them
 * apart is the difference between an honest refusal and a lost sale:
 *
 *   TrackNotFoundError    — Spotify says there is no track at that link. The
 *                           paster made a mistake; retrying cannot fix it.
 *   SpotifyUnavailableError — Spotify did not answer properly. The link may be
 *                           perfectly good and the same request may work in a
 *                           second. Nothing about it is the payer's fault.
 *
 * Before this distinction existed both came back as one error, and a single
 * flaky response from a public endpoint we do not control read to the buyer as
 * "Unable to start payment" on a link that was fine.
 */

/** Spotify has no track at that link. Permanent. */
export class TrackNotFoundError extends Error {
  constructor() {
    super("Could not load that track. Paste a song link, not a playlist.");
    this.name = "TrackNotFoundError";
  }
}

/** Spotify did not answer. Transient — the same link may work shortly. */
export class SpotifyUnavailableError extends Error {
  constructor() {
    super("Spotify did not answer. Please try again in a moment.");
    this.name = "SpotifyUnavailableError";
  }
}

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

/* —— The embed page, for the artist neither of the others can give ——
 *
 * The Web API is the official source and answers whenever it can. It cannot
 * always: Spotify refuses every /v1 catalogue read with 403 unless the account
 * that owns the credentials holds Premium. oEmbed, the documented public
 * endpoint, has no artist field at all. Between them that leaves a tape where
 * whether a song shows its artist depends on somebody's subscription, which is
 * not a difference a visitor should ever be able to see.
 *
 * So the last resort is the document Spotify already serves to this site on
 * every row: open.spotify.com/embed/track/…, the player iframe's own page. Its
 * bootstrap JSON carries the artist. It is fetched exactly as a browser fetches
 * it, nothing private is read, and no listener is authenticated.
 *
 * Undocumented, which is why it sits last and why every failure here is silent.
 * A page whose shape has changed means no artist — the same state as before
 * this function existed — and never a song that cannot go on the tape.
 */
async function fetchArtistFromEmbed(trackId: string): Promise<string> {
  try {
    const res = await fetch(spotifyEmbedUrl(trackId), { cache: "no-store" });
    if (!res.ok) return "";

    const html = await res.text();
    const bootstrap = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
    );
    if (!bootstrap) return "";

    const data = JSON.parse(bootstrap[1]) as {
      props?: {
        pageProps?: {
          state?: { data?: { entity?: { artists?: { name?: string }[] } } };
        };
      };
    };

    return (data.props?.pageProps?.state?.data?.entity?.artists ?? [])
      .map((a) => a.name?.trim())
      .filter(Boolean)
      .join(", ");
  } catch (err) {
    console.error("[spotify] embed artist lookup failed", err);
    return "";
  }
}

/**
 * Title and cover from the documented public endpoint.
 *
 * Also the arbiter of whether a link is a real track at all: this is the one
 * that turns a mistyped id into the message the payer reads, which is why it
 * throws where the other two return nothing.
 *
 * A refusal (404) is final and thrown at once — the link is wrong and a second
 * ask would only be slower. Anything else, a rate limit or a bad gateway or a
 * socket that never opened, is retried once after a short pause, because this
 * endpoint is public, unauthenticated, shared by everyone on the platform's
 * egress addresses, and occasionally just does not answer. One retry is the
 * whole budget: a checkout is waiting on this, and a second failure is a real
 * outage rather than a blip.
 */
const OEMBED_ATTEMPTS = 2;
const OEMBED_RETRY_MS = 250;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function fetchFromOembed(trackId: string): Promise<SpotifyMeta> {
  const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyTrackUrl(trackId))}`;

  // Why the last failure is carried rather than logged where it happens: a first
  // attempt that fails and a second that succeeds is not an error, and should not
  // read like one in the log.
  let last = "";

  for (let attempt = 1; attempt <= OEMBED_ATTEMPTS; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      last = `unreachable: ${err instanceof Error ? err.message : String(err)}`;
      if (attempt < OEMBED_ATTEMPTS) await sleep(OEMBED_RETRY_MS);
      continue;
    }

    // 400 and 404 are both Spotify's way of saying "that is not a track of
    // mine". Neither improves on a second ask.
    if (res.status === 400 || res.status === 404) throw new TrackNotFoundError();

    if (!res.ok) {
      last = `HTTP ${res.status}`;
      if (attempt < OEMBED_ATTEMPTS) await sleep(OEMBED_RETRY_MS);
      continue;
    }

    try {
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
    } catch (err) {
      // A 200 carrying something that is not JSON is the shape of a captive
      // portal or an error page, so it belongs with the transient failures.
      last = `unreadable body: ${err instanceof Error ? err.message : String(err)}`;
      if (attempt < OEMBED_ATTEMPTS) await sleep(OEMBED_RETRY_MS);
    }
  }

  console.error(
    `[spotify] oembed unavailable after ${OEMBED_ATTEMPTS} attempts — ${last}`,
  );
  throw new SpotifyUnavailableError();
}

/**
 * Title, artist and cover for a track id.
 *
 * Three sources, in descending order of how official they are: the Web API
 * when it is configured and permitted, then oEmbed for the title and the cover,
 * then the embed page for the artist oEmbed does not carry. Whichever way the
 * answer is assembled, an artist that nothing knows comes back empty rather
 * than guessed at, and the interface prints the title alone.
 *
 * A missing artist can never fail a lookup. By the time this runs during a
 * purchase the payment is already being taken, so the only failure it is
 * allowed to report is a link that is not a track.
 */
export async function fetchTrackMeta(trackId: string): Promise<SpotifyMeta> {
  const official = await fetchFromWebApi(trackId);
  if (official) return official;

  // Concurrent on purpose. oEmbed never carries an artist, so the embed page is
  // not a retry after a miss — it is the other half of one answer, and asking
  // for both at once keeps a lookup at a single round trip's latency.
  const [meta, embedArtist] = await Promise.all([
    fetchFromOembed(trackId),
    fetchArtistFromEmbed(trackId),
  ]);

  return { ...meta, artist: meta.artist || embedArtist };
}
