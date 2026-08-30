import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artistLine } from "@/lib/format";
import { fetchTrackMeta, resetSpotifyToken } from "@/lib/spotify-api";

/**
 * The track lookup: Web API first for the artist, oEmbed as the fallback.
 *
 * Every case here drives `fetch` directly rather than reaching the network, so
 * the suite asserts the branching — which endpoint is asked, with which
 * credentials, and what happens when one of them says no — not Spotify's
 * current catalogue.
 */

const TRACK = "4cOdK2wGLETKBW3PvgPWqT";

function tokenOk(expiresIn = 3600) {
  return new Response(
    JSON.stringify({ access_token: "tok-abc", expires_in: expiresIn }),
    { status: 200 },
  );
}

function trackOk(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function oembedOk(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

const FULL_TRACK = {
  name: "Never Gonna Give You Up",
  artists: [{ name: "Rick Astley" }],
  album: {
    images: [
      { url: "https://i.scdn.co/image/big", width: 640 },
      { url: "https://i.scdn.co/image/mid", width: 300 },
      { url: "https://i.scdn.co/image/tiny", width: 64 },
    ],
  },
};

/** Answers by URL, so a test never depends on call order. */
function routeFetch(
  handlers: Partial<{
    token: () => Response;
    track: () => Response;
    oembed: () => Response;
  }>,
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("accounts.spotify.com")) {
      if (!handlers.token) throw new Error(`unexpected token call: ${url}`);
      return handlers.token();
    }
    if (url.includes("api.spotify.com")) {
      if (!handlers.track) throw new Error(`unexpected track call: ${url}`);
      return handlers.track();
    }
    if (url.includes("oembed")) {
      if (!handlers.oembed) throw new Error(`unexpected oembed call: ${url}`);
      return handlers.oembed();
    }
    throw new Error(`unrouted fetch: ${url}`);
  });
}

let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetSpotifyToken();
  process.env.SPOTIFY_CLIENT_ID = "id-123";
  process.env.SPOTIFY_CLIENT_SECRET = "secret-456";
  // The lookup logs its own failures; the suite exercises them on purpose.
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  errors.mockRestore();
  vi.unstubAllGlobals();
});

describe("fetchTrackMeta — Web API path", () => {
  it("takes title, artist and cover from the track endpoint", async () => {
    const fetchMock = routeFetch({
      token: tokenOk,
      track: () => trackOk(FULL_TRACK),
    });
    vi.stubGlobal("fetch", fetchMock);

    const meta = await fetchTrackMeta(TRACK);

    expect(meta).toEqual({
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      // Largest at or under 400px: the covers never render bigger than 96px.
      thumbnailUrl: "https://i.scdn.co/image/mid",
    });
    // oEmbed is never asked when the Web API answers.
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).includes("oembed")),
    ).toHaveLength(0);
  });

  it("asks for a token with basic auth over the client credentials", async () => {
    const fetchMock = routeFetch({
      token: tokenOk,
      track: () => trackOk(FULL_TRACK),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchTrackMeta(TRACK);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://accounts.spotify.com/api/token");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("grant_type=client_credentials");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${btoa("id-123:secret-456")}`,
    );
  });

  it("joins every credited artist", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        token: tokenOk,
        track: () =>
          trackOk({
            ...FULL_TRACK,
            artists: [{ name: "Lorde" }, { name: "Jack Antonoff" }],
          }),
      }),
    );

    const meta = await fetchTrackMeta(TRACK);
    expect(meta.artist).toBe("Lorde, Jack Antonoff");
  });

  it("reuses the token across lookups", async () => {
    const fetchMock = routeFetch({
      token: tokenOk,
      track: () => trackOk(FULL_TRACK),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchTrackMeta(TRACK);
    await fetchTrackMeta(TRACK);

    const tokenCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("accounts.spotify.com"),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it("does not send a token that is about to expire", async () => {
    // Inside the minute of slack, so the second lookup refreshes.
    const fetchMock = routeFetch({
      token: () => tokenOk(30),
      track: () => trackOk(FULL_TRACK),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchTrackMeta(TRACK);
    await fetchTrackMeta(TRACK);

    const tokenCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("accounts.spotify.com"),
    );
    expect(tokenCalls).toHaveLength(2);
  });

  it("drops the cached token when the track endpoint says 401", async () => {
    let trackCalls = 0;
    const fetchMock = routeFetch({
      token: tokenOk,
      track: () => {
        trackCalls += 1;
        return trackCalls === 1
          ? new Response("no", { status: 401 })
          : trackOk(FULL_TRACK);
      },
      oembed: () =>
        oembedOk({ title: "Fallback", thumbnail_url: "https://i.scdn.co/x" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // First lookup: 401, falls back to oEmbed.
    await fetchTrackMeta(TRACK);
    // Second: a fresh token rather than an hour of repeating the same failure.
    const meta = await fetchTrackMeta(TRACK);

    expect(meta.artist).toBe("Rick Astley");
    const tokenCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("accounts.spotify.com"),
    );
    expect(tokenCalls).toHaveLength(2);
  });
});

describe("fetchTrackMeta — oEmbed fallback", () => {
  it("falls back when no credentials are configured", async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    const fetchMock = routeFetch({
      oembed: () =>
        oembedOk({
          title: "Song Without An Artist",
          thumbnail_url: "https://i.scdn.co/image/oembed",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const meta = await fetchTrackMeta(TRACK);

    expect(meta).toEqual({
      title: "Song Without An Artist",
      // oEmbed has no artist field, so the field is empty rather than a guess.
      artist: "",
      thumbnailUrl: "https://i.scdn.co/image/oembed",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back when the token is refused", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        token: () => new Response("nope", { status: 400 }),
        oembed: () => oembedOk({ title: "Still Works", thumbnail_url: "" }),
      }),
    );

    const meta = await fetchTrackMeta(TRACK);
    expect(meta.title).toBe("Still Works");
    expect(meta.artist).toBe("");
  });

  it("falls back when the token request throws", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        token: () => {
          throw new Error("offline");
        },
        oembed: () => oembedOk({ title: "Still Works", thumbnail_url: "" }),
      }),
    );

    const meta = await fetchTrackMeta(TRACK);
    expect(meta.title).toBe("Still Works");
  });

  it("falls back when the track endpoint is rate limited", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        token: tokenOk,
        track: () => new Response("slow down", { status: 429 }),
        oembed: () => oembedOk({ title: "Rate Limited", thumbnail_url: "" }),
      }),
    );

    const meta = await fetchTrackMeta(TRACK);
    expect(meta.title).toBe("Rate Limited");
  });

  it("falls back when the track payload carries no artist", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        token: tokenOk,
        track: () => trackOk({ name: "Untitled", artists: [] }),
        oembed: () => oembedOk({ title: "From oEmbed", thumbnail_url: "" }),
      }),
    );

    const meta = await fetchTrackMeta(TRACK);
    expect(meta.title).toBe("From oEmbed");
  });

  it("stops asking after a 403, which is about the app and not the track", async () => {
    // Spotify answers 403 "Active premium subscription required for the owner
    // of the app" to every catalogue read when the account behind the
    // credentials is not Premium. Nothing about a second lookup changes that,
    // so the second one must not spend a round trip discovering it again.
    const fetchMock = routeFetch({
      token: tokenOk,
      track: () =>
        new Response("Active premium subscription required", { status: 403 }),
      oembed: () => oembedOk({ title: "From oEmbed", thumbnail_url: "" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect((await fetchTrackMeta(TRACK)).title).toBe("From oEmbed");
    expect((await fetchTrackMeta(TRACK)).title).toBe("From oEmbed");

    const apiCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("api.spotify.com"),
    );
    expect(apiCalls).toHaveLength(1);
    // And the refusal is visible rather than silent: without a log line an app
    // whose credentials are refused looks exactly like one with none.
    expect(errors).toHaveBeenCalledWith("[spotify] track lookup refused", 403);
  });

  it("still refuses a link that is not a track", async () => {
    // oEmbed remains the arbiter: this is the error the payer reads.
    vi.stubGlobal(
      "fetch",
      routeFetch({
        token: tokenOk,
        track: () => new Response("gone", { status: 404 }),
        oembed: () => new Response("not found", { status: 404 }),
      }),
    );

    await expect(fetchTrackMeta(TRACK)).rejects.toThrow(
      /Paste a song link, not a playlist/,
    );
  });
});

describe("artistLine", () => {
  it("prints a real artist unchanged", () => {
    expect(artistLine("Rick Astley")).toBe("Rick Astley");
  });

  it("trims stray whitespace", () => {
    expect(artistLine("  Lorde  ")).toBe("Lorde");
  });

  it("treats an empty artist as nothing to print", () => {
    expect(artistLine("")).toBeNull();
    expect(artistLine("   ")).toBeNull();
    expect(artistLine(undefined)).toBeNull();
    expect(artistLine(null)).toBeNull();
  });

  it("treats the legacy 'Unknown artist' label as nothing to print", () => {
    // Songs bought before this lookup existed are on the tape for good.
    expect(artistLine("Unknown artist")).toBeNull();
    expect(artistLine("unknown ARTIST")).toBeNull();
  });
});
