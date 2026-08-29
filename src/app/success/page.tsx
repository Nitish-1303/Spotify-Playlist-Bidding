"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { useBoard } from "@/lib/board-context";
import { formatUsd } from "@/lib/format";
import { clearPendingBid, readPendingBid } from "@/lib/pending-bid";
import { spotifyTrackUrl } from "@/lib/spotify";
import type { Genre } from "@/lib/types";

// Transactional page; kept out of search indexes via robots.ts disallow.

export default function SuccessPage() {
  const { placeBid } = useBoard();
  const [message, setMessage] = useState("Matching your payment to a pending bid…");
  const [filled, setFilled] = useState<{ title: string; bid: number } | null>(null);

  useEffect(() => {
    const pending = readPendingBid();
    if (!pending) {
      setMessage(
        "This browser has no pending bid. If you already paid, go back to the rack and place the same bid again, or reach out with your receipt.",
      );
      return;
    }

    const spot = placeBid({
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
    setFilled({ title: spot.title, bid: spot.bid });
    setMessage("Your lot is printed on the rack.");
  }, [placeBid]);

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
              fill receipt
            </h1>
            <span className="slip" style={{ color: "var(--paper)" }}>
              {filled ? "filled" : "pending"}
            </span>
          </div>
          <div className="paddle-bd">
            <p className="marquee text-3xl">
              {filled ? "Bid filled" : "Nothing to fill"}
            </p>
            <p className="mt-3 leading-relaxed chrome">{message}</p>

            {filled && (
              <ul className="mt-5">
                <li className="lrow">
                  <span className="slip slip-quiet">song</span>
                  <span className="truncate text-sm font-medium">
                    {filled.title}
                  </span>
                </li>
                <li className="lrow">
                  <span className="slip slip-quiet">standing bid</span>
                  <span className="marquee text-xl hammer">
                    {formatUsd(filled.bid, 0)}
                  </span>
                </li>
              </ul>
            )}

            <p className="mt-5 text-xs leading-relaxed chrome">
              This lot number is a position on PlaylistBid only — not on Spotify
              charts, playlists or stream counts.
            </p>

            <Link href="/" className="btn btn-hammer btn-lg mt-6 w-full">
              Back to the rack
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
