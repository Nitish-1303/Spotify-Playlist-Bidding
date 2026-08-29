"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { useBoard } from "@/lib/board-context";
import { formatUsd } from "@/lib/format";
import { clearPendingBid, readPendingBid } from "@/lib/pending-bid";
import { rankOf, sideOf, trackOnSide } from "@/lib/ranks";
import { spotifyTrackUrl } from "@/lib/spotify";
import type { Genre } from "@/lib/types";

// Transactional page; kept out of search indexes via robots.ts disallow.

type Landed = {
  title: string;
  bid: number;
  /** Where it ended up. */
  rank: number;
  /** Where it was paid to go, when the pending bid recorded one. */
  paidFor?: number;
};

function slot(rank: number) {
  return `side ${sideOf(rank)} · track ${trackOnSide(rank)}`;
}

export default function SuccessPage() {
  const { hydrated, placeBid } = useBoard();
  const [message, setMessage] = useState("Reading the tape…");
  const [landed, setLanded] = useState<Landed | null>(null);
  const done = useRef(false);

  useEffect(() => {
    // Wait for the saved tape, or this write lands on the seed and is discarded.
    if (!hydrated || done.current) return;
    done.current = true;

    const pending = readPendingBid();
    if (!pending) {
      setMessage(
        "This browser has no payment waiting. If you already paid, go back to the tape and pick the same slot again, or reach out with your receipt.",
      );
      return;
    }

    const { spot, spots: after } = placeBid({
      trackId: pending.trackId,
      trackUrl: spotifyTrackUrl(pending.trackId),
      title: pending.title,
      artist: pending.artist,
      thumbnailUrl: pending.thumbnailUrl,
      genre: pending.genre as Exclude<Genre, "All">,
      bid: pending.bid,
      askingPrice: pending.askingPrice,
    });
    clearPendingBid();

    // Read the tape back after the write rather than assuming it obeyed.
    const rank = rankOf(after, spot.trackId) ?? pending.targetRank ?? 1;

    setLanded({
      title: spot.title,
      bid: spot.bid,
      rank,
      paidFor: pending.targetRank,
    });
    setMessage(
      pending.targetRank && rank > pending.targetRank
        ? `Someone took ${slot(pending.targetRank)} while you were paying, so the song sits at ${slot(rank)}. Pick that slot again to move up.`
        : `Written on. Everything from that slot down shifted one track later.`,
    );
  }, [hydrated, placeBid]);

  return (
    <>
      <SiteHeader />
      <main className="rack py-16">
        <section
          className="paddle mx-auto max-w-lg"
          aria-labelledby="receipt-heading"
        >
          <div className="paddle-hd">
            <h1 id="receipt-heading" className="slip">
              tape receipt
            </h1>
            <span className="slip" style={{ color: "var(--paper)" }}>
              {landed ? "on the tape" : "nothing waiting"}
            </span>
          </div>
          <div className="paddle-bd">
            <p className="marquee text-3xl">
              {landed ? slot(landed.rank) : "Nothing to write on"}
            </p>
            <p className="mt-3 leading-relaxed chrome">{message}</p>

            {landed && (
              <ul className="mt-5">
                <li className="lrow">
                  <span className="slip slip-quiet">song</span>
                  <span className="truncate text-sm font-medium">
                    {landed.title}
                  </span>
                </li>
                <li className="lrow">
                  <span className="slip slip-quiet">paid for</span>
                  <span className="text-sm">
                    {landed.paidFor ? slot(landed.paidFor) : "the open end"}
                  </span>
                </li>
                <li className="lrow">
                  <span className="slip slip-quiet">landed at</span>
                  <span className="marquee text-xl hammer">
                    {slot(landed.rank)}
                  </span>
                </li>
                <li className="lrow">
                  <span className="slip slip-quiet">holding</span>
                  <span className="marquee text-xl">
                    {formatUsd(landed.bid, 0)}
                  </span>
                </li>
              </ul>
            )}

            <p className="mt-5 text-xs leading-relaxed chrome">
              This position is a slot on PlaylistBid only — not on Spotify
              charts, playlists or stream counts.
            </p>

            <Link href="/" className="btn btn-hammer btn-lg mt-6 w-full">
              Back to the tape
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
