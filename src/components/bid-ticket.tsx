"use client";

import { useEffect, useRef, useState } from "react";
import { PayPalMark, UpiMark } from "@/components/pay-marks";
import { useBoard } from "@/lib/board-context";
import { formatUsd } from "@/lib/format";
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
import { parseSpotifyTrackId, spotifyTrackUrl } from "@/lib/spotify";
import { GENRES, type Genre, type Spot } from "@/lib/types";

type BidTicketProps = {
  bid: number;
  setBid: (next: number) => void;
  onConfirmed: (spot: Spot) => void;
  formRef?: React.RefObject<HTMLFormElement | null>;
};

/** The paddle: paste a track, name a price, pay, then confirm the fill. */
export function BidTicket({ bid, setBid, onConfirmed, formRef }: BidTicketProps) {
  const { placeBid } = useBoard();
  const [url, setUrl] = useState("");
  const [genre, setGenre] = useState<Exclude<Genre, "All">>("Pop");
  const [method, setMethod] = useState<PaymentMethod>("paypal");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingBid | null>(null);
  const localRef = useRef<HTMLFormElement>(null);
  const ref = formRef ?? localRef;
  const inr = bidToInr(bid);

  useEffect(() => {
    setPending(readPendingBid());
  }, []);

  function confirmPaid() {
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
    setUrl("");
    setStatus(
      `Filled. ${spot.title} is on the rack at ${formatUsd(spot.bid, 0)}.`,
    );
    onConfirmed(spot);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trackId = parseSpotifyTrackId(url);
    if (!trackId) {
      setStatus("That is not a track link. Use open.spotify.com/track/…");
      return;
    }
    if (bid < 1) {
      setStatus("Bidding opens at $1.");
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
      if (!res.ok || !meta.title) {
        throw new Error(meta.error || "Could not load that track.");
      }

      const draft: PendingBid = {
        trackId,
        trackUrl: spotifyTrackUrl(trackId),
        title: meta.title,
        artist: meta.artist || "Unknown artist",
        thumbnailUrl: meta.thumbnailUrl || "",
        genre,
        bid,
        method,
      };
      savePendingBid(draft);
      setPending(draft);

      if (method === "upi") {
        setStatus(
          `Pay ${formatInr(inr)} in your UPI app, then press “I paid”.`,
        );
        window.location.assign(paymentCheckoutUrl("upi", bid));
        setBusy(false);
        return;
      }

      setStatus(`Opening PayPal for ${formatUsd(bid, 0)}…`);
      window.location.assign(paymentCheckoutUrl("paypal", bid));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not open checkout.");
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
    <section className="paddle" id="paddle" aria-labelledby="paddle-heading">
      <div className="paddle-hd">
        <h2 id="paddle-heading" className="slip">
          your paddle
        </h2>
        <span className="paddle-no">№ {bid}</span>
      </div>

      {pending && (
        <div className="notice m-4 mb-0">
          <p className="slip" style={{ color: "var(--hammer)" }}>
            waiting on your payment
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            {pending.method === "upi" ? <UpiMark /> : <PayPalMark />}
            <span>
              {pending.title} at {formatUsd(pending.bid, 0)}
              {pending.method === "upi"
                ? ` — ${formatInr(bidToInr(pending.bid))} to ${UPI_ID}`
                : ""}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-hammer" onClick={confirmPaid}>
              I paid — fill my bid
            </button>
            <a
              className="btn"
              href={paymentCheckoutUrl(pending.method ?? "paypal", pending.bid)}
            >
              Reopen {pending.method === "upi" ? "UPI" : "PayPal"}
            </a>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                clearPendingBid();
                setPending(null);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <form ref={ref} onSubmit={submit} className="paddle-bd space-y-4">
        <div>
          <label htmlFor="track-url" className="slip label">
            song link
          </label>
          <input
            id="track-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/track/…"
            className="field"
            inputMode="url"
            autoComplete="off"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="track-genre" className="slip label">
              shelf
            </label>
            <select
              id="track-genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value as Exclude<Genre, "All">)}
              className="field field-select"
            >
              {GENRES.filter((g) => g !== "All").map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="slip label">your bid</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-step h-12"
                onClick={() => setBid(Math.max(1, bid - 1))}
                aria-label="Lower bid by one dollar"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                step={1}
                value={bid}
                onChange={(e) =>
                  setBid(Math.max(1, Math.round(Number(e.target.value) || 1)))
                }
                className="field marquee text-center text-xl"
                aria-label="Bid amount in US dollars"
              />
              <button
                type="button"
                className="btn btn-step h-12"
                onClick={() => setBid(bid + 1)}
                aria-label="Raise bid by one dollar"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="dashed-t pt-4">
          <span className="slip label">pay with</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMethod("paypal")}
              className={`pay ${method === "paypal" ? "pay-on" : ""}`}
              aria-pressed={method === "paypal"}
            >
              <PayPalMark />
              <span className="pay-meta">
                <span className="pay-amt">{formatUsd(bid, 0)}</span>
                <span className="slip slip-quiet block">worldwide</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMethod("upi")}
              className={`pay ${method === "upi" ? "pay-on" : ""}`}
              aria-pressed={method === "upi"}
            >
              <UpiMark />
              <span className="pay-meta">
                <span className="pay-amt">{formatInr(inr)}</span>
                <span className="slip slip-quiet block">india</span>
              </span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-hammer btn-lg w-full"
          disabled={busy}
        >
          {busy
            ? "Opening checkout…"
            : method === "upi"
              ? `Pay ${formatInr(inr)} with UPI`
              : `Pay ${formatUsd(bid, 0)} with PayPal`}
        </button>

        {status && (
          <p className="notice notice-press text-sm">{status}</p>
        )}

        <p className="text-xs leading-relaxed chrome">
          {method === "upi" ? (
            <>
              UPI settles in rupees at about ₹{USD_TO_INR} to the dollar, so{" "}
              {formatUsd(bid, 0)} is {formatInr(inr)} to{" "}
              <button type="button" className="press tie" onClick={copyUpiId}>
                {UPI_ID}
              </button>
              .
            </>
          ) : (
            <>PayPal opens paypal.me in this tab.</>
          )}{" "}
          Come back and press “I paid” to fill the bid — nothing reaches the rack
          until you confirm. Sending the same song link again raises your
          existing bid instead of adding a second lot.
        </p>
      </form>
    </section>
  );
}
