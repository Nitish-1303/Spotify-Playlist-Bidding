/**
 * A ceiling on how often one caller can reach a public endpoint.
 *
 * The tape has one endpoint anybody can reach without paying or signing in:
 * the metadata lookup behind a pasted link. Every hit can cost up to three
 * outbound Spotify requests, and Spotify rate-limits us, not the caller. So a
 * script hammering it does not just cost us compute — it spends the quota the
 * paddle needs to price a real paste, and takes the cover art down with it.
 *
 * Fixed window, counted per caller. The window index is part of the key, so a
 * window ends by the key expiring rather than by anything having to reset it:
 * no TTL to race over, and a caller who keeps trying is not held past the
 * window they overran.
 *
 * Durable across instances when Redis is wired up, per-instance otherwise.
 * Either way it fails open — see `hit` below.
 *
 * No IP address is stored, here or anywhere else. The counter is keyed by a
 * truncated hash, which is enough to tell two callers apart and not enough to
 * recover who either of them was.
 */
import { createHash } from "node:crypto";
import { pipeline, redisConfigured, toInt, type RedisCmd } from "./redis";

const DURABLE = redisConfigured();

/**
 * Generous on purpose. One paste is one request, but a page whose cover art
 * failed to load recovers each thumbnail through the same endpoint, so an
 * honest visitor on a bad connection can legitimately arrive in a burst of a
 * dozen or more. This is set to stop a loop, not to meter a person.
 */
export const TRACK_LOOKUP_LIMIT = 40;
export const TRACK_LOOKUP_WINDOW_SEC = 60;

export type RateVerdict = {
  ok: boolean;
  /** How many requests are left in this window, floored at zero. */
  remaining: number;
  /** Whole seconds until the window ends — what Retry-After should say. */
  retryAfterSec: number;
};

/**
 * Who is asking, as far as we are willing to know.
 *
 * Vercel sets x-forwarded-for and appends to it, so the first hop is the
 * client and the rest are proxies; anything a caller puts there themselves
 * ends up after it. Behind another proxy the first hop is forgeable, which
 * caps what this can promise: it stops a naive loop, not a determined
 * attacker with a pool of addresses.
 *
 * Everything unidentifiable shares one bucket. That is deliberate — it means
 * a caller cannot escape the limit by arriving without headers.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const raw =
    forwarded.split(",")[0].trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "";
  if (!raw) return "anon";
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/* —— in-memory fallback —— */

// Survives dev hot-reloads, so saving a file does not hand everybody a fresh
// allowance.
const globalMem = globalThis as typeof globalThis & {
  __pbRate?: Map<string, number>;
};
const mem = (globalMem.__pbRate ??= new Map<string, number>());

/**
 * Bounded, because this map is keyed by caller and would otherwise grow with
 * every distinct visitor a long-lived instance ever sees. Keys carry their own
 * window index, so anything from an earlier window is already spent and safe
 * to drop; only when a single window is genuinely that busy does this clear
 * wholesale, which forgives rather than punishes.
 */
function trimMem(currentWindow: number) {
  if (mem.size < 10_000) return;
  const suffix = `:${currentWindow}`;
  for (const key of mem.keys()) {
    if (!key.endsWith(suffix)) mem.delete(key);
  }
  if (mem.size >= 10_000) mem.clear();
}

function countMem(key: string, currentWindow: number) {
  trimMem(currentWindow);
  const next = (mem.get(key) ?? 0) + 1;
  mem.set(key, next);
  return next;
}

/* —— durable path —— */

async function countRedis(key: string, windowSec: number) {
  const commands: RedisCmd[] = [
    ["INCR", key],
    ["EXPIRE", key, windowSec],
  ];
  const [count] = await pipeline(commands);
  return toInt(count);
}

/* —— public API —— */

/**
 * Counts one request against `bucket` and says whether to serve it.
 *
 * Fails open. If the counter is unreachable the request is allowed, because
 * refusing an honest paste over a store outage breaks the product for everyone
 * to defend against a caller who may not exist. The failure is logged so the
 * absence of a ceiling is visible rather than silent.
 */
export async function hit(
  bucket: string,
  request: Request,
  limit: number,
  windowSec: number,
): Promise<RateVerdict> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const windowIndex = Math.floor(now / windowMs);
  const key = `pb:rl:${bucket}:${callerKey(request)}:${windowIndex}`;
  const retryAfterSec = Math.max(
    1,
    Math.ceil(((windowIndex + 1) * windowMs - now) / 1000),
  );

  let count: number;
  if (DURABLE) {
    try {
      count = await countRedis(key, windowSec);
    } catch (err) {
      console.error("[rate] redis unreachable, request allowed", err);
      return { ok: true, remaining: limit, retryAfterSec };
    }
  } else {
    count = countMem(key, windowIndex);
  }

  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSec,
  };
}

/** Test seam: drop the in-process counters. No effect on the durable path. */
export function resetRateLimitMemory() {
  mem.clear();
}
