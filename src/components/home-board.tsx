"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { BidTicket } from "@/components/bid-ticket";
import { SpotifyContentNote } from "@/components/independence";
import { Figure } from "@/components/ledger";
import { TapeHeader, TrackHead, TrackRow } from "@/components/strip";
import { TimeAgo } from "@/components/time-ago";
import { VisitorStatsPanel } from "@/components/visitor-stats-panel";
import { filterSpots, rankDelta, useBoard } from "@/lib/board-context";
import { formatInt, formatUsd } from "@/lib/format";
import { deriveMarket } from "@/lib/market";
import { useVisitorStats } from "@/lib/visitor-stats";
import type { Spot, TimeFilter } from "@/lib/types";

const WHEN: { id: TimeFilter; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
  { id: "today", label: "Today" },
];

export function HomeBoard() {
  const { spots, activity, prevRanks, hydrated, registerPlay } = useBoard();
  const { stats } = useVisitorStats();
  const [targetRank, setTargetRank] = useState(1);
  const [when, setWhen] = useState<TimeFilter>("all");
  const formRef = useRef<HTMLFormElement>(null);

  const market = useMemo(() => deriveMarket(spots, activity), [spots, activity]);

  const ranks = useMemo(() => {
    const map = new Map<string, number>();
    spots.forEach((spot, i) => map.set(spot.id, i + 1));
    return map;
  }, [spots]);

  const lead = spots[0];
  const runnerUp = spots[1]?.bid ?? 0;
  const plays = useMemo(
    () => spots.reduce((n, s) => n + s.clicks, 0),
    [spots],
  );

  /** The whole tape, in order, filtered only by the time window. */
  const rack = useMemo(() => filterSpots(spots, when), [spots, when]);

  /** Tapping a slot on the tape carries that position down to the paddle. */
  const take = useCallback((rank: number) => {
    setTargetRank(Math.max(1, rank));
    const form = formRef.current;
    form?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      form?.querySelector<HTMLInputElement>("#track-url")?.focus();
    }, 420);
  }, []);


  const open = useCallback(
    (spot: Spot) => {
      registerPlay(spot.trackId);
    },
    [registerPlay],
  );

  return (
    <>
      <section className="rack" aria-labelledby="block-heading">
        <h2 id="block-heading" className="sr-only">
          Side A, track 1
        </h2>
        {lead ? (
          <TapeHeader
            spot={lead}
            runnerUp={runnerUp}
            tracks={market.tracks}
            plays={plays}
            onTake={take}
            onOpen={open}
          />
        ) : (
          <div className="card card-bd">
            <p className="slip">
              {hydrated ? "the tape is blank" : "reading the tape…"}
            </p>
            <p className="mt-2 text-sm">
              {hydrated
                ? "Nothing is written on it yet. Paste a song link below and take side A · track 1 for $1."
                : "Pulling the running order off the server."}
            </p>
          </div>
        )}

        <div className="figures mt-3">
          <Figure
            label="side a · track 1"
            value={formatUsd(market.topBid, 0)}
            note={
              market.lastBidAt ? (
                <>
                  last moved <TimeAgo ts={market.lastBidAt} />
                </>
              ) : (
                "the tape is open"
              )
            }
            lead
          />
          <Figure
            label="costs to take it"
            value={formatUsd(market.topBid + 1, 0)}
            note={`${formatUsd(market.spread, 0)} clear of track 2`}
          />
          <Figure
            label="songs on the tape"
            value={formatInt(market.tracks)}
            note={`${formatUsd(market.volume, 0)} written on in total`}
          />
          <Figure
            label="listening now"
            value={formatInt(stats?.liveNow ?? 0)}
            note={`${formatInt(stats?.viewsToday ?? 0)} views today`}
          />
        </div>

        {/*
          Sits between the first embed and the rest of the tape: the covers,
          the links and the player above and below it are all Spotify's, and
          this says so where a visitor is actually looking at them.
        */}
        <SpotifyContentNote className="mt-3" />
      </section>


      <section className="rack band" id="rack" aria-labelledby="rack-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="slip">side a track 1 to the end of side b</p>
            <h2 id="rack-heading" className="marquee mt-1.5 text-2xl">
              The tape
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

        {rack.length > 0 ? (
          <>
            <TrackHead />
            <ul className="space-y-px">
              {rack.map((spot) => {
                const rank = ranks.get(spot.id) ?? 0;
                return (
                  <TrackRow
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
          </>
        ) : (
          <div className="card card-bd">
            <p className="slip">nothing in that window</p>
            <p className="mt-2 text-sm">
              No songs were written on in that stretch of time. Widen it, or put
              one on the tape yourself.
            </p>
          </div>
        )}
      </section>

      <section className="rack band dashed-t" id="bid" aria-labelledby="bid-heading">
        <div className="mb-4">
          <p className="slip">pick a slot · pay for it · it&rsquo;s yours</p>
          <h2 id="bid-heading" className="marquee mt-1.5 text-2xl">
            Put a song on the tape
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <BidTicket
            targetRank={targetRank}
            setTargetRank={setTargetRank}
            onStarted={() => setTargetRank(1)}
            formRef={formRef}
          />

          <div className="space-y-3">
            <VisitorStatsPanel />

            <section className="card" aria-labelledby="filled">
              <div className="card-hd">
                <h3 id="filled" className="slip">
                  just written on
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
                            <TimeAgo ts={item.at} />
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm chrome">Nothing written on yet.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
