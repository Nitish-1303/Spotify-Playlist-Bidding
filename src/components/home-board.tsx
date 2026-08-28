"use client";

import { useEffect, useMemo, useState } from "react";
import { filterSpots, useBoard } from "@/lib/board-context";
import { formatMoney, timeAgo } from "@/lib/format";
import { parseSpotifyTrackId, spotifyEmbedUrl, spotifyTrackUrl } from "@/lib/spotify";
import { GENRES, type Genre, type TimeFilter } from "@/lib/types";

export function HomeBoard() {
  const { spots, activity, placeBid, registerClick, listForSale } = useBoard();
  const [genre, setGenre] = useState<Genre>("All");
  const [time, setTime] = useState<TimeFilter>("all");
  const [forSaleOnly, setForSaleOnly] = useState(false);
  const [url, setUrl] = useState("");
  const [bid, setBid] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState<Exclude<Genre, "All">>("Pop");
  const [asking, setAsking] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    setPlayingId((id) => id ?? spots[0]?.trackId ?? null);
  }, [spots]);

  const filtered = useMemo(
    () => filterSpots(spots, genre, time, forSaleOnly),
    [spots, genre, time, forSaleOnly],
  );

  const topBid = spots[0]?.bid ?? 0;
  const claimPrice = Math.max(1, topBid + 1);

  async function onBid(e: React.FormEvent) {
    e.preventDefault();
    const trackId = parseSpotifyTrackId(url);
    if (!trackId) {
      setStatus("Paste a Spotify song link, like open.spotify.com/track/…");
      return;
    }
    if (bid < 1) {
      setStatus("Bids start at $1.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/track?id=${encodeURIComponent(trackId)}`);
      const meta = (await res.json()) as {
        title?: string;
        artist?: string;
        thumbnailUrl?: string;
        error?: string;
      };
      if (!res.ok || !meta.title) throw new Error(meta.error || "Could not load that song.");
      const askingPrice = asking ? Number(asking) : undefined;
      const spot = placeBid({
        trackId,
        trackUrl: spotifyTrackUrl(trackId),
        title: meta.title,
        artist: meta.artist || "Unknown artist",
        thumbnailUrl: meta.thumbnailUrl || "",
        genre: selectedGenre,
        bid,
        askingPrice: Number.isFinite(askingPrice) ? askingPrice : undefined,
      });
      setPlayingId(spot.trackId);
      setStatus(`You’re on the board at $${spot.bid}. Rank updates instantly.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not load that song.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="noise mx-auto max-w-6xl px-4 pb-16">
      <section className="flex flex-col gap-8 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-medium tracking-wide text-[#1ed760]">
            Bid for the #1 song.
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Get your favorite Spotify track heard.
          </h1>
          <p className="mt-4 text-[#b7bdc0]">
            The competitive song billboard. Paste a Spotify track, outbid the
            competition, and capture the plays. No accounts. Songs only — not
            playlists.
          </p>
        </div>
        <form onSubmit={onBid} className="card w-full max-w-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-[#9aa0a6]">Claim #1 for</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-white/15"
                onClick={() => setBid((n) => Math.max(1, n - 1))}
              >
                −
              </button>
              <b className="min-w-8 text-center text-2xl">{bid}</b>
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-white/15"
                onClick={() => setBid((n) => n + 1)}
              >
                +
              </button>
            </div>
          </div>
          <p className="mb-4 text-xs text-[#9aa0a6]">
            New songs start at $1. Paying less than #1 still puts you on the
            board at whatever rank that bid earns.
          </p>
          <label className="mb-1 block text-xs text-[#9aa0a6]">
            Spotify song URL
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/track/…"
            className="mb-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none ring-[#1ed760] focus:ring-2"
          />
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[#9aa0a6]">Genre</label>
              <select
                value={selectedGenre}
                onChange={(e) =>
                  setSelectedGenre(e.target.value as Exclude<Genre, "All">)
                }
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3"
              >
                {GENRES.filter((g) => g !== "All").map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#9aa0a6]">
                List this spot for sale
              </label>
              <input
                value={asking}
                onChange={(e) => setAsking(e.target.value)}
                placeholder="Asking price (optional)"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3"
              />
            </div>
          </div>
          <button className="green-btn w-full py-3" disabled={busy}>
            {busy ? "Looking up track…" : `Outbid for #1 · ${formatMoney(claimPrice)}`}
          </button>
          {status && <p className="mt-3 text-sm text-[#c9d4cc]">{status}</p>}
          <p className="mt-3 text-xs text-[#9aa0a6]">
            Already on the list? Paste the same song link and raise your bid.
          </p>
        </form>
      </section>

      {playingId && (
        <section className="mb-10 overflow-hidden rounded-2xl border border-white/8">
          <iframe
            title="Spotify player"
            src={spotifyEmbedUrl(playingId)}
            width="100%"
            height="152"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </section>
      )}

      <section id="categories" className="mb-6 flex flex-wrap gap-2">
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              genre === g
                ? "bg-[#1ed760] text-[#04140a]"
                : "border border-white/10 text-[#c7ccc9]"
            }`}
          >
            {g}
          </button>
        ))}
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        {(
          [
            ["all", "All Time"],
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["month", "1 Month"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTime(key)}
            className={time === key ? "text-white" : "text-[#9aa0a6]"}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setForSaleOnly((v) => !v)}
          className={`ml-auto rounded-full px-3 py-1 ${
            forSaleOnly ? "bg-[#1ed760] text-[#04140a]" : "border border-white/10"
          }`}
        >
          For Sale {spots.filter((s) => s.askingPrice).length}
        </button>
      </div>

      <p className="mb-4 text-sm text-[#9aa0a6]">
        Showing {filtered.length} of {spots.length} songs
      </p>

      <div id="board" className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <ol className="space-y-3">
          {filtered.map((spot, index) => {
            const rank = index + 1;
            const claimFor = spot.bid + 1;
            return (
              <li key={spot.id} className="card p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className="self-start rounded-full border border-white/12 px-3 py-1 text-xs text-[#9aa0a6]"
                    onClick={() => {
                      setBid(claimFor);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Claim this rank for {formatMoney(claimFor)}
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="w-8 text-lg font-semibold text-[#9aa0a6]">
                      #{rank}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPlayingId(spot.trackId)}
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-white/5"
                    >
                      {spot.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={spot.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full place-items-center">♪</span>
                      )}
                    </button>
                    <div className="min-w-0">
                      <a
                        href={spot.trackUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => registerClick(spot.id)}
                        className="block truncate font-medium hover:underline"
                      >
                        {spot.title}
                      </a>
                      <p className="truncate text-sm text-[#9aa0a6]">{spot.artist}</p>
                      <p className="mt-1 text-xs text-[#9aa0a6]">
                        {spot.genre} · {spot.clicks} plays
                        {ready ? ` · Raised ${timeAgo(spot.raisedAt)}` : ""}
                        {spot.askingPrice ? ` · For sale ${formatMoney(spot.askingPrice)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold">{formatMoney(spot.bid)}</div>
                    <button
                      type="button"
                      className="text-xs text-[#1ed760]"
                      onClick={() => {
                        const next = window.prompt(
                          "Asking price to list this spot",
                          String(spot.askingPrice ?? spot.bid * 3),
                        );
                        if (!next) return;
                        const n = Number(next);
                        if (Number.isFinite(n) && n > 0) listForSale(spot.trackId, n);
                      }}
                    >
                      List for sale
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="card p-8 text-center text-[#9aa0a6]">
              No songs match those filters yet. Be the first to bid.
            </li>
          )}
        </ol>

        <aside className="card h-fit p-4">
          <h2 className="mb-3 text-sm font-semibold">Live Bids & Updates</h2>
          <ul className="space-y-3">
            {activity.slice(0, 12).map((item) => (
              <li key={item.id} className="border-b border-white/6 pb-3 last:border-0">
                <p className="truncate text-sm">{item.title}</p>
                <p className="truncate text-xs text-[#9aa0a6]">{item.artist}</p>
                <p className="mt-1 text-xs text-[#9aa0a6]">
                  {formatMoney(item.bid)}
                  {ready ? ` · ${timeAgo(item.at)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
