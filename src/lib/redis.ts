/**
 * Upstash-REST Redis access, shared by the visitor stats and the tape store.
 *
 * Either naming works, so an Upstash database and a Vercel KV binding both drop
 * straight in:
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *   KV_REST_API_URL        / KV_REST_API_TOKEN
 *
 * Server-only. Nothing here is imported from a client component, and the token
 * never leaves the server.
 */

const REST_URL = (
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  ""
).replace(/\/$/, "");

const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

/** True when a durable store is wired up. False means callers fall back. */
export function redisConfigured() {
  return Boolean(REST_URL && REST_TOKEN);
}

export type RedisCmd = (string | number)[];

/** Runs commands in one round trip. Throws on transport or command errors. */
export async function pipeline(commands: RedisCmd[]): Promise<unknown[]> {
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

/** A single command. */
export async function command(cmd: RedisCmd): Promise<unknown> {
  const [result] = await pipeline([cmd]);
  return result;
}

/**
 * EVAL a Lua script. Used for the one thing a pipeline cannot express: commit
 * this write only if nothing else has written since I read.
 */
export async function evalScript(
  script: string,
  keys: string[],
  args: (string | number)[],
): Promise<unknown> {
  return command(["EVAL", script, keys.length, ...keys, ...args]);
}

export function toInt(value: unknown) {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}
