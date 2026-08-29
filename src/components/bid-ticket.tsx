"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  chartOrder,
  openRanks,
  priceForRank,
  rankOf,
  sideOf,
  trackOnSide,
} from "@/lib/ranks";
import { UPI_ID, USD_TO_INR } from "@/lib/site";
import { parseSpotifyTrackId, spotifyTrackUrl } from "@/lib/spotify";
import { GENRES, type Genre, type Spot } from "@/lib/types";

type BidTicketProps = {
  /** The track position being bought. Price follows from it, not the reverse. */
  targetRank: number;
  setTargetRank: (next: number) => void;
  onConfirmed: (spot: Spot) => void;
  formRef?: React.RefObject<HTMLFormElement | null>;
};

/** "side a · track 3" — how every position is named on this site. */
export function slotLabel(rank: number) {
  return `side ${sideOf(rank)} · track ${trackOnSide(rank)}`;
}

/**
 * The paddle: paste a song, pick the track position you want, pay what that
 * position costs, then confirm. The price is never typed in — it is whatever
 * it takes to sit where you pointed.
 */
export function BidTicket({
  targetRank,
  setTargetRank,
  onConfirmed,
  formRef,
}: BidTicketProps) {
  const { spots, placeBid } = useBoard();
  const [url, setUrl] = useState("");
  const [genre, setGenre] = useState<Exclude<Genre, "All">>("Pop");
  const [method, setMethod] = useState<PaymentMethod>("paypal");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingBid | null>(null);
  const localRef = useRef<HTMLFormElement>(null);
  const ref = formRef ?? localRef;

  useEffect(() => {
    setPending(readPendingBid());
  }, []);

  // Once a valid link is in the box we know which song this is, so the board is
  // priced as if that song were lifted off the tape first.
  const draftId = parseSpotifyTrackId(url) ?? undefined;
  const held = draftId ? rankOf(spots, draftId) : null;

  const others = useMemo(
    () => chartOrder(spots.filter((s) => s.trackId !== draftId)),
    [spots, draftId],
  );

  /**
   * Positions on offer. A song already on the tape can only move up — paying to
   * sit lower than you already sit would take money and change nothing.
   */
  const slots = useMemo(
    () => openRanks(spots, draftId).filter((r) => held === null || r < held),
    [spots, draftId, held],
  );

  const stuck = held === 1;
  const rank = slots.includes(targetRank) ? targetRank : (slots[0] ?? 1);
  const bid = priceForRank(spots, rank, draftId);
  const inr = bidToInr(bid);

  function confirmPaid() {
    const draft = pending ?? readPendingBid();
    if (!draft) return;
    const { spot, spots: after } = placeBid({
      trackId: draft.trackId,
      trackUrl: draft.trackUrl || spotifyTrackUrl(draft.trackId),
      title: draft.title,
      artist: draft.artist,
      thumbnailUrl: draft.thumbnailUrl,
      genre: draft.genre as Exclude<Genre, "All">,
      bid: draft.bid,
      askingPrice: draft.askingPrice,
    });

    // Work out where it actually landed rather than assuming it obeyed.
    const landed = rankOf(after, spot.trackId) ?? draft.targetRank ?? 1;

    clearPendingBid();
    setPending(null);
    setUrl("");
    setStatus(
      draft.targetRank && landed < draft.targetRank
        ? `On the tape. ${spot.title} landed at ${slotLabel(landed)} — one better than the ${slotLabel(draft.targetRank)} you paid for.`
        : `On the tape. ${spot.title} is ${slotLabel(landed)} at ${formatUsd(spot.bid, 0)}.`,
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
    if (stuck) {
      setStatus("That song already holds side A · track 1. Nothing above it.");
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
        targetRank: rank,
        method,
      };
      savePendingBid(draft);
      setPending(draft);

      if (method === "upi") {
        setStatus(`Pay ${formatInr(inr)} in your UPI app, then press “I paid”.`);
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
          write it on the label
        </h2>
        <span className="paddle-no">{slotLabel(rank)}</span>
      </div>

      {pending && (
        <div className="notice m-4 mb-0">
          <p className="slip" style={{ color: "var(--hammer)" }}>
            waiting on your payment
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            {pending.method === "upi" ? <UpiMark /> : <PayPalMark />}
            <span>
              {pending.title} for{" "}
              {pending.targetRank ? slotLabel(pending.targetRank) : "the tape"} —{" "}
              {formatUsd(pending.bid, 0)}
              {pending.method === "upi"
                ? ` (${formatInr(bidToInr(pending.bid))} to ${UPI_ID})`
                : ""}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-hammer" onClick={confirmPaid}>
              I paid — put it on the tape
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
          {held !== null && (
            <p className="slip slip-quiet mt-1.5">
              already on the tape at {slotLabel(held)}
            </p>
          )}
        </div>

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

        <div className="dashed-t pt-4">
          <span className="slip label">pick your track position</span>

          {stuck ? (
            <p className="notice text-sm">
              This song already holds side A · track 1. There is nothing above it
              to buy.
            </p>
          ) : (
            <div
              className="slots"
              role="radiogroup"
              aria-label="Track position to buy"
            >
              {slots.map((r) => {
                const holder = others[r - 1];
                const cost = priceForRank(spots, r, draftId);
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={r === rank}
                    onClick={() => setTargetRank(r)}
                    className={`slot ${r === rank ? "slot-on" : ""}`}
                  >
                    <span className="slot-no">
                      {sideOf(r)}&nbsp;·&nbsp;{trackOnSide(r)}
                    </span>
                    <span className="slot-holder">
                      {holder ? (
                        <>
                          takes it from <b className="font-normal">{holder.title}</b>
                        </>
                      ) : (
                        "the open end of the tape"
                      )}
                    </span>
                    <span className="slot-cost">{formatUsd(cost, 0)}</span>
                  </button>
                );
              })}
            </div>
          )}
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
          disabled={busy || stuck}
        >
          {busy
            ? "Opening checkout…"
            : method === "upi"
              ? `Pay ${formatInr(inr)} for ${slotLabel(rank)}`
              : `Pay ${formatUsd(bid, 0)} for ${slotLabel(rank)}`}
        </button>

        {status && <p className="notice notice-press text-sm">{status}</p>}

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
          A position costs a dollar more than whoever holds it. Pay it and the
          song takes that slot; everything from there down shifts one track
          later. Nothing moves until you come back and press “I paid”.
        </p>
      </form>
    </section>
  );
}



