"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { BidTicket } from "@/components/bid-ticket";
import { Figure } from "@/components/ledger";
import { BlockLot, LotStrip } from "@/components/strip";
import { VisitorStatsPanel } from "@/components/visitor-stats-panel";
import { filterSpots, rankDelta, useBoard } from "@/lib/board-context";
import { formatInt, formatUsd, timeAgo } from "@/lib/format";
import { deriveMarket } from "@/lib/market";
import { useVisitorStats } from "@/lib/visitor-stats";
import { GENRES, type GenreFilter, type Spot, type TimeFilter } from "@/lib/types";

const WHEN: { id: TimeFilter; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
  { id: "today", label: "Today" },
];

export function HomeBoard() {
  const { spots, activity, prevRanks, registerClick } = useBoard();
  const { stats } = useVisitorStats();
  const [bid, setBid] = useState(1);
  const [genre, setGenre] = useState<GenreFilter>("All");
  const [when, setWhen] = useState<TimeFilter>("all");
  const formRef = useRef<HTMLFormElement>(null);

  const market = useMemo(() => deriveMarket(spots, activity), [spots, activity]);

  const ranks = useMemo(() => {
    const map = new Map<string, number>();
    spots.forEach((spot, i) => map.set(spot.id, i + 1));
    return map;
  }, [spots]);

  const shelves = useMemo(() => {
    const present = new Set(spots.map((s) => s.genre));
    return GENRES.filter((g) => g === "All" || present.has(g));
  }, [spots]);

  const lead = spots[0];
  const runnerUp = spots[1]?.bid ?? 0;

  const rack = useMemo(
    () =>
      filterSpots(spots, genre, when).filter((s) => s.id !== lead?.id),
    [spots, genre, when, lead?.id],
  );

  const take = useCallback((amount: number) => {
    setBid(Math.max(1, amount));
    const form = formRef.current;
    form?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      form?.querySelector<HTMLInputElement>("#track-url")?.focus();
    }, 420);
  }, []);

  const open = useCallback(
    (spot: Spot) => {
      registerClick(spot.id);
    },
    [registerClick],
  );

  return (
    <>
      <section className="rack" aria-labelledby="block-heading">
        <h2 id="block-heading" className="sr-only">
          The lot on the block
        </h2>
        {lead ? (
          <BlockLot
            spot={lead}
            runnerUp={runnerUp}
            onTake={take}
            onOpen={open}
          />
        ) : (
          <div className="card card-bd">
            <p className="slip">the rack is empty</p>
            <p className="mt-2 text-sm">
              Nothing is on the block. Paste a song link below and open the
              bidding at $1.
            </p>
          </div>
        )}

        <div className="figures mt-3">
          <Figure
            label="standing bid"
            value={formatUsd(market.topBid, 0)}
            note={
              market.lastBidAt
                ? `raised ${timeAgo(market.lastBidAt)}`
                : "bidding is open"
            }
            lead
          />
          <Figure
            label="takes the lead"
            value={formatUsd(market.topBid + 1, 0)}
            note={`${formatUsd(market.spread, 0)} clear of lot 02`}
          />
          <Figure
            label="lots on the rack"
            value={formatInt(market.tracks)}
            note={`${formatUsd(market.volume, 0)} standing in total`}
          />
          <Figure
            label="in the room"
            value={formatInt(stats?.liveNow ?? 0)}
            note={`${formatInt(stats?.viewsToday ?? 0)} views today`}
          />
        </div>
      </section>

      <section className="rack band" id="rack" aria-labelledby="rack-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="slip">lot 02 and below</p>
            <h2 id="rack-heading" className="marquee mt-1.5 text-2xl">
              The rack
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {WHEN.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWhen(w.id)}
                className={`punch ${when === w.id ? "punch-on" : ""}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="scroll-x mb-4 flex gap-1.5 pb-1">
          {shelves.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={`punch ${genre === g ? "punch-on" : ""}`}
            >
              {g}
            </button>
          ))}
        </div>

        {rack.length > 0 ? (
          <ul className="space-y-2">
            {rack.map((spot) => {
              const rank = ranks.get(spot.id) ?? 0;
              return (
                <LotStrip
                  key={spot.id}
                  spot={spot}
                  rank={rank}
                  move={rankDelta(prevRanks, spot.id, rank)}
                  onTake={take}
                  onOpen={open}
                />
              );
            })}
          </ul>
        ) : (
          <div className="card card-bd">
            <p className="slip">nothing on this shelf</p>
            <p className="mt-2 text-sm">
              No lots match {genre === "All" ? "that window" : `the ${genre} shelf`}.
              Clear the filters, or bid a song onto it.
            </p>
          </div>
        )}
      </section>

      <section className="rack band dashed-t" id="bid" aria-labelledby="bid-heading">
        <div className="mb-4">
          <p className="slip">raise your hand</p>
          <h2 id="bid-heading" className="marquee mt-1.5 text-2xl">
            Place a bid
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <BidTicket
            bid={bid}
            setBid={setBid}
            onConfirmed={() => setBid(1)}
            formRef={formRef}
          />

          <div className="space-y-3">
            <VisitorStatsPanel />

            <section className="card" aria-labelledby="filled">
              <div className="card-hd">
                <h3 id="filled" className="slip">
                  recently filled
                </h3>
              </div>
              <div className="card-bd">
                {activity.length > 0 ? (
                  <ul>
                    {activity.slice(0, 6).map((item) => (
                      <li key={item.id} className="lrow">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{item.title}</p>
                          <p className="strip-artist">{item.artist}</p>
                        </div>
                        <span className="text-right">
                          <span className="tnum block text-sm hammer">
                            {formatUsd(item.bid, 0)}
                          </span>
                          <span className="slip slip-quiet text-[0.625rem]">
                            {timeAgo(item.at)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm chrome">No bids filled yet.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
