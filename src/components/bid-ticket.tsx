"use client";

import { useMemo, useRef, useState } from "react";
import { PurchaseScopeNote } from "@/components/independence";
import { DodoMark } from "@/components/pay-marks";
import { useBoard } from "@/lib/board-context";
import { formatUsd } from "@/lib/format";
import {
  CheckoutNotConfiguredError,
  savePaymentHandle,
  startCheckout,
} from "@/lib/payments";
import { chartOrder, openRanks, priceForRank, rankOf } from "@/lib/ranks";
import { PAYMENT_PROVIDER } from "@/lib/site";
import { parseSpotifyTrackId } from "@/lib/spotify";

type BidTicketProps = {
  /** The track position being bought. Price follows from it, not the reverse. */
  targetRank: number;
  setTargetRank: (next: number) => void;
  onStarted: () => void;
  formRef?: React.RefObject<HTMLFormElement | null>;
};

/** "track 3" — how every position is named on this site. */
export function slotLabel(rank: number) {
  return `track ${rank}`;
}

/**
 * The paddle: paste a song, pick the track position you want, and pay what that
 * position costs.
 *
 * The prices shown here are the tape's own arithmetic, for the buyer to read.
 * They are not what gets charged — the server prices the slot again when it
 * opens the checkout, so nothing typed or tampered with in this page can change
 * what a slot costs.
 */
export function BidTicket({
  targetRank,
  setTargetRank,
  onStarted,
  formRef,
}: BidTicketProps) {
  const { spots, durable } = useBoard();
  const [url, setUrl] = useState("");
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

  /**
   * Somebody typed a title instead of pasting a link.
   *
   * The server can only recognise it if the song is already on the tape — there
   * is no catalogue search behind this, and there cannot be one — which is
   * exactly the case worth catching: they are about to add something that is on
   * it already. When it matches, the box is filled in with the real link so the
   * rest of the paddle prices it the way a paste would.
   */
  async function resolveTyped(text: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/track?q=${encodeURIComponent(text)}`);
      const data = (await res.json()) as {
        trackId?: string;
        trackUrl?: string;
        title?: string;
        position?: number | null;
        openPositions?: number[];
      };
      if (!res.ok || !data.trackId || !data.trackUrl || !data.position) {
        setStatus("That is not a track link. Use open.spotify.com/track/…");
        return;
      }
      setUrl(data.trackUrl);
      setStatus(
        data.openPositions?.length
          ? `"${data.title}" is already on the tape at ${slotLabel(data.position)}. Pick a position above it.`
          : `"${data.title}" is already on the tape at ${slotLabel(data.position)}. There is nothing above it to buy.`,
      );
    } catch {
      setStatus("That is not a track link. Use open.spotify.com/track/…");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trackId = parseSpotifyTrackId(url);
    if (!trackId) {
      // An empty box is not worth asking the server about. It would answer with
      // this same sentence, and /api/track is public and unauthenticated, so the
      // requests it does not have to serve are the cheapest ones to save.
      if (!url.trim()) {
        setStatus("Paste a song link first — open.spotify.com/track/…");
        return;
      }
      await resolveTyped(url);
      return;
    }
    if (stuck) {
      setStatus(
        "This song is already on the tape at track 1. There is nothing above it to buy.",
      );
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const started = await startCheckout({ track: url, position: rank });

      // Kept so the receipt page can ask the backend how the payment went. It
      // is not proof of anything by itself.
      savePaymentHandle({
        transactionId: started.transactionId,
        ownerToken: started.ownerToken,
      });

      setUrl("");
      onStarted();
      window.location.assign(started.checkoutUrl);
    } catch (err) {
      setStatus(
        err instanceof CheckoutNotConfiguredError
          ? `${err.message} Nothing on the tape has changed.`
          : err instanceof Error
            ? err.message
            : "Unable to start payment. Please try again.",
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

        <div className="dashed-t pt-4">
          <span className="slip label">pick your track position</span>

          {stuck ? (
            <p className="notice text-sm">
              This song already holds track 1. There is nothing above it to buy.
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
                    <span className="slot-no">track&nbsp;{r}</span>
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

        {/* What the money buys, stated before the button that takes it. */}
        <PurchaseScopeNote />

        <button
          type="submit"
          className="btn btn-hammer btn-lg w-full"
          disabled={busy || stuck || !durable}
        >
          {busy
            ? "Opening checkout…"
            : `Take ${slotLabel(rank)} · ${formatUsd(bid, 0)}`}
        </button>

        {!durable && (
          <p className="notice text-sm">
            Slots are not for sale on this instance — the tape has no durable
            storage configured, so nothing bought would survive a restart.
          </p>
        )}

        {status && <p className="notice notice-press text-sm">{status}</p>}

        <p className="text-xs leading-relaxed chrome">
          Secure checkout by {PAYMENT_PROVIDER} — we never see your card details.
          Your song moves onto the tape once the payment is confirmed, at the
          position you paid for; everything from there down shifts one track
          later. Position always follows the price.
        </p>
      </form>
    </section>
  );
}
