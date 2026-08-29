/** Shapes shared by the stats API route, the store, and the client widgets. */

export type StatPoint = { key: string; views: number };

export type StatsSnapshot = {
  /** Distinct visitors that pinged inside LIVE_WINDOW_MS. */
  liveNow: number;
  viewsToday: number;
  viewsTotal: number;
  visitorsToday: number;
  visitorsTotal: number;
  /** 24 buckets, oldest → newest. `key` is an ISO-ish "YYYY-MM-DDTHH" hour. */
  hourly: StatPoint[];
  topPages: StatPoint[];
  topReferrers: StatPoint[];
  /** True when counts are persisted in Redis/KV rather than process memory. */
  durable: boolean;
  /** Epoch ms the current counting window started (0 when durable). */
  since: number;
};

export type HitType = "view" | "ping";

export const LIVE_WINDOW_MS = 5 * 60 * 1000;
export const HEARTBEAT_MS = 20 * 1000;
export const HOURLY_BUCKETS = 24;

export const EMPTY_SNAPSHOT: StatsSnapshot = {
  liveNow: 0,
  viewsToday: 0,
  viewsTotal: 0,
  visitorsToday: 0,
  visitorsTotal: 0,
  hourly: [],
  topPages: [],
  topReferrers: [],
  durable: false,
  since: 0,
};
