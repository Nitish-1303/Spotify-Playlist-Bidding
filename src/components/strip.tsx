"use client";

import { CoverArt } from "@/components/cover-art";
import { TimeAgo } from "@/components/time-ago";
import { formatInt, formatUsd, artistLine } from "@/lib/format";
import { useNowPlaying } from "@/lib/now-playing";
import type { Spot } from "@/lib/types";

/** The one glyph this interface needs: play. */
export function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.14-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function moveNote(move: number | null) {
  if (move === null || move === 0) return null;
  return move > 0 ? `up ${move}` : `down ${Math.abs(move)}`;
}

type TapeHeaderProps = {
  spot: Spot;
  /** What track 2 is holding, for the "clear of" line. */
  runnerUp: number;
  tracks: number;
  plays: number;
  onTake: (rank: number) => void;
  onOpen: (spot: Spot) => void;
};

/**
 * How the tape introduces itself: the opening song's artwork at cover size,
 * its title at display size, the counts underneath, and a green button that
 * starts it playing in the deck.
 *
 * Playback is Spotify's own embedded player, in the deck at the bottom of the
 * screen. Nothing here is a Spotify product.
 */
export function TapeHeader({
  spot,
  runnerUp,
  tracks,
  plays,
  onTake,
  onOpen,
}: TapeHeaderProps) {
  const { play } = useNowPlaying();
  const next = spot.bid + 1;

  function start() {
    onOpen(spot);
    play({ trackId: spot.trackId, title: spot.title, artist: spot.artist });
  }

  return (
    <section className="settle" aria-labelledby="block-title">
      <div className="plist">
        <CoverArt
          as="button"
          trackId={spot.trackId}
          src={spot.thumbnailUrl}
          alt=""
          className="plist-art"
          onClick={start}
          title={`Play ${spot.title}`}
        />
        <div className="min-w-0">
          <p className="plist-kind">
            track 1 · opens the tape
          </p>
          <h2 id="block-title" className="plist-name break-words">
            {spot.title}
          </h2>
          <p className="plist-meta">
            {artistLine(spot.artist) ? (
              <>
                <b>{artistLine(spot.artist)}</b>
                <span aria-hidden>·</span>
              </>
            ) : null}
            <span>
              holding <b className="hammer">{formatUsd(spot.bid, 0)}</b>
            </span>
            <span aria-hidden>·</span>
            <span>{formatInt(tracks)} songs</span>
            <span aria-hidden>·</span>
            <span>{formatInt(plays)} plays</span>
          </p>
          {/* Kept off the counts line so a wrap never leaves a dangling "·". */}
          <p className="mt-1 text-xs chrome">
            last moved <TimeAgo ts={spot.raisedAt} />
          </p>
        </div>
      </div>

      <div className="plist-bar">
        <button
          type="button"
          className="fab"
          onClick={start}
          title={`Play ${spot.title}`}
          aria-label={`Play ${spot.title}`}
        >
          <PlayGlyph />
        </button>
        <button
          type="button"
          className="btn btn-hammer btn-lg"
          onClick={() => onTake(1)}
        >
          Take track 1 · {formatUsd(next, 0)}
        </button>
        <p className="text-xs chrome">
          {runnerUp > 0
            ? `${formatUsd(spot.bid - runnerUp, 0)} clear of track 2`
            : "nothing else on the tape yet"}
        </p>
      </div>
    </section>
  );
}

/** The column header above the list. Same grid as a row, so it lines up. */
export function TrackHead() {
  return (
    <div className="trow thead" aria-hidden>
      <span className="text-center">#</span>
      <span>title</span>
      <span className="hidden text-right sm:block">plays</span>
      <span className="hidden text-right lg:block">last moved</span>
      <span className="text-right">holding</span>
      <span className="hidden lg:block" />
    </div>
  );
}

type TrackRowProps = {
  spot: Spot;
  rank: number;
  /** Positive when the song moved up a track since the last confirmed payment. */
  move: number | null;
  onTake: (rank: number) => void;
  onOpen: (spot: Spot) => void;
};

/** One song on the tape. The number turns into a play button on hover. */
export function TrackRow({ spot, rank, move, onTake, onOpen }: TrackRowProps) {
  const { play } = useNowPlaying();
  const note = moveNote(move);

  function start() {
    onOpen(spot);
    play({ trackId: spot.trackId, title: spot.title, artist: spot.artist });
  }

  return (
    <li className={`trow ${rank === 1 ? "trow-lead" : ""}`}>
      <button
        type="button"
        className="trow-no"
        onClick={start}
        aria-label={`Play ${spot.title}`}
        title={`Play ${spot.title}`}
      >
        <span>{rank}</span>
        <PlayGlyph />
      </button>

      <div className="trow-main">
        <CoverArt
          as="button"
          trackId={spot.trackId}
          src={spot.thumbnailUrl}
          alt=""
          className="art"
          onClick={start}
          title={`Play ${spot.title}`}
        />
        <div className="min-w-0">
          <a
            href={spot.trackUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => onOpen(spot)}
            title={`Open the Spotify track page for ${spot.title}`}
            className="trow-title"
          >
            {spot.title}
          </a>
          {artistLine(spot.artist) ? (
            <p className="trow-sub">{artistLine(spot.artist)}</p>
          ) : null}
        </div>
      </div>

      <p className="tnum hidden text-right text-sm chrome sm:block">
        {formatInt(spot.clicks)}
      </p>

      <p className="hidden text-right text-xs chrome lg:block">
        <TimeAgo ts={spot.raisedAt} />
        {note ? <span className="block hammer">{note}</span> : null}
      </p>

      <p className="trow-price">{formatUsd(spot.bid, 0)}</p>

      <span className="hidden justify-self-end lg:block">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onTake(rank)}
          title={`Buy track ${rank}`}
        >
          Take · {formatUsd(spot.bid + 1, 0)}
        </button>
      </span>
    </li>
  );
}
