import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which credentials count, and where. The interesting case is a Vercel preview
 * build: the Upstash marketplace integration attaches its KV_REST_API_* pair to
 * Preview as well as Production and will not let that be narrowed, so a branch
 * deployment would otherwise write to the tape people paid for.
 *
 * redis.ts reads the environment once, at import time, so every case here
 * resets the module registry and imports it again.
 */

const KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "VERCEL_ENV",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.resetModules();
});

async function loadRedis() {
  vi.resetModules();
  return import("@/lib/redis");
}

describe("redisConfigured", () => {
  it("is false with no credentials at all", async () => {
    const { redisConfigured } = await loadRedis();
    expect(redisConfigured()).toBe(false);
  });

  it("accepts the integration's KV_REST_API_* pair outside preview", async () => {
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.VERCEL_ENV = "production";

    const { redisConfigured } = await loadRedis();
    expect(redisConfigured()).toBe(true);
  });

  it("ignores the KV_REST_API_* pair on a preview build", async () => {
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.VERCEL_ENV = "preview";

    const { redisConfigured } = await loadRedis();
    expect(redisConfigured()).toBe(false);
  });

  it("still honours an explicit UPSTASH_* pair on a preview build", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://preview.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "preview-token";
    process.env.VERCEL_ENV = "preview";

    const { redisConfigured } = await loadRedis();
    expect(redisConfigured()).toBe(true);
  });

  it("needs both halves of a pair, not just one", async () => {
    process.env.KV_REST_API_URL = "https://example.upstash.io";

    const { redisConfigured } = await loadRedis();
    expect(redisConfigured()).toBe(false);
  });
});

describe("the tape store follows the same rule", () => {
  it("reports itself not durable on a preview build", async () => {
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.VERCEL_ENV = "preview";

    vi.resetModules();
    const { boardIsDurable } = await import("@/lib/tape-store");
    expect(boardIsDurable()).toBe(false);
  });
});
