"use client";

import { CoverArt } from "@/components/cover-art";
import { formatMoney, timeAgo } from "@/lib/format";
import type { Spot } from "@/lib/types";

type LeaderboardCardProps = {
  spot: Spot;
  rank: number;
  ready: boolean;
  onPlay: () => void;
  onOpen: () => void;
  onClaim: () => void;
};

export function LeaderboardCard({
  spot,
  rank,
  ready,
  onPlay,
  onOpen,
  onClaim,
}: LeaderboardCardProps) {
  const claimFor = spot.bid + 1;

  return (
    <article className="lb-card">
      <div className="lb-card-main">
        <span className={`rank-badge ${rank <= 3 ? "rank-badge-top" : ""}`}>
          {rank}
        </span>
        <button
          type="button"
          onClick={onPlay}
          className="lb-card-cover"
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
            className="block truncate font-semibold hover:underline"
          >
            {spot.title}
          </a>
          <p className="mt-0.5 truncate text-sm text-[#a7a7a7]">{spot.artist}</p>
          <p className="mt-1.5 text-xs text-[#a7a7a7]">
            {spot.genre}
            <span className="mx-1.5 text-white/20">·</span>
            {ready ? timeAgo(spot.raisedAt) : "…"}
            <span className="mx-1.5 text-white/20">·</span>
            {spot.clicks} clicks
          </p>
        </div>
        <div className="lb-card-bid">
          <div className="text-lg font-bold tabular-nums text-(--accent)">
            {formatMoney(spot.bid)}
          </div>
          <button type="button" className="lb-claim-btn" onClick={onClaim}>
            Claim this rank for {formatMoney(claimFor)} ↗
          </button>
        </div>
      </div>
    </article>
  );
}
