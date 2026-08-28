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
      setMessage("No pending bid found. If you already paid, your card was charged — try pasting the same track again or contact support with your receipt.");
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
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-sm text-[#1ed760]">
          {ok ? "Payment received" : "PlaylistBid"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          {ok ? "Bid locked in" : "Almost there"}
        </h1>
        <p className="mt-4 text-[#b7bdc0]">{message}</p>
        <Link
          href="/"
          className="green-btn mt-8 inline-flex px-6 py-3"
        >
          Back to the board
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
