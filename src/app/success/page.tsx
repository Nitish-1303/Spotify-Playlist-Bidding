"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { useBoard } from "@/lib/board-context";
import { formatUsd } from "@/lib/format";
import { readPayment, readPaymentHandle, type PaymentView } from "@/lib/payments";
import { PAYMENT_PROVIDER } from "@/lib/site";

// Transactional page; kept out of search indexes via robots.ts disallow.

/**
 * The receipt.
 *
 * Coming back here means the buyer left Dodo's checkout — nothing more. The
 * return URL is a navigation, not a proof, so this page never reads `status`
 * off the address bar and never writes to the tape. It asks the backend what
 * happened to its own transaction and shows that answer.
 */

/** How long to keep asking before telling the buyer to check back later. */
const GIVE_UP_MS = 120_000;
const FIRST_DELAY = 1500;
const MAX_DELAY = 8000;

function label(position: number | undefined) {
  return position === undefined ? "—" : `track ${position}`;
}

type Phase =
  | "reading"
  | "processing"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "reversed"
  | "missing"
  | "timeout";

function phaseOf(view: PaymentView | null): Phase {
  if (!view) return "reading";
  switch (view.status) {
    case "SUCCESS":
      return "confirmed";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    case "REFUNDED":
    case "CHARGEBACK":
      return "reversed";
    default:
      return "processing";
  }
}

const COPY: Record<Phase, { tag: string; head: string; body: string }> = {
  reading: {
    tag: "reading",
    head: "Checking your payment…",
    body: "Asking the tape what happened. This takes a moment.",
  },
  processing: {
    tag: "processing",
    head: "Payment processing…",
    body:
      "We’re confirming your payment. Nothing has moved on the tape yet — it will the moment the payment is confirmed. You can leave this page open.",
  },
  confirmed: {
    tag: "on the tape",
    head: "Payment confirmed.",
    body: "Everything from that slot down shifted one track later.",
  },
  failed: {
    tag: "not paid",
    head: "Payment failed.",
    body: "Nothing changed on the tape. No slot was taken and nothing was charged for one.",
  },
  cancelled: {
    tag: "not paid",
    head: "Payment cancelled.",
    body: "Nothing changed on the tape. The slot is still open.",
  },
  reversed: {
    tag: "money returned",
    head: "This payment went back.",
    // Deliberately does not assert the song has come off: a reversal leaves it
    // in place when a larger, unrefunded payment is what holds the position. The
    // note below carries whichever of the two actually happened.
    body: "The money for this payment has been returned, so it no longer holds a slot on the tape.",
  },
  missing: {
    tag: "nothing to show",
    head: "No payment to show.",
    body:
      "This browser has no payment in progress. If you paid from another browser or device, the receipt lives there — the tape itself is the same for everyone.",
  },
  timeout: {
    tag: "still confirming",
    head: "Still confirming.",
    body:
      "The payment has not been confirmed yet. Nothing has changed on the tape. Come back to this page in a few minutes, or check the tape itself.",
  },
};

export default function SuccessPage() {
  const { refresh } = useBoard();
  const [view, setView] = useState<PaymentView | null>(null);
  const [phase, setPhase] = useState<Phase>("reading");
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  const settle = useCallback(
    (next: PaymentView) => {
      setView(next);
      const p = phaseOf(next);
      setPhase(p);
      // The tape only ever changes on the server, so re-read it rather than
      // patching anything locally.
      if (p === "confirmed") void refresh();
      return p;
    },
    [refresh],
  );

  useEffect(() => {
    alive.current = true;
    const handle = readPaymentHandle();
    // Dodo's return URL carries ?tx=; the token never travels in a URL.
    const fromUrl = new URLSearchParams(window.location.search).get("tx");
    const transactionId = fromUrl || handle?.transactionId;

    if (!transactionId || !handle?.ownerToken || handle.transactionId !== transactionId) {
      setPhase("missing");
      return;
    }

    const startedAt = Date.now();
    let delay = FIRST_DELAY;

    async function poll() {
      if (!alive.current) return;
      const next = await readPayment(transactionId!, handle!.ownerToken);
      if (!alive.current) return;

      if (!next) {
        setPhase("missing");
        return;
      }
      const p = settle(next);
      if (p !== "processing") return;

      if (Date.now() - startedAt > GIVE_UP_MS) {
        setPhase("timeout");
        return;
      }
      // Back off so a slow confirmation does not turn into a hammering loop.
      delay = Math.min(Math.round(delay * 1.4), MAX_DELAY);
      timer.current = window.setTimeout(() => void poll(), delay);
    }

    void poll();

    return () => {
      alive.current = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [settle]);

  const copy = COPY[phase];
  const showRows = Boolean(view) && (phase === "confirmed" || phase === "processing");
  const retry = phase === "failed" || phase === "cancelled";
  const landed = view?.landedPosition ?? view?.position;

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
              {copy.tag}
            </span>
          </div>
          <div className="paddle-bd" aria-live="polite">
            <p className="marquee text-3xl">{copy.head}</p>
            {phase === "confirmed" && (
              <p className="marquee mt-1 text-xl hammer">
                Your song is now on the tape at {label(landed)}.
              </p>
            )}
            <p className="mt-3 leading-relaxed chrome">{copy.body}</p>

            {view?.note && (
              <p className="notice notice-press mt-4 text-sm">{view.note}</p>
            )}

            {showRows && view && (
              <ul className="mt-5">
                <li className="lrow">
                  <span className="slip slip-quiet">song</span>
                  <span className="truncate text-sm font-medium">
                    {view.title || "—"}
                  </span>
                </li>
                <li className="lrow">
                  <span className="slip slip-quiet">paid for</span>
                  <span className="text-sm">{label(view.position)}</span>
                </li>
                {phase === "confirmed" && (
                  <li className="lrow">
                    <span className="slip slip-quiet">sitting at</span>
                    <span className="marquee text-xl hammer">{label(landed)}</span>
                  </li>
                )}
                <li className="lrow">
                  <span className="slip slip-quiet">holding</span>
                  <span className="marquee text-xl">
                    {formatUsd(view.amount, 0)}
                  </span>
                </li>
              </ul>
            )}

            <p className="mt-5 text-xs leading-relaxed chrome">
              Checkout is handled by {PAYMENT_PROVIDER}; we never see your card
              details. What you bought is a position on the PlaylistBid tape: it
              does not modify Spotify playlists, charts, rankings, or stream
              counts. PlaylistBid is an independent fan project and is not
              affiliated with Spotify AB.
            </p>

            <Link
              href={retry ? "/#paddle" : "/"}
              className="btn btn-hammer btn-lg mt-6 w-full"
            >
              {retry ? "Try again" : "Back to the tape"}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
