"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { useBoard } from "@/lib/board-context";
import type { Genre } from "@/lib/types";
import {
  clearPendingBid,
  readPendingBid,
} from "@/lib/pending-bid";
import { spotifyTrackUrl } from "@/lib/spotify";

export default function SuccessPage() {
  const { placeBid } = useBoard();
  const [message, setMessage] = useState("Confirming your bid…");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const pending = readPendingBid();
    if (!pending) {
      setMessage(
        "No pending bid found. If you already paid, your card was charged — try pasting the same track again or contact support with your receipt.",
      );
      return;
    }

    placeBid({
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
    setOk(true);
    setMessage(`You’re on the board at $${pending.bid} with “${pending.title}”.`);
  }, [placeBid]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center sm:px-6">
        <div className="card w-full p-8">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${
              ok
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[#242424] text-[var(--accent)]"
            }`}
          >
            {ok ? "✓" : "…"}
          </div>
          <p className="mt-5 text-sm font-medium text-[var(--accent)]">
            {ok ? "Payment received" : "PlaylistBid"}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {ok ? "You’re on the board" : "Almost there"}
          </h1>
          <p className="mt-4 text-[#b3b3b3] leading-relaxed">{message}</p>
          <p className="mt-3 text-xs text-[#a7a7a7]">
            This rank is on PlaylistBid only — not on Spotify.
          </p>
          <Link href="/" className="primary-btn mt-8 inline-flex px-6 py-3 text-sm">
            Back to the board
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
