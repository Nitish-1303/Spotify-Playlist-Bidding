"use client";

import { formatCompact, formatInt, hourLabel } from "@/lib/format";
import type { StatPoint, StatsSnapshot } from "@/lib/stats-types";

/** One typed slip in the figures row. */
export function Figure({
  label,
  value,
  note,
  lead = false,
}: {
  label: string;
  value: string;
  note?: string;
  lead?: boolean;
}) {
  return (
    <div className={`figure ${lead ? "figure-lead" : ""}`}>
      <p className="slip">{label}</p>
      <p className="figure-value">{value}</p>
      {note && <p className="figure-note">{note}</p>}
    </div>
  );
}

/** Views per hour for the last 24 hours, oldest to newest. */
export function HourlyBars({ hourly }: { hourly: StatPoint[] }) {
  const points =
    hourly.length > 0
      ? hourly
      : Array.from({ length: 24 }, () => ({ key: "", views: 0 }));
  const peak = Math.max(1, ...points.map((p) => p.views));
  const last = points.length - 1;

  return (
    <div>
      <div className="bars" role="img" aria-label="Views per hour, last 24 hours">
        {points.map((point, i) => {
          const height = point.views === 0 ? 2 : (point.views / peak) * 100;
          const cls =
            point.views === 0 ? "bar bar-empty" : i === last ? "bar bar-now" : "bar";
          return (
            <div
              key={point.key || i}
              className={cls}
              style={{ height: `${height}%` }}
              title={
                point.key
                  ? `${hourLabel(point.key)} — ${formatInt(point.views)} views`
                  : undefined
              }
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between">
        <span className="slip slip-quiet">
          {points[0]?.key ? hourLabel(points[0].key) : "24h ago"}
        </span>
        <span className="slip slip-quiet">peak {formatInt(peak)}/h</span>
        <span className="slip" style={{ color: "var(--hammer)" }}>
          now
        </span>
      </div>
    </div>
  );
}

/** Top pages or referrers as a ranked list with proportion bars. */
export function LedgerList({
  rows,
  empty,
  format = (key: string) => key,
  formatValue = formatCompact,
}: {
  rows: StatPoint[];
  empty: string;
  format?: (key: string) => string;
  formatValue?: (value: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm chrome">{empty}</p>;
  }
  const peak = Math.max(1, ...rows.map((r) => r.views));

  return (
    <ul>
      {rows.map((row) => (
        <li key={row.key} className="lrow">
          <div className="min-w-0">
            <p className="truncate text-sm">{format(row.key)}</p>
            <div className="ltrack">
              <div
                className="lfill"
                style={{ width: `${Math.max(3, (row.views / peak) * 100)}%` }}
              />
            </div>
          </div>
          <span className="tnum text-sm">{formatValue(row.views)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Says plainly where the numbers are kept. */
export function StoreNote({ stats }: { stats: StatsSnapshot }) {
  if (stats.durable) {
    return (
      <p className="text-xs leading-relaxed chrome">
        Counts are stored in Redis, so they survive every deploy. A visitor is a
        random id kept in your own browser — no IP addresses, cookies or user
        agents are recorded.
      </p>
    );
  }
  const since = stats.since
    ? new Date(stats.since).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  return (
    <p className="text-xs leading-relaxed chrome">
      Counting in server memory{since ? ` since ${since}` : ""}, so totals reset
      when the app restarts. Set UPSTASH_REDIS_REST_URL and
      UPSTASH_REDIS_REST_TOKEN to keep them for good. A visitor is a random id
      kept in your own browser — no IP addresses, cookies or user agents are
      recorded.
    </p>
  );
}
