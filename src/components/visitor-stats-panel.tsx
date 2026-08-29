"use client";

import Link from "next/link";
import { HourlyBars, LedgerList, StoreNote } from "@/components/ledger";
import { formatInt } from "@/lib/format";
import { EMPTY_SNAPSHOT } from "@/lib/stats-types";
import { useVisitorStats } from "@/lib/visitor-stats";

/** Compact liner notes for the home page. */
export function VisitorStatsPanel() {
  const { stats, loading } = useVisitorStats();
  const s = stats ?? EMPTY_SNAPSHOT;

  return (
    <section className="card" aria-labelledby="house-ledger">
      <div className="card-hd">
        <h2 id="house-ledger" className="slip">
          liner notes
        </h2>
        <Link href="/stats" className="slip tie">
          all of them
        </Link>
      </div>

      <div className="card-bd space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Count label="listening now" value={s.liveNow} lead />
          <Count label="views today" value={s.viewsToday} />
          <Count label="visitors today" value={s.visitorsToday} />
          <Count label="views all time" value={s.viewsTotal} />
        </div>

        <div className="dashed-t pt-4">
          <p className="slip slip-quiet mb-2">views per hour</p>
          <HourlyBars hourly={s.hourly} />
        </div>

        <div className="dashed-t pt-4">
          <p className="slip slip-quiet mb-1.5">where they came from</p>
          <LedgerList
            rows={s.topReferrers.slice(0, 4)}
            empty={loading ? "Reading the notes…" : "Nothing recorded yet."}
            format={(key) => (key === "direct" ? "Direct or typed in" : key)}
          />
        </div>

        <StoreNote stats={s} />
      </div>
    </section>
  );
}

function Count({
  label,
  value,
  lead = false,
}: {
  label: string;
  value: number;
  lead?: boolean;
}) {
  return (
    <div>
      <p className="slip slip-quiet">{label}</p>
      <p
        className={`marquee mt-0.5 text-[1.625rem] leading-none ${lead ? "hammer" : ""}`}
      >
        {formatInt(value)}
      </p>
    </div>
  );
}
