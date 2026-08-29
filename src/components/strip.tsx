"use client";

import { CoverArt } from "@/components/cover-art";
import { formatInt, formatUsd, timeAgo } from "@/lib/format";
import { useNowPlaying } from "@/lib/now-playing";
import { sideOf, trackOnSide } from "@/lib/ranks";
import { spotifyEmbedUrl } from "@/lib/spotify";
import type { Spot } from "@/lib/types";

type LotStripProps = {
  spot: Spot;
  rank: number;
  /** Positive when the song moved up a track since the last confirmed payment. */
  move: number | null;
  onTake: (rank: number) => void;
  onOpen: (spot: Spot) => void;
};

function moveNote(move: number | null) {
  if (move === null || move === 0) return null;
  return move > 0 ? `up ${move}` : `down ${Math.abs(move)}`;
}

/** One track written onto the cassette label. */
export function LotStrip({ spot, rank, move, onTake, onOpen }: LotStripProps) {
  const { play } = useNowPlaying();
  const note = moveNote(move);

  return (
    <li className={`strip ${rank === 1 ? "strip-lead" : ""}`}>
      <div className="strip-tab">
        <span className="hole" aria-hidden />
        <span className="strip-lot">
          {sideOf(rank)}
          {trackOnSide(rank)}
        </span>
      </div>

      <div className="strip-body">
        <CoverArt
          as="button"
          trackId={spot.trackId}
          src={spot.thumbnailUrl}
          alt=""
          className="art"
          onClick={() => {
            onOpen(spot);
            play({
              trackId: spot.trackId,
              title: spot.title,
              artist: spot.artist,
            });
          }}
          title={`Play ${spot.title} in the deck`}
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
          <p className="slip slip-quiet text-[0.625rem]">{note ?? "held"}</p>
        </div>

        <div className="text-right">
          <p className="strip-price">{formatUsd(spot.bid, 0)}</p>
          <p className="slip slip-quiet text-[0.625rem]">holding</p>
        </div>

        <button
          type="button"
          className="btn btn-press hidden lg:inline-flex"
          onClick={() => onTake(rank)}
          title={`Buy side ${sideOf(rank)} · track ${trackOnSide(rank)}`}
        >
          Take this slot · {formatUsd(spot.bid + 1, 0)}
        </button>
      </div>
    </li>
  );
}

type BlockLotProps = {
  spot: Spot;
  runnerUp: number;
  onTake: (rank: number) => void;
  onOpen: (spot: Spot) => void;
};

/** Side A, track 1: the opening song, printed larger with the player inline. */
export function BlockLot({ spot, runnerUp, onTake, onOpen }: BlockLotProps) {
  const next = spot.bid + 1;

  return (
    <section className="strip strip-lead settle" aria-labelledby="block-title">
      <div className="strip-tab">
        <span className="hole" aria-hidden />
        <span className="strip-lot">A1</span>
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
            side a · track 1 · holding {formatUsd(spot.bid, 0)}
          </p>
          <h2 id="block-title" className="marquee subhead mt-2 break-words">
            {spot.title}
          </h2>
          <p className="strip-artist mt-1.5 text-[0.75rem] whitespace-normal">
            {spot.artist} · {spot.genre} · {formatInt(spot.clicks)} plays · last
            moved {timeAgo(spot.raisedAt)}
          </p>
          <div className="mt-3.5 max-w-md">
            <iframe
              src={spotifyEmbedUrl(spot.trackId)}
              title={`Spotify player for ${spot.title}`}
              width="100%"
              height="80"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              style={{ borderRadius: 4, border: "1px solid var(--edge)" }}
            />
          </div>
        </div>

        <div className="shrink-0 md:text-right">
          <p className="slip slip-quiet">to open the tape</p>
          <p className="marquee mt-1 text-[3rem] leading-none hammer">
            {formatUsd(next, 0)}
          </p>
          <p className="tnum mt-1 text-xs chrome">
            {runnerUp > 0
              ? `${formatUsd(spot.bid - runnerUp, 0)} clear of track 2`
              : "nothing else on the tape yet"}
          </p>
          <button
            type="button"
            className="btn btn-hammer btn-lg mt-3.5 w-full md:w-auto"
            onClick={() => onTake(1)}
          >
            Take side A · track 1
          </button>
        </div>
      </div>
    </section>
  );
}
