/**
 * Visitor-stat counters.
 *
 * Durable path: any Redis with the Upstash REST protocol (Upstash Redis or
 * Vercel KV). Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or the
 * KV_REST_API_* equivalents, and counts survive redeploys and are shared by
 * every serverless instance.
 *
 * Fallback path: process memory. Real counts, but per-instance and reset on
 * redeploy — the UI labels itself accordingly via `snapshot.durable`.
 *
 * No IP addresses or user agents are stored. A visitor is a random id the
 * browser keeps in localStorage.
 */
import {
  HOURLY_BUCKETS,
  LIVE_WINDOW_MS,
  type HitType,
  type StatPoint,
  type StatsSnapshot,
} from "./stats-types";

const REST_URL = (
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  ""
).replace(/\/$/, "");

const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

const DURABLE = Boolean(REST_URL && REST_TOKEN);

const K = {
  viewsTotal: "pb:v:total",
  viewsDay: (day: string) => `pb:v:d:${day}`,
  viewsHour: (hour: string) => `pb:v:h:${hour}`,
  usersAll: "pb:u:all",
  usersDay: (day: string) => `pb:u:d:${day}`,
  pages: "pb:pages",
  refs: "pb:refs",
  live: "pb:live",
};

const DAY_TTL = 60 * 60 * 24 * 40;
const HOUR_TTL = 60 * 60 * 24 * 3;
const TOP_N = 8;
const VIEW_DEDUPE_MS = 5000;

export type Hit = {
  visitorId: string;
  path: string;
  referrer: string;
  type: HitType;
};

function dayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function hourKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 13);
}

/** Last 24 hour-keys, oldest → newest. */
function recentHours(now: number) {
  const keys: string[] = [];
  for (let i = HOURLY_BUCKETS - 1; i >= 0; i -= 1) {
    keys.push(hourKey(now - i * 3600_000));
  }
  return keys;
}

// Strips control bytes so a hostile path or referrer cannot smuggle newlines
// or NULs into a Redis key or a log line.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function cleanVisitorId(raw: unknown) {
  if (typeof raw !== "string") return "";
  const id = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return id.length >= 8 ? id : "";
}

/** Keep the pathname only — never query strings, which can carry PII. */
export function cleanPath(raw: unknown) {
  if (typeof raw !== "string" || !raw) return "/";
  const path = raw.replace(CONTROL_CHARS, "").split(/[?#]/)[0].slice(0, 120);
  if (!path.startsWith("/")) return "/";
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : "/";
}

/** Reduce a referrer to a bare hostname; own-site and empty become "direct". */
export function cleanReferrer(raw: unknown, selfHost?: string) {
  if (typeof raw !== "string" || !raw.trim()) return "direct";
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || (selfHost && host === selfHost.replace(/^www\./, ""))) {
      return "direct";
    }
    return host.replace(CONTROL_CHARS, "").slice(0, 80);
  } catch {
    return "direct";
  }
}

/* —— in-memory fallback —— */

type MemStore = {
  since: number;
  viewsTotal: number;
  viewsByDay: Map<string, number>;
  viewsByHour: Map<string, number>;
  visitorsByDay: Map<string, Set<string>>;
  visitorsAll: Set<string>;
  pages: Map<string, number>;
  refs: Map<string, number>;
  live: Map<string, number>;
  lastView: Map<string, number>;
};

function freshMem(): MemStore {
  return {
    since: Date.now(),
    viewsTotal: 0,
    viewsByDay: new Map(),
    viewsByHour: new Map(),
    visitorsByDay: new Map(),
    visitorsAll: new Set(),
    pages: new Map(),
    refs: new Map(),
    live: new Map(),
    lastView: new Map(),
  };
}

// Survive dev hot-reloads so counts don't reset on every file save.
const globalMem = globalThis as typeof globalThis & { __pbStats?: MemStore };
const mem = (globalMem.__pbStats ??= freshMem());

/** Keep the largest `limit` entries so a long-lived process stays bounded. */
function trimMap(map: Map<string, number>, limit: number) {
  if (map.size <= limit) return;
  const keep = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  map.clear();
  for (const [k, v] of keep) map.set(k, v);
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topFromMap(map: Map<string, number>): StatPoint[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_N)
    .map(([key, views]) => ({ key, views }));
}

function recordMem(hit: Hit, now: number) {
  const day = dayKey(now);

  for (const [id, seen] of mem.live) {
    if (now - seen > LIVE_WINDOW_MS) mem.live.delete(id);
  }
  mem.live.set(hit.visitorId, now);

  if (hit.type !== "view") return;

  const dedupeKey = `${hit.visitorId}|${hit.path}`;
  const last = mem.lastView.get(dedupeKey);
  if (last && now - last < VIEW_DEDUPE_MS) return;
  mem.lastView.set(dedupeKey, now);
  trimMap(mem.lastView, 5000);

  mem.viewsTotal += 1;
  bump(mem.viewsByDay, day);
  bump(mem.viewsByHour, hourKey(now));
  bump(mem.pages, hit.path);
  bump(mem.refs, hit.referrer);

  let dayVisitors = mem.visitorsByDay.get(day);
  if (!dayVisitors) {
    dayVisitors = new Set();
    mem.visitorsByDay.set(day, dayVisitors);
  }
  if (dayVisitors.size < 50_000) dayVisitors.add(hit.visitorId);
  if (mem.visitorsAll.size < 200_000) mem.visitorsAll.add(hit.visitorId);

  trimMap(mem.viewsByDay, 60);
  trimMap(mem.viewsByHour, 72);
  trimMap(mem.pages, 200);
  trimMap(mem.refs, 200);
  if (mem.visitorsByDay.size > 40) {
    const oldest = [...mem.visitorsByDay.keys()].sort()[0];
    mem.visitorsByDay.delete(oldest);
  }
}

function readMem(now: number): StatsSnapshot {
  const day = dayKey(now);
  for (const [id, seen] of mem.live) {
    if (now - seen > LIVE_WINDOW_MS) mem.live.delete(id);
  }
  return {
    liveNow: mem.live.size,
    viewsToday: mem.viewsByDay.get(day) ?? 0,
    viewsTotal: mem.viewsTotal,
    visitorsToday: mem.visitorsByDay.get(day)?.size ?? 0,
    visitorsTotal: mem.visitorsAll.size,
    hourly: recentHours(now).map((key) => ({
      key,
      views: mem.viewsByHour.get(key) ?? 0,
    })),
    topPages: topFromMap(mem.pages),
    topReferrers: topFromMap(mem.refs),
    durable: false,
    since: mem.since,
  };
}

/* —— durable path (Upstash REST protocol) —— */

type Cmd = (string | number)[];

async function pipeline(commands: Cmd[]): Promise<unknown[]> {
  const res = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`redis http ${res.status}`);
  const payload = (await res.json()) as { result?: unknown; error?: string }[];
  if (!Array.isArray(payload)) throw new Error("redis: unexpected response");
  return payload.map((entry) => {
    if (entry.error) throw new Error(`redis: ${entry.error}`);
    return entry.result;
  });
}

function toInt(value: unknown) {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Upstash returns ZRANGE … WITHSCORES as a flat [member, score, …] array. */
function toStatPoints(value: unknown): StatPoint[] {
  if (!Array.isArray(value)) return [];
  const out: StatPoint[] = [];
  for (let i = 0; i < value.length - 1; i += 2) {
    out.push({ key: String(value[i]), views: toInt(value[i + 1]) });
  }
  return out;
}

async function recordRedis(hit: Hit, now: number) {
  const cutoff = now - LIVE_WINDOW_MS;
  const commands: Cmd[] = [
    ["ZADD", K.live, now, hit.visitorId],
    ["ZREMRANGEBYSCORE", K.live, 0, cutoff],
  ];

  if (hit.type === "view") {
    const day = dayKey(now);
    const hour = hourKey(now);
    commands.push(
      ["INCR", K.viewsTotal],
      ["INCR", K.viewsDay(day)],
      ["EXPIRE", K.viewsDay(day), DAY_TTL],
      ["INCR", K.viewsHour(hour)],
      ["EXPIRE", K.viewsHour(hour), HOUR_TTL],
      ["PFADD", K.usersAll, hit.visitorId],
      ["PFADD", K.usersDay(day), hit.visitorId],
      ["EXPIRE", K.usersDay(day), DAY_TTL],
      ["ZINCRBY", K.pages, 1, hit.path],
      ["ZINCRBY", K.refs, 1, hit.referrer],
    );
  }

  await pipeline(commands);
}

async function readRedis(now: number): Promise<StatsSnapshot> {
  const day = dayKey(now);
  const hours = recentHours(now);
  const results = await pipeline([
    ["ZREMRANGEBYSCORE", K.live, 0, now - LIVE_WINDOW_MS],
    ["ZCARD", K.live],
    ["GET", K.viewsTotal],
    ["GET", K.viewsDay(day)],
    ["PFCOUNT", K.usersAll],
    ["PFCOUNT", K.usersDay(day)],
    ["ZRANGE", K.pages, 0, TOP_N - 1, "REV", "WITHSCORES"],
    ["ZRANGE", K.refs, 0, TOP_N - 1, "REV", "WITHSCORES"],
    ["MGET", ...hours.map((h) => K.viewsHour(h))],
  ]);

  const hourValues = Array.isArray(results[8]) ? (results[8] as unknown[]) : [];

  return {
    liveNow: toInt(results[1]),
    viewsToday: toInt(results[3]),
    viewsTotal: toInt(results[2]),
    visitorsToday: toInt(results[5]),
    visitorsTotal: toInt(results[4]),
    hourly: hours.map((key, i) => ({ key, views: toInt(hourValues[i]) })),
    topPages: toStatPoints(results[6]),
    topReferrers: toStatPoints(results[7]),
    durable: true,
    since: 0,
  };
}

/* —— public API —— */

export function statsAreDurable() {
  return DURABLE;
}

/** Records a hit. Never throws — a stats outage must not break a page view. */
export async function recordHit(hit: Hit) {
  const now = Date.now();
  if (DURABLE) {
    try {
      await recordRedis(hit, now);
      return;
    } catch (err) {
      console.error("[stats] redis write failed, using memory", err);
    }
  }
  recordMem(hit, now);
}

/** Reads a snapshot. Falls back to in-process counts if Redis is unreachable. */
export async function readStats(): Promise<StatsSnapshot> {
  const now = Date.now();
  if (DURABLE) {
    try {
      return await readRedis(now);
    } catch (err) {
      console.error("[stats] redis read failed, using memory", err);
    }
  }
  return readMem(now);
}
