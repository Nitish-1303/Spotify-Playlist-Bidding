"use client";

import { CoverArt } from "@/components/cover-art";
import { formatInt, formatUsd, timeAgo } from "@/lib/format";
import { spotifyEmbedUrl } from "@/lib/spotify";
import type { Spot } from "@/lib/types";

type LotStripProps = {
  spot: Spot;
  rank: number;
  /** Positive when the lot climbed since the last confirmed bid. */
  move: number | null;
  onTake: (amount: number) => void;
  onOpen: (spot: Spot) => void;
};

function moveNote(move: number | null) {
  if (move === null || move === 0) return null;
  return move > 0 ? `up ${move}` : `down ${Math.abs(move)}`;
}

/** One printed title strip in the rack. */
export function LotStrip({ spot, rank, move, onTake, onOpen }: LotStripProps) {
  const note = moveNote(move);

  return (
    <li className={`strip ${rank === 1 ? "strip-lead" : ""}`}>
      <div className="strip-tab">
        <span className="hole" aria-hidden />
        <span className="strip-lot">{String(rank).padStart(2, "0")}</span>
      </div>

      <div className="strip-body">
        <CoverArt
          as="button"
          trackId={spot.trackId}
          src={spot.thumbnailUrl}
          alt=""
          className="art"
          onClick={() => onOpen(spot)}
          title={`Open ${spot.title} on Spotify`}
        />

        <div className="min-w-0 flex-1">
          <a
            href={spot.trackUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => onOpen(spot)}
            className="strip-title block hover:text-[var(--press)]"
          >
            {spot.title}
          </a>
          <p className="strip-artist">
            {spot.artist} · {spot.genre}
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <p className="tnum text-xs">{formatInt(spot.clicks)}</p>
          <p className="slip slip-quiet text-[0.625rem]">plays</p>
        </div>

        <div className="hidden text-right md:block">
          <p className="tnum text-xs chrome">{timeAgo(spot.raisedAt)}</p>
          <p className="slip slip-quiet text-[0.625rem]">
            {note ?? "held"}
          </p>
        </div>

        <div className="text-right">
          <p className="strip-price">{formatUsd(spot.bid, 0)}</p>
          <p className="slip slip-quiet text-[0.625rem]">standing</p>
        </div>

        <button
          type="button"
          className="btn btn-press hidden lg:inline-flex"
          onClick={() => onTake(spot.bid + 1)}
        >
          Take for {formatUsd(spot.bid + 1, 0)}
        </button>
      </div>
    </li>
  );
}

type BlockLotProps = {
  spot: Spot;
  runnerUp: number;
  onTake: (amount: number) => void;
  onOpen: (spot: Spot) => void;
};

/** The lot currently on the block: oversized strip with the official player. */
export function BlockLot({ spot, runnerUp, onTake, onOpen }: BlockLotProps) {
  const next = spot.bid + 1;

  return (
    <section className="strip strip-lead settle" aria-labelledby="block-title">
      <div className="strip-tab">
        <span className="hole" aria-hidden />
        <span className="strip-lot">01</span>
      </div>

      <div className="lot-block min-w-0 flex-1">
        <CoverArt
          as="button"
          trackId={spot.trackId}
          src={spot.thumbnailUrl}
          alt=""
          className="art art-lg max-w-[8.5rem]"
          onClick={() => onOpen(spot)}
          title={`Open ${spot.title} on Spotify`}
        />

        <div className="min-w-0">
          <p className="slip" style={{ color: "var(--hammer)" }}>
            on the block · hammer price {formatUsd(spot.bid, 0)}
          </p>
          <h2
            id="block-title"
            className="marquee subhead mt-2 break-words"
          >
            {spot.title}
          </h2>
          <p className="strip-artist mt-1.5 text-[0.75rem] whitespace-normal">
            {spot.artist} · {spot.genre} · {formatInt(spot.clicks)} plays ·
            raised {timeAgo(spot.raisedAt)}
          </p>
          <div className="mt-3.5 max-w-md">
            <iframe
              src={spotifyEmbedUrl(spot.trackId)}
              title={`Spotify player for ${spot.title}`}
              width="100%"
              height="80"
              frameBorder="0"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              style={{ borderRadius: 4, border: "1px solid var(--edge)" }}
            />
          </div>
        </div>

        <div className="shrink-0 md:text-right">
          <p className="slip slip-quiet">next bid takes it</p>
          <p className="marquee mt-1 text-[3rem] leading-none hammer">
            {formatUsd(next, 0)}
          </p>
          <p className="tnum mt-1 text-xs chrome">
            {runnerUp > 0
              ? `${formatUsd(spot.bid - runnerUp, 0)} clear of lot 02`
              : "no other lots yet"}
          </p>
          <button
            type="button"
            className="btn btn-hammer btn-lg mt-3.5 w-full md:w-auto"
            onClick={() => onTake(next)}
          >
            Raise to {formatUsd(next, 0)}
          </button>
        </div>
      </div>
    </section>
  );
}
