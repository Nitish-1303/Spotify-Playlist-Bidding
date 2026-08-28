"use client";

import { useEffect, useMemo, useState } from "react";
import { BoardRow3D, BoardStage } from "@/components/board-stage";
import { filterSpots, useBoard } from "@/lib/board-context";
import { useDodoCheckout } from "@/lib/dodo-checkout";
import { formatMoney, timeAgo } from "@/lib/format";
import { savePendingBid } from "@/lib/pending-bid";
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
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentsReady, setPaymentsReady] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const { openCheckout } = useDodoCheckout({
    onClosed: () => setBusy(false),
    onError: (message) => {
      setBusy(false);
      setStatus(message);
    },
  });

  useEffect(() => {
    setReady(true);
    setPlayingId((id) => id ?? spots[0]?.trackId ?? null);
  }, [spots]);

  useEffect(() => {
    fetch("/api/bid/checkout")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setPaymentsReady(Boolean(d.configured)))
      .catch(() => setPaymentsReady(false));
  }, []);

  const filtered = useMemo(
    () => filterSpots(spots, genre, time, forSaleOnly),
    [spots, genre, time, forSaleOnly],
  );

  const topThree = spots.slice(0, 3);
  const listedCount = spots.filter((s) => s.askingPrice).length;
  const topBid = spots[0]?.bid ?? 0;

  async function onBid(e: React.FormEvent) {
    e.preventDefault();
    const trackId = parseSpotifyTrackId(url);
    if (!trackId) {
      setStatus("Paste a song link, like open.spotify.com/track/…");
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

      const pending = {
        trackId,
        trackUrl: spotifyTrackUrl(trackId),
        title: meta.title,
        artist: meta.artist || "Unknown artist",
        thumbnailUrl: meta.thumbnailUrl || "",
        genre: selectedGenre,
        bid,
      };

      const checkoutRes = await fetch("/api/bid/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pending,
          email: email.trim() || undefined,
        }),
      });
      const checkout = (await checkoutRes.json()) as {
        demo?: boolean;
        checkout_url?: string;
        error?: string;
        message?: string;
      };

      if (!checkoutRes.ok) {
        throw new Error(checkout.error || "Checkout failed.");
      }

      if (checkout.demo || !checkout.checkout_url) {
        const spot = placeBid(pending);
        setPlayingId(spot.trackId);
        setStatus(`Demo bid placed at $${spot.bid}. Rank is on PlaylistBid only.`);
        return;
      }

      savePendingBid(pending);
      setStatus("Opening checkout…");
      await openCheckout(checkout.checkout_url);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      {/* Top 3 — 3D motion podium */}
      <section className="py-6" aria-labelledby="top-board-heading">
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 id="top-board-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Top of the board
          </h2>
          <p className="hidden text-xs text-[#a7a7a7] sm:block">
            Drag your cursor over cards for 3D tilt
          </p>
        </div>
        <BoardStage
          topThree={topThree}
          ready={ready}
          onPlay={(trackId) => setPlayingId(trackId)}
          onOpen={(id) => registerClick(id)}
        />
      </section>

      {/* 3. Bid form */}
      <section className="mb-10">
        <form onSubmit={onBid} className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Place a bid</h2>
            <span className="text-xs text-[#a7a7a7]">
              #1 is {formatMoney(topBid)} · {paymentsReady ? "Paid checkout" : "Demo mode"}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
            <div className="min-w-0">
              <label className="label">Song link</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://open.spotify.com/track/…"
                className="field"
              />
            </div>
            <div>
              <label className="label">Bid</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#242424] text-lg hover:bg-[#2a2a2a]"
                  onClick={() => setBid((n) => Math.max(1, n - 1))}
                  aria-label="Decrease bid"
                >
                  −
                </button>
                <span className="min-w-14 text-center text-xl font-bold tabular-nums">
                  {formatMoney(bid)}
                </span>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#242424] text-lg hover:bg-[#2a2a2a]"
                  onClick={() => setBid((n) => n + 1)}
                  aria-label="Increase bid"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="label">Genre</label>
              <select
                value={selectedGenre}
                onChange={(e) =>
                  setSelectedGenre(e.target.value as Exclude<Genre, "All">)
                }
                className="field min-w-32"
              >
                {GENRES.filter((g) => g !== "All").map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <button className="primary-btn h-11 px-6 text-sm" disabled={busy}>
              {busy
                ? "Starting…"
                : paymentsReady
                  ? `Pay ${formatMoney(bid)}`
                  : `Bid ${formatMoney(bid)}`}
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Receipt email"
                className="field"
              />
            </div>
            <p className="self-end text-xs text-[#a7a7a7] sm:pb-3">
              Same link again raises your existing bid.
            </p>
          </div>
          {status && (
            <p className="mt-3 rounded-lg bg-[#242424] px-3 py-2 text-sm text-[#b3b3b3]">
              {status}
            </p>
          )}
        </form>
      </section>

      {/* 4. Now playing */}
      {playingId && (
        <section className="mb-10">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Now playing</h2>
            <span className="text-xs text-[#a7a7a7]">Official Spotify player</span>
          </div>
          <iframe
            title="Official Spotify player"
            src={spotifyEmbedUrl(playingId)}
            width="100%"
            height="152"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="overflow-hidden rounded-xl"
          />
        </section>
      )}

      {/* 5. Full leaderboard */}
      <section id="board">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Leaderboard</h2>
            <p className="mt-1 text-sm text-[#a7a7a7]">
              {filtered.length} of {spots.length} songs
            </p>
          </div>
          <div className="flex flex-wrap gap-1 text-sm">
            {(
              [
                ["all", "All time"],
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["month", "This month"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTime(key)}
                className={`rounded-full px-3 py-1 ${
                  time === key ? "bg-[#242424] text-white" : "text-[#a7a7a7] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={`chip ${genre === g ? "chip-active" : ""}`}
            >
              {g}
            </button>
          ))}
          {listedCount > 0 && (
            <button
              type="button"
              onClick={() => setForSaleOnly((v) => !v)}
              className={`chip ${forSaleOnly ? "chip-active" : ""}`}
            >
              For sale · {listedCount}
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
          <ol className="board-list-3d">
            {filtered.map((spot, index) => (
              <BoardRow3D
                key={spot.id}
                spot={spot}
                rank={index + 1}
                ready={ready}
                index={index}
                onPlay={() => setPlayingId(spot.trackId)}
                onOpen={() => registerClick(spot.id)}
                onList={() => {
                  const next = window.prompt(
                    "Asking price to list this board spot (this site only)",
                    String(spot.askingPrice ?? spot.bid * 3),
                  );
                  if (!next) return;
                  const n = Number(next);
                  if (Number.isFinite(n) && n > 0) listForSale(spot.trackId, n);
                }}
              />
            ))}
            {filtered.length === 0 && (
              <li className="card px-4 py-10 text-center text-sm text-[#a7a7a7]">
                No songs match these filters.
              </li>
            )}
          </ol>

          <aside className="card h-fit p-4">
            <h2 className="mb-3 text-sm font-bold">Recent bids</h2>
            <ul>
              {activity.slice(0, 8).map((item) => (
                <li
                  key={item.id}
                  className="border-b border-white/6 py-2.5 last:border-0"
                >
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[#a7a7a7]">
                    {formatMoney(item.bid)}
                    {ready ? ` · ${timeAgo(item.at)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
