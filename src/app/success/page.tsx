"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { useBoard } from "@/lib/board-context";
import { formatUsd } from "@/lib/format";
import { rankOf, sideOf, trackOnSide } from "@/lib/ranks";
import { readReceipt, type Receipt } from "@/lib/receipt";
import { PAYMENT_PROVIDER } from "@/lib/site";

// Transactional page; kept out of search indexes via robots.ts disallow.

function slot(rank: number) {
  return `side ${sideOf(rank)} · track ${trackOnSide(rank)}`;
}

export default function SuccessPage() {
  const { spots, hydrated } = useBoard();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [read, setRead] = useState(false);
  const [payment, setPayment] = useState<{
    status: string | null;
    id: string | null;
  }>({ status: null, id: null });

  useEffect(() => {
    // Wait for the saved tape so the rank below is read off the real thing.
    if (!hydrated) return;
    setReceipt(readReceipt());
    // Dodo appends status and payment_id to the return URL. Read them straight
    // off the address bar rather than through useSearchParams, which would push
    // this whole page out of static rendering.
    const params = new URLSearchParams(window.location.search);
    setPayment({
      status: params.get("status"),
      id: params.get("payment_id"),
    });
    setRead(true);
  }, [hydrated]);

  // Where the song sits right now, which may have moved if someone outbid it
  // while the payment page was open.
  const rank = receipt
    ? (rankOf(spots, receipt.trackId) ?? receipt.landedRank)
    : null;

  const paid = payment.status === "succeeded" || payment.status === "active";

  const message = !read
    ? "Reading the tape…"
    : !receipt
      ? "This browser has not written anything on the tape yet. Go back and pick a slot."
      : rank !== null && rank > receipt.landedRank
        ? `Someone paid more for ${slot(receipt.landedRank)} since, so the song now sits at ${slot(rank)}. Pick a higher slot to move back up.`
        : payment.status && !paid
          ? `${PAYMENT_PROVIDER} reported the payment as ${payment.status}. The song is on the tape, but pay for the slot to keep it there.`
          : "Written on. Everything from that slot down shifted one track later.";

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
              {receipt ? "on the tape" : "nothing written on"}
            </span>
          </div>
          <div className="paddle-bd">
            <p className="marquee text-3xl">
              {rank !== null ? slot(rank) : "Nothing to show"}
            </p>
            <p className="mt-3 leading-relaxed chrome">{message}</p>

            {receipt && rank !== null && (
              <ul className="mt-5">
                <li className="lrow">
                  <span className="slip slip-quiet">song</span>
                  <span className="truncate text-sm font-medium">
                    {receipt.title}
                  </span>
                </li>
                <li className="lrow">
                  <span className="slip slip-quiet">paid for</span>
                  <span className="text-sm">{slot(receipt.targetRank)}</span>
                </li>
                <li className="lrow">
                  <span className="slip slip-quiet">sitting at</span>
                  <span className="marquee text-xl hammer">{slot(rank)}</span>
                </li>
                <li className="lrow">
                  <span className="slip slip-quiet">holding</span>
                  <span className="marquee text-xl">
                    {formatUsd(receipt.bid, 0)}
                  </span>
                </li>
                {payment.id && (
                  <li className="lrow">
                    <span className="slip slip-quiet">payment</span>
                    <span className="truncate text-xs">{payment.id}</span>
                  </li>
                )}
              </ul>
            )}

            <p className="mt-5 text-xs leading-relaxed chrome">
              Checkout is handled by {PAYMENT_PROVIDER}; we never see your card
              details. This position is a slot on PlaylistBid only — not on
              Spotify charts, playlists or stream counts.
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
