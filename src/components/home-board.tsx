"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoardStage } from "@/components/board-stage";
import { LeaderboardCard } from "@/components/leaderboard-card";
import { filterSpots, useBoard } from "@/lib/board-context";
import { formatMoney, timeAgo } from "@/lib/format";
import {
  bidToInr,
  formatInr,
  paymentCheckoutUrl,
  type PaymentMethod,
} from "@/lib/payments";
import {
  clearPendingBid,
  readPendingBid,
  savePendingBid,
  type PendingBid,
} from "@/lib/pending-bid";
import { UPI_ID, USD_TO_INR } from "@/lib/site";
import { parseSpotifyTrackId, spotifyEmbedUrl, spotifyTrackUrl } from "@/lib/spotify";
import { GENRES, type Genre, type TimeFilter } from "@/lib/types";

const PAGE_SIZE = 20;

export function HomeBoard() {
  const { spots, activity, placeBid, registerClick, online } = useBoard();
  const [genre, setGenre] = useState<Genre>("All");
  const [time, setTime] = useState<TimeFilter>("all");
  const [url, setUrl] = useState("");
  const [bid, setBid] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState<Exclude<Genre, "All">>("Pop");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingBid | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("paypal");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);
  const claimFormRef = useRef<HTMLFormElement>(null);
  const bidInitialized = useRef(false);
  const inrAmount = bidToInr(bid);

  const topBid = spots[0]?.bid ?? 0;
  const claimDefault = Math.max(1, topBid + 1);

  useEffect(() => {
    setReady(true);
    setPlayingId((id) => id ?? spots[0]?.trackId ?? null);
    setPending(readPendingBid());
  }, [spots]);

  useEffect(() => {
    if (!ready || bidInitialized.current) return;
    setBid(claimDefault);
    bidInitialized.current = true;
  }, [ready, claimDefault]);

  useEffect(() => {
    setPage(1);
  }, [genre, time]);

  const filtered = useMemo(
    () => filterSpots(spots, genre, time),
    [spots, genre, time],
  );

  const todayTop = useMemo(
    () => filterSpots(spots, "All", "today").slice(0, 3),
    [spots],
  );
  const weekTop = useMemo(
    () => filterSpots(spots, "All", "week").slice(0, 3),
    [spots],
  );

  const genreTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of GENRES) {
      if (g === "All") continue;
      map.set(g, 0);
    }
    let all = 0;
    for (const s of spots) {
      all += s.bid;
      map.set(s.genre, (map.get(s.genre) ?? 0) + s.bid);
    }
    return { all, byGenre: map };
  }, [spots]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSpots = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const topThree = spots.slice(0, 3);
  const totalClicks = spots.reduce((sum, s) => sum + s.clicks, 0);

  function scrollToClaim() {
    claimFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function claimRank(amount: number) {
    setBid(Math.max(1, amount));
    scrollToClaim();
  }

  function confirmPaidBid() {
    const draft = pending ?? readPendingBid();
    if (!draft) return;
    const spot = placeBid({
      trackId: draft.trackId,
      trackUrl: draft.trackUrl || spotifyTrackUrl(draft.trackId),
      title: draft.title,
      artist: draft.artist,
      thumbnailUrl: draft.thumbnailUrl,
      genre: draft.genre as Exclude<Genre, "All">,
      bid: draft.bid,
      askingPrice: draft.askingPrice,
    });
    clearPendingBid();
    setPending(null);
    setPlayingId(spot.trackId);
    setStatus(`You’re on the board at ${formatMoney(spot.bid)} with “${spot.title}”.`);
  }

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

      const draft: PendingBid = {
        trackId,
        trackUrl: spotifyTrackUrl(trackId),
        title: meta.title,
        artist: meta.artist || "Unknown artist",
        thumbnailUrl: meta.thumbnailUrl || "",
        genre: selectedGenre,
        bid,
        method,
      };

      savePendingBid(draft);
      setPending(draft);

      if (method === "upi") {
        setStatus(
          `Open your UPI app and pay ${formatInr(bidToInr(bid))} (≈ ${formatMoney(bid)}), then confirm below.`,
        );
        window.location.assign(paymentCheckoutUrl("upi", bid));
        setBusy(false);
        return;
      }

      setStatus(`Redirecting to PayPal for ${formatMoney(bid)}…`);
      window.location.assign(paymentCheckoutUrl("paypal", bid));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not start checkout.");
      setBusy(false);
    }
  }

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setStatus(`Copied UPI ID ${UPI_ID}`);
    } catch {
      setStatus(`UPI ID: ${UPI_ID}`);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      {/* Time tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 py-3">
        <div className="flex gap-1 text-sm">
          {(
            [
              ["all", "All-time"],
              ["today", "Today"],
              ["week", "Week"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTime(key)}
              className={`rounded-full px-3 py-1.5 font-medium ${
                time === key
                  ? "bg-[#242424] text-white"
                  : "text-[#a7a7a7] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#a7a7a7] sm:hidden">
          {online} online · {totalClicks} clicks
        </p>
      </div>

      {/* Claim #1 bar */}
      <section className="claim-bar mt-5" aria-labelledby="claim-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="claim-heading" className="text-sm font-medium text-[#a7a7a7]">
              Claim #1 for
            </h2>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                className="claim-step"
                onClick={() => setBid((n) => Math.max(1, n - 1))}
                aria-label="Decrease bid"
              >
                −
              </button>
              <span className="min-w-16 text-center text-3xl font-bold tabular-nums tracking-tight">
                {formatMoney(bid)}
              </span>
              <button
                type="button"
                className="claim-step"
                onClick={() => setBid((n) => n + 1)}
                aria-label="Increase bid"
              >
                +
              </button>
            </div>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-[#a7a7a7]">
            New spots start at $1. Paying less than the #1 price still puts you on
            the board at whatever place that bid can take.
          </p>
        </div>
      </section>

      {/* Pending payment */}
      {pending && (
        <div className="card mt-4 flex flex-col gap-3 border-(--accent)/35 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-(--accent)">
              Waiting for {pending.method === "upi" ? "UPI" : "PayPal"}
            </p>
            <p className="mt-1 text-sm text-[#b3b3b3]">
              {pending.title} · {formatMoney(pending.bid)}
              {pending.method === "upi"
                ? ` · ${formatInr(bidToInr(pending.bid))} via ${UPI_ID}`
                : ""}{" "}
              — after you pay, confirm below.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a
              href={paymentCheckoutUrl(pending.method ?? "paypal", pending.bid)}
              className="rounded-full bg-[#242424] px-4 py-2 text-sm font-medium hover:bg-[#2a2a2a]"
            >
              {pending.method === "upi" ? "Open UPI again" : "Open PayPal again"}
            </a>
            {pending.method === "upi" && (
              <button
                type="button"
                className="rounded-full bg-[#242424] px-4 py-2 text-sm font-medium hover:bg-[#2a2a2a]"
                onClick={copyUpiId}
              >
                Copy UPI ID
              </button>
            )}
            <button
              type="button"
              className="primary-btn px-4 py-2 text-sm"
              onClick={confirmPaidBid}
            >
              I paid — put me on the board
            </button>
            <button
              type="button"
              className="px-3 py-2 text-xs text-[#a7a7a7] hover:text-white"
              onClick={() => {
                clearPendingBid();
                setPending(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Submit row */}
      <form
        id="claim"
        ref={claimFormRef}
        onSubmit={onBid}
        className="card mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:p-5"
      >
        <div className="min-w-0">
          <label className="label">Your Spotify track URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/track/…"
            className="field"
          />
        </div>
        <div>
          <label className="label">Choose a category</label>
          <select
            value={selectedGenre}
            onChange={(e) =>
              setSelectedGenre(e.target.value as Exclude<Genre, "All">)
            }
            className="field min-w-40"
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
            : method === "upi"
              ? `Pay ${formatInr(inrAmount)} UPI`
              : `Pay ${formatMoney(bid)} PayPal`}
        </button>

        <div className="sm:col-span-3">
          <p className="label">Pay with</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMethod("paypal")}
              className={`chip ${method === "paypal" ? "chip-active" : ""}`}
            >
              PayPal · international
            </button>
            <button
              type="button"
              onClick={() => setMethod("upi")}
              className={`chip ${method === "upi" ? "chip-active" : ""}`}
            >
              UPI · India · {formatInr(inrAmount)}
            </button>
          </div>
          <p className="mt-2 text-xs text-[#a7a7a7]">
            {method === "upi" ? (
              <>
                Opens your UPI app for {formatInr(inrAmount)} (≈ {formatMoney(bid)} at ~
                ₹{USD_TO_INR}/$). ID:{" "}
                <button
                  type="button"
                  className="text-[#b3b3b3] underline hover:text-white"
                  onClick={copyUpiId}
                >
                  {UPI_ID}
                </button>
                . Then tap{" "}
                <span className="text-[#b3b3b3]">I paid — put me on the board</span>.
              </>
            ) : (
              <>
                International checkout via PayPal.Me. Then return and tap{" "}
                <span className="text-[#b3b3b3]">I paid — put me on the board</span>.
              </>
            )}{" "}
            Same link again raises your existing bid.
          </p>
        </div>

        {status && (
          <p className="rounded-lg bg-[#242424] px-3 py-2 text-sm text-[#b3b3b3] sm:col-span-3">
            {status}
          </p>
        )}
      </form>

      {/* 3D podium */}
      <section className="py-8" aria-labelledby="top-board-heading">
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 id="top-board-heading" className="text-2xl font-bold tracking-tight">
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

      {/* Now playing */}
      {playingId && (
        <section className="mb-8">
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

      {/* Board grid */}
      <section className="board-grid">
        {/* Categories */}
        <aside id="categories" className="cat-rail">
          <h2 className="mb-3 text-sm font-bold">Categories</h2>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setGenre("All")}
                className={`cat-item ${genre === "All" ? "cat-item-active" : ""}`}
              >
                <span>All</span>
                <span className="tabular-nums text-[#a7a7a7]">
                  {formatMoney(genreTotals.all)}
                </span>
              </button>
            </li>
            {[...genreTotals.byGenre.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([g, total]) => (
                <li key={g}>
                  <button
                    type="button"
                    onClick={() => setGenre(g as Genre)}
                    className={`cat-item ${genre === g ? "cat-item-active" : ""}`}
                  >
                    <span className="truncate">{g}</span>
                    <span className="shrink-0 tabular-nums text-[#a7a7a7]">
                      {formatMoney(total)}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </aside>

        {/* Ranked list */}
        <div id="board">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Leaderboard</h2>
              <p className="mt-1 text-sm text-[#a7a7a7]">
                {filtered.length} of {spots.length} songs
                {genre !== "All" ? ` · ${genre}` : ""}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {pageSpots.map((spot, index) => {
              const rank = (page - 1) * PAGE_SIZE + index + 1;
              return (
                <LeaderboardCard
                  key={spot.id}
                  spot={spot}
                  rank={rank}
                  ready={ready}
                  onPlay={() => setPlayingId(spot.trackId)}
                  onOpen={() => registerClick(spot.id)}
                  onClaim={() => claimRank(spot.bid + 1)}
                />
              );
            })}
            {filtered.length === 0 && (
              <div className="card px-4 py-10 text-center text-sm text-[#a7a7a7]">
                No songs match these filters.
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                className="rounded-full bg-[#242424] px-4 py-2 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <span className="text-[#a7a7a7]">
                Page {page} / {totalPages}
                <span className="mx-1.5 text-white/20">·</span>
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <button
                type="button"
                className="rounded-full bg-[#242424] px-4 py-2 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="board-side">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Today&apos;s top ranking</h2>
            <SideRankList spots={todayTop} ready={ready} empty="No bids today yet." />
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Week&apos;s top ranking</h2>
            <SideRankList spots={weekTop} ready={ready} empty="No bids this week yet." />
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Latest activity</h2>
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
          </div>
        </aside>
      </section>
    </main>
  );
}

function SideRankList({
  spots,
  ready,
  empty,
}: {
  spots: { id: string; title: string; bid: number; raisedAt: number }[];
  ready: boolean;
  empty: string;
}) {
  if (spots.length === 0) {
    return <p className="text-xs text-[#a7a7a7]">{empty}</p>;
  }
  return (
    <ol className="space-y-2.5">
      {spots.map((s, i) => (
        <li key={s.id} className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              <span className="mr-1.5 text-[#a7a7a7]">#{i + 1}</span>
              {s.title}
            </p>
            {ready && (
              <p className="mt-0.5 text-xs text-[#a7a7a7]">{timeAgo(s.raisedAt)}</p>
            )}
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-(--accent)">
            {formatMoney(s.bid)}
          </span>
        </li>
      ))}
    </ol>
  );
}
