import { afterEach, describe, expect, it } from "vitest";

import {
  callerKey,
  hit,
  resetRateLimitMemory,
  TRACK_LOOKUP_LIMIT,
  TRACK_LOOKUP_WINDOW_SEC,
} from "@/lib/rate-limit";

/** A request from one address, or from none at all. */
function req(ip?: string) {
  return new Request("https://playlistbid.test/api/track?id=abc", {
    headers: ip ? { "x-forwarded-for": ip } : undefined,
  });
}

async function spend(bucket: string, ip: string | undefined, times: number) {
  let last = await hit(bucket, req(ip), TRACK_LOOKUP_LIMIT, TRACK_LOOKUP_WINDOW_SEC);
  for (let i = 1; i < times; i += 1) {
    last = await hit(bucket, req(ip), TRACK_LOOKUP_LIMIT, TRACK_LOOKUP_WINDOW_SEC);
  }
  return last;
}

afterEach(() => {
  resetRateLimitMemory();
});

describe("callerKey", () => {
  it("takes the client hop, not the proxies appended after it", () => {
    const client = callerKey(req("203.0.113.7"));
    const throughProxy = callerKey(req("203.0.113.7, 70.41.3.18, 150.172.238.178"));
    expect(throughProxy).toBe(client);
  });

  it("never carries the address itself", () => {
    const key = callerKey(req("203.0.113.7"));
    expect(key).not.toContain("203.0.113.7");
    expect(key).toMatch(/^[0-9a-f]{16}$/);
  });

  it("tells two callers apart", () => {
    expect(callerKey(req("203.0.113.7"))).not.toBe(callerKey(req("203.0.113.8")));
  });

  it("puts everything unidentifiable in one bucket, so headerless is not a way out", () => {
    expect(callerKey(req())).toBe("anon");
    expect(callerKey(req("   "))).toBe("anon");
  });
});

describe("hit", () => {
  it("serves the whole allowance and refuses the one after it", async () => {
    const last = await spend("t1", "198.51.100.1", TRACK_LOOKUP_LIMIT);
    expect(last.ok).toBe(true);
    expect(last.remaining).toBe(0);

    const over = await hit("t1", req("198.51.100.1"), TRACK_LOOKUP_LIMIT, TRACK_LOOKUP_WINDOW_SEC);
    expect(over.ok).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.retryAfterSec).toBeGreaterThan(0);
    expect(over.retryAfterSec).toBeLessThanOrEqual(TRACK_LOOKUP_WINDOW_SEC);
  });

  it("counts down as it goes", async () => {
    const first = await hit("t2", req("198.51.100.2"), TRACK_LOOKUP_LIMIT, TRACK_LOOKUP_WINDOW_SEC);
    expect(first.remaining).toBe(TRACK_LOOKUP_LIMIT - 1);
    const second = await hit("t2", req("198.51.100.2"), TRACK_LOOKUP_LIMIT, TRACK_LOOKUP_WINDOW_SEC);
    expect(second.remaining).toBe(TRACK_LOOKUP_LIMIT - 2);
  });

  it("does not spend one caller's allowance on another", async () => {
    await spend("t3", "198.51.100.3", TRACK_LOOKUP_LIMIT + 5);
    const neighbour = await hit("t3", req("198.51.100.4"), TRACK_LOOKUP_LIMIT, TRACK_LOOKUP_WINDOW_SEC);
    expect(neighbour.ok).toBe(true);
    expect(neighbour.remaining).toBe(TRACK_LOOKUP_LIMIT - 1);
  });

  it("keeps buckets separate, so one endpoint cannot exhaust another", async () => {
    await spend("t4", "198.51.100.5", TRACK_LOOKUP_LIMIT + 1);
    const other = await hit("t5", req("198.51.100.5"), TRACK_LOOKUP_LIMIT, TRACK_LOOKUP_WINDOW_SEC);
    expect(other.ok).toBe(true);
  });

  it("lets a caller back in once the window it overran has passed", async () => {
    // Windows are keyed by index, so the next one is a different key entirely
    // rather than a counter something has to reset.
    const ip = "198.51.100.6";
    const over = await spend("t6", ip, TRACK_LOOKUP_LIMIT + 1);
    expect(over.ok).toBe(false);

    resetRateLimitMemory();
    const later = await hit("t6", req(ip), TRACK_LOOKUP_LIMIT, TRACK_LOOKUP_WINDOW_SEC);
    expect(later.ok).toBe(true);
  });

  it("leaves room for a page recovering every cover at once", async () => {
    const burst = await spend("t7", "198.51.100.7", 16);
    expect(burst.ok).toBe(true);
  });
});
