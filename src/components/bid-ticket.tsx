"use client";

import { useMemo, useRef, useState } from "react";
import { DodoMark } from "@/components/pay-marks";
import { useBoard } from "@/lib/board-context";
import { formatUsd } from "@/lib/format";
import {
  CheckoutNotConfiguredError,
  createCheckoutSession,
} from "@/lib/payments";
import {
  chartOrder,
  openRanks,
  priceForRank,
  rankOf,
  sideOf,
  trackOnSide,
} from "@/lib/ranks";
import { saveReceipt } from "@/lib/receipt";
import { PAYMENT_PROVIDER } from "@/lib/site";
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
 * The paddle: paste a song, pick the track position you want, and pay what that
 * position costs. The price is never typed in — it is whatever it takes to sit
 * where you pointed, and where it sits follows from the price.
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
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const localRef = useRef<HTMLFormElement>(null);
  const ref = formRef ?? localRef;

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

      // Checkout first: if Dodo will not open, nothing goes on the tape.
      const { checkoutUrl } = await createCheckoutSession({
        trackId,
        bid,
        title: meta.title,
        artist: meta.artist || "Unknown artist",
        thumbnailUrl: meta.thumbnailUrl || "",
        genre,
        targetRank: rank,
      });

      // The song goes on the tape at the price being paid, and the price is what
      // decides the position. No confirmation step in between.
      const { spot, spots: after } = placeBid({
        trackId,
        trackUrl: spotifyTrackUrl(trackId),
        title: meta.title,
        artist: meta.artist || "Unknown artist",
        thumbnailUrl: meta.thumbnailUrl || "",
        genre,
        bid,
      });
      const landed = rankOf(after, spot.trackId) ?? rank;

      saveReceipt({
        trackId,
        trackUrl: spot.trackUrl,
        title: spot.title,
        artist: spot.artist,
        bid: spot.bid,
        targetRank: rank,
        landedRank: landed,
      });

      setUrl("");
      onConfirmed(spot);
      setStatus(
        `${spot.title} is on the tape at ${slotLabel(landed)}. Pay ${formatUsd(
          spot.bid,
          0,
        )} to keep it there.`,
      );

      window.location.assign(checkoutUrl);
    } catch (err) {
      setStatus(
        err instanceof CheckoutNotConfiguredError
          ? `${err.message} Nothing was written on the tape.`
          : err instanceof Error
            ? err.message
            : "Could not open checkout.",
      );
      setBusy(false);
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
          <div className="pay pay-on" aria-live="polite">
            <DodoMark />
            <span className="pay-meta">
              <span className="pay-amt">{formatUsd(bid, 0)}</span>
              <span className="slip slip-quiet block">
                card · secure hosted checkout
              </span>
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-hammer btn-lg w-full"
          disabled={busy || stuck}
        >
          {busy
            ? "Opening checkout…"
            : `Pay ${formatUsd(bid, 0)} for ${slotLabel(rank)}`}
        </button>

        {status && <p className="notice notice-press text-sm">{status}</p>}

        <p className="text-xs leading-relaxed chrome">
          Checkout is handled by {PAYMENT_PROVIDER} on their own hosted page — we
          never see your card details. A position costs a dollar more than
          whoever holds it. Pay it and the song takes that slot; everything from
          there down shifts one track later. Position always follows the price.
        </p>
      </form>
    </section>
  );
}



