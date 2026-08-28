"use client";

import { motion } from "framer-motion";
import { CoverArt } from "@/components/cover-art";
import { TiltCard } from "@/components/tilt-card";
import { formatMoney, timeAgo } from "@/lib/format";
import type { Spot } from "@/lib/types";

type BoardStageProps = {
  topThree: Spot[];
  ready: boolean;
  onPlay: (trackId: string) => void;
  onOpen: (id: string) => void;
};

export function BoardStage({ topThree, ready, onPlay, onOpen }: BoardStageProps) {
  if (topThree.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[#a7a7a7]">
        No songs yet. Place the first bid.
      </p>
    );
  }

  return (
    <div className="board-stage">
      <div className="board-stage-grid" aria-hidden>
        <span className="board-stage-orb board-stage-orb-a" />
        <span className="board-stage-orb board-stage-orb-b" />
        <span className="board-stage-floor" />
      </div>

      <div className="podium">
        {topThree.map((spot, spotIndex) => {
          const rank = spotIndex + 1;
          return (
            <motion.div
              key={spot.id}
              className={`podium-slot podium-rank-${rank}`}
              initial={{ opacity: 0, y: 48, rotateX: 18 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{
                delay: spotIndex * 0.12,
                type: "spring",
                stiffness: 120,
                damping: 16,
              }}
            >
              <TiltCard
                intensity={rank === 1 ? 16 : 12}
                floatDelay={spotIndex * 0.35}
                className={rank === 1 ? "tilt-featured" : ""}
              >
                <PodiumCard
                  spot={spot}
                  rank={rank}
                  ready={ready}
                  onPlay={() => onPlay(spot.trackId)}
                  onOpen={() => onOpen(spot.id)}
                />
              </TiltCard>
              <div className={`podium-base podium-base-${rank}`} aria-hidden>
                <span>#{rank}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function PodiumCard({
  spot,
  rank,
  ready,
  onPlay,
  onOpen,
}: {
  spot: Spot;
  rank: number;
  ready: boolean;
  onPlay: () => void;
  onOpen: () => void;
}) {
  return (
    <article className={`podium-card ${rank === 1 ? "podium-card-first" : ""}`}>
      <button
        type="button"
        onClick={onPlay}
        className="podium-cover"
        aria-label={`Preview ${spot.title}`}
      >
        <CoverArt
          trackId={spot.trackId}
          src={spot.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </button>
      <div className="podium-meta">
        <div className="flex items-center justify-between gap-2">
          <span className={`rank-badge ${rank === 1 ? "rank-badge-top" : ""}`}>{rank}</span>
          <span className="text-lg font-bold tabular-nums text-[var(--accent)]">
            {formatMoney(spot.bid)}
          </span>
        </div>
        <a
          href={spot.trackUrl}
          target="_blank"
          rel="noreferrer"
          onClick={onOpen}
          className="mt-2 block truncate text-base font-semibold hover:underline"
        >
          {spot.title}
        </a>
        <p className="truncate text-sm text-[#a7a7a7]">
          {spot.artist}
          {ready ? ` · ${timeAgo(spot.raisedAt)}` : ""}
        </p>
      </div>
    </article>
  );
}

type BoardRowProps = {
  spot: Spot;
  rank: number;
  ready: boolean;
  index: number;
  onPlay: () => void;
  onOpen: () => void;
  onList: () => void;
};

export function BoardRow3D({
  spot,
  rank,
  ready,
  index,
  onPlay,
  onOpen,
  onList,
}: BoardRowProps) {
  return (
    <motion.li
      className="board-row-3d"
      initial={{ opacity: 0, x: -24, rotateY: 8 }}
      whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: Math.min(index * 0.04, 0.4), type: "spring", stiffness: 140, damping: 18 }}
      whileHover={{ z: 24, scale: 1.015 }}
    >
      <div className="board-row-3d-inner">
        <span className={`rank-badge ${rank === 1 ? "rank-badge-top" : ""}`}>{rank}</span>
        <button
          type="button"
          onClick={onPlay}
          className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#242424] shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
          aria-label={`Preview ${spot.title}`}
        >
          <CoverArt
            trackId={spot.trackId}
            src={spot.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </button>
        <div className="min-w-0 flex-1">
          <a
            href={spot.trackUrl}
            target="_blank"
            rel="noreferrer"
            onClick={onOpen}
            className="block truncate font-medium hover:underline"
          >
            {spot.title}
          </a>
          <p className="truncate text-sm text-[#a7a7a7]">
            {spot.artist}
            <span className="mx-1.5 text-white/20">·</span>
            {spot.genre}
            {ready ? (
              <>
                <span className="mx-1.5 text-white/20">·</span>
                {timeAgo(spot.raisedAt)}
              </>
            ) : null}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold tabular-nums">{formatMoney(spot.bid)}</div>
          <button
            type="button"
            className="text-xs text-[#a7a7a7] hover:text-(--accent)"
            onClick={onList}
          >
            {spot.askingPrice ? `Ask ${formatMoney(spot.askingPrice)}` : "List"}
          </button>
        </div>
      </div>
    </motion.li>
  );
}
