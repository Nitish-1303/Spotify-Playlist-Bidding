"use client";

import { useMemo } from "react";
import { Figure, HourlyBars, LedgerList, StoreNote } from "@/components/ledger";
import { useBoard } from "@/lib/board-context";
import { formatCompact, formatInt, formatUsd, timeAgo } from "@/lib/format";
import { deriveMarket } from "@/lib/market";
import { EMPTY_SNAPSHOT } from "@/lib/stats-types";
import { useVisitorStats } from "@/lib/visitor-stats";

const PAGE_NAMES: Record<string, string> = {
  "/": "The rack",
  "/stats": "Ledger",
  "/rules": "Conditions of sale",
  "/success": "Bid confirmed",
};

/** The full house ledger: traffic on the left of the brief, board on the right. */
export function StatsView() {
  const { stats, loading, refresh } = useVisitorStats();
  const { spots, activity } = useBoard();
  const market = useMemo(() => deriveMarket(spots, activity), [spots, activity]);
  const s = stats ?? EMPTY_SNAPSHOT;

  return (
    <div className="space-y-8">
      <section aria-labelledby="traffic">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="traffic" className="marquee text-xl">
            Who is in the room
          </h2>
          <button type="button" className="btn btn-ghost" onClick={refresh}>
            Refresh
          </button>
        </div>

        <div className="figures">
          <Figure
            label="in the room"
            value={formatInt(s.liveNow)}
            note="active in the last 5 minutes"
            lead
          />
          <Figure
            label="views today"
            value={formatInt(s.viewsToday)}
            note={`${formatInt(s.visitorsToday)} distinct visitors`}
          />
          <Figure
            label="views all time"
            value={formatCompact(s.viewsTotal)}
            note={`${formatCompact(s.visitorsTotal)} distinct visitors`}
          />
          <Figure
            label="pages counted"
            value={formatInt(s.topPages.length)}
            note={loading ? "reading the ledger…" : "with at least one view"}
          />
        </div>

        <div className="card mt-3">
          <div className="card-hd">
            <h3 className="slip">views per hour · last 24 hours</h3>
            <span className="slip slip-quiet">your local time</span>
          </div>
          <div className="card-bd">
            <HourlyBars hourly={s.hourly} />
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="card">
            <div className="card-hd">
              <h3 className="slip">most viewed pages</h3>
            </div>
            <div className="card-bd">
              <LedgerList
                rows={s.topPages}
                empty="Nothing recorded yet."
                format={(key) => PAGE_NAMES[key] ?? key}
              />
            </div>
          </div>
          <div className="card">
            <div className="card-hd">
              <h3 className="slip">where they came from</h3>
            </div>
            <div className="card-bd">
              <LedgerList
                rows={s.topReferrers}
                empty="Nothing recorded yet."
                format={(key) => (key === "direct" ? "Direct or typed in" : key)}
              />
            </div>
          </div>
        </div>

        <div className="mt-3">
          <StoreNote stats={s} />
        </div>
      </section>

      <section aria-labelledby="board-figures">
        <h2 id="board-figures" className="marquee mb-3 text-xl">
          What the rack is worth
        </h2>
        <div className="figures">
          <Figure
            label="standing bid"
            value={formatUsd(market.topBid, 0)}
            note={
              market.lastBidAt
                ? `last raised ${timeAgo(market.lastBidAt)}`
                : "no bids yet"
            }
            lead
          />
          <Figure
            label="on the rack"
            value={formatUsd(market.volume, 0)}
            note={`${formatInt(market.tracks)} lots listed`}
          />
          <Figure
            label="raised today"
            value={formatUsd(market.volume24h, 0)}
            note={`${formatInt(market.bids24h)} bids in 24 hours`}
          />
          <Figure
            label="plays from here"
            value={formatCompact(market.clicks)}
            note="counted on this site only"
          />
        </div>

        <div className="card mt-3">
          <div className="card-hd">
            <h3 className="slip">money by shelf</h3>
            <span className="slip slip-quiet">
              lead {formatUsd(market.spread, 0)} clear
            </span>
          </div>
          <div className="card-bd">
            <LedgerList
              rows={market.genreShare
                .filter((g) => g.total > 0)
                .map((g) => ({ key: g.genre, views: g.total }))}
              empty="No lots on the rack yet."
              format={(key) => key}
              formatValue={(n) => formatUsd(n, 0)}
            />
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed chrome">
          Board figures come from the confirmed bids saved in this browser. They
          are your own rack — visitor counts above are measured server-side for
          everyone.
        </p>
      </section>
    </div>
  );
}
