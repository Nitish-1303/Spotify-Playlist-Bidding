import { startOfDay } from "./format";
import type { Activity, Spot } from "./types";

export type MarketStats = {
  /** Highest live bid on the board. */
  topBid: number;
  /** #1 minus #2 — what it currently costs to hold the lead. */
  spread: number;
  /** Sum of every live bid. */
  volume: number;
  /** Money confirmed in the last 24 hours. */
  volume24h: number;
  bids24h: number;
  bidsToday: number;
  tracks: number;
  clicks: number;
  lastBidAt: number | null;
  /** Bid dollars per hour for the last 24 hours, oldest → newest. */
  hourlyFlow: number[];
};

const HOUR = 3600_000;

export function deriveMarket(spots: Spot[], activity: Activity[]): MarketStats {
  const now = Date.now();
  const dayAgo = now - 24 * HOUR;
  const todayStart = startOfDay();

  const sorted = [...spots].sort((a, b) => b.bid - a.bid);
  const topBid = sorted[0]?.bid ?? 0;
  const secondBid = sorted[1]?.bid ?? 0;

  let volume = 0;
  let clicks = 0;
  for (const spot of spots) {
    volume += spot.bid;
    clicks += spot.clicks;
  }

  let volume24h = 0;
  let bids24h = 0;
  let bidsToday = 0;
  const hourlyFlow = new Array<number>(24).fill(0);

  for (const item of activity) {
    if (item.at >= todayStart) bidsToday += 1;
    if (item.at < dayAgo) continue;
    volume24h += item.bid;
    bids24h += 1;
    const bucket = 23 - Math.floor((now - item.at) / HOUR);
    if (bucket >= 0 && bucket < 24) hourlyFlow[bucket] += item.bid;
  }

  return {
    topBid,
    spread: Math.max(0, topBid - secondBid),
    volume,
    volume24h,
    bids24h,
    bidsToday,
    tracks: spots.length,
    clicks,
    lastBidAt: activity[0]?.at ?? null,
    hourlyFlow,
  };
}
