/**
 * The tape, server-side.
 *
 * The tape used to live in each visitor's localStorage, which made it
 * impossible for a payment webhook to move it: a server cannot write to a
 * browser, and a browser can edit its own storage. So the tape is one shared
 * document here, and the only thing that changes it is a signature-verified
 * Dodo payment.
 *
 * Durable path: any Redis speaking the Upstash REST protocol (Upstash Redis or
 * Vercel KV). Writes commit through a version check, so two payments landing at
 * the same instant cannot interleave and lose one another.
 *
 * Fallback path: process memory. Fine for `npm run dev`; on serverless it is
 * per-instance and resets on redeploy, so `boardIsDurable()` is false and the
 * paddle refuses to take money. Nobody gets charged for a slot on a tape that
 * is about to evaporate.
 *
 * Server-only. Never import this from a client component.
 */
import { evalScript, pipeline, redisConfigured, toInt } from "./redis";
import { chartOrder } from "./ranks";
import { SEED_ACTIVITY, SEED_SPOTS } from "./seed";
import { rankMap } from "./tape-rules";
import type { BoardState, PaymentTransaction } from "./types";

const K_BOARD = "pb:board";
const K_VERSION = "pb:board:v";
/** Stands in when a commit does not touch the event or transaction keys. */
const K_NONE = "pb:unused";

const TX_TTL = 60 * 60 * 24 * 30;
const EVENT_TTL = 60 * 60 * 24 * 30;
const PLAY_DEDUPE_TTL = 60 * 60;

const txKey = (id: string) => `pb:tx:${id}`;
const eventKey = (id: string) => `pb:evt:${id}`;
const settledKey = (id: string) => `pb:settled:${id}`;
const playKey = (visitorId: string, trackId: string) =>
  `pb:play:${visitorId}:${trackId}`;

export function boardIsDurable() {
  return redisConfigured();
}

/** The tape as it starts out, before anyone has paid for anything. */
export function seedBoard(): BoardState {
  // Sorted here so the stored document is always in chart order, matching what
  // a finalised payment writes back.
  const spots = chartOrder(SEED_SPOTS);
  return {
    spots,
    activity: SEED_ACTIVITY,
    prevRanks: rankMap(spots),
  };
}

export type Versioned = { board: BoardState; version: number };

/** Why a commit did not go through, or `ok` if it did. */
export type CommitOutcome = "ok" | "conflict" | "duplicate" | "stale";

export type Commit = {
  /** The version the caller read. A mismatch means someone else got there. */
  expectedVersion: number;
  /** Omit to leave the tape alone. */
  board?: BoardState;
  transaction?: PaymentTransaction;
  /**
   * Webhook delivery id. Claimed as part of the same commit, so a redelivered
   * event cannot move the tape twice however the two calls interleave.
   */
  eventId?: string;
  /**
   * Transaction id being settled for good. Marks it, so a commit passing
   * `onlyIfUnsettled` for the same id afterwards is refused.
   */
  settles?: string;
  /**
   * Transaction id that must not have settled yet. Checked inside the same
   * indivisible step as the write, so a slow `payment.processing` redelivery
   * cannot land on top of the `payment.succeeded` that overtook it.
   */
  onlyIfUnsettled?: string;
};

/* —— parsing —— */

/**
 * Reads a stored board back.
 *
 * Deliberately forgiving about the document as a whole — a half-written or
 * unparseable one yields null and the caller falls back to the seed rather than
 * crashing a page render — and deliberately incurious about extra fields on a
 * spot. Records written before the shelf feature was removed still carry a
 * `genre`, and those songs must keep their positions and play counts. The field
 * rides along unused: nothing reads it, and `/api/board` projects the public
 * tape field by field, so it is never published.
 */
function parseBoard(raw: unknown): BoardState | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BoardState>;
    if (!Array.isArray(parsed.spots)) return null;
    return {
      spots: parsed.spots.filter(
        (s) => s && typeof s.trackId === "string" && typeof s.bid === "number",
      ),
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      prevRanks:
        parsed.prevRanks && typeof parsed.prevRanks === "object"
          ? parsed.prevRanks
          : {},
    };
  } catch {
    return null;
  }
}

function parseTransaction(raw: unknown): PaymentTransaction | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as PaymentTransaction;
    return parsed && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/* —— in-memory fallback —— */

type MemStore = {
  board: BoardState;
  version: number;
  transactions: Map<string, PaymentTransaction>;
  events: Set<string>;
  settled: Set<string>;
  plays: Map<string, number>;
};

// Survives dev hot-reloads, so a file save does not reset the tape.
const globalMem = globalThis as typeof globalThis & { __pbTape?: MemStore };

function mem(): MemStore {
  return (globalMem.__pbTape ??= {
    board: seedBoard(),
    version: 0,
    transactions: new Map(),
    events: new Set(),
    settled: new Set(),
    plays: new Map(),
  });
}

/**
 * The memory commit runs start to finish with no `await` inside it, so on a
 * single-threaded runtime it is as indivisible as the Lua script below.
 */
function commitMem(input: Commit): CommitOutcome {
  const store = mem();
  if (store.version !== input.expectedVersion) return "conflict";
  if (input.onlyIfUnsettled && store.settled.has(input.onlyIfUnsettled)) {
    return "stale";
  }
  if (input.eventId) {
    if (store.events.has(input.eventId)) return "duplicate";
    store.events.add(input.eventId);
  }
  if (input.settles) store.settled.add(input.settles);
  if (input.board) {
    store.board = input.board;
    store.version += 1;
  }
  if (input.transaction) {
    store.transactions.set(input.transaction.id, input.transaction);
  }
  return "ok";
}

/* —— durable path —— */

/**
 * Commit-if-unchanged, claim-this-event, and settle-once — one indivisible step.
 *
 * All the decision-making lives in TypeScript; this exists only because a
 * pipeline cannot express "and only if nothing has changed since I read". Redis
 * runs a script to completion before anything else, so the version check, the
 * settlement check, the event claim, the tape write and the transaction write
 * cannot be split apart by a second webhook arriving mid-flight.
 *
 * KEYS: 1 board, 2 version, 3 event, 4 transaction, 5 settled marker
 * ARGV: 1 expected version, 2 board json, 3 transaction json,
 *       4 transaction ttl, 5 claim event flag, 6 event ttl,
 *       7 settlement mode: 1 = claim, 2 = require unclaimed, 0 = ignore
 */
const COMMIT_SCRIPT = `
local ver = redis.call('GET', KEYS[2]) or '0'
if ver ~= ARGV[1] then return 'conflict' end
if ARGV[7] == '2' and redis.call('EXISTS', KEYS[5]) == 1 then return 'stale' end
if ARGV[5] == '1' then
  if redis.call('SET', KEYS[3], '1', 'NX', 'EX', ARGV[6]) == false then
    return 'duplicate'
  end
end
if ARGV[7] == '1' then
  redis.call('SET', KEYS[5], '1', 'EX', ARGV[4])
end
if ARGV[2] ~= '' then
  redis.call('SET', KEYS[1], ARGV[2])
  redis.call('SET', KEYS[2], tostring(tonumber(ver) + 1))
end
if ARGV[3] ~= '' then
  redis.call('SET', KEYS[4], ARGV[3], 'EX', ARGV[4])
end
return 'ok'
`;

async function commitRedis(input: Commit): Promise<CommitOutcome> {
  const settlement = input.settles ?? input.onlyIfUnsettled;
  const outcome = await evalScript(
    COMMIT_SCRIPT,
    [
      K_BOARD,
      K_VERSION,
      input.eventId ? eventKey(input.eventId) : K_NONE,
      input.transaction ? txKey(input.transaction.id) : K_NONE,
      settlement ? settledKey(settlement) : K_NONE,
    ],
    [
      String(input.expectedVersion),
      input.board ? JSON.stringify(input.board) : "",
      input.transaction ? JSON.stringify(input.transaction) : "",
      String(TX_TTL),
      input.eventId ? "1" : "0",
      String(EVENT_TTL),
      input.settles ? "1" : input.onlyIfUnsettled ? "2" : "0",
    ],
  );
  return outcome === "conflict" || outcome === "duplicate" || outcome === "stale"
    ? outcome
    : "ok";
}

/* —— public API —— */

/** The tape plus the version it was read at, for a later version-checked write. */
export async function readBoardVersioned(): Promise<Versioned> {
  if (!boardIsDurable()) {
    const store = mem();
    return { board: store.board, version: store.version };
  }
  const [rawBoard, rawVersion] = await pipeline([
    ["GET", K_BOARD],
    ["GET", K_VERSION],
  ]);
  const board = parseBoard(rawBoard);
  // First read on a fresh database: hand back the seed at version 0 so the
  // first write is what actually creates the document.
  return { board: board ?? seedBoard(), version: toInt(rawVersion) };
}

export async function readBoard(): Promise<BoardState> {
  return (await readBoardVersioned()).board;
}

export async function commit(input: Commit): Promise<CommitOutcome> {
  return boardIsDurable() ? commitRedis(input) : commitMem(input);
}

/**
 * Read, decide, commit — retried when someone else committed first.
 *
 * `decide` must be pure: it can run more than once. Returning null abandons the
 * attempt. `duplicate` and `stale` are never retried, since an event already
 * claimed and a payment already settled are settled answers, not collisions.
 */
export async function withBoard<T>(
  decide: (board: BoardState) => { commit: Omit<Commit, "expectedVersion">; result: T } | null,
  attempts = 5,
): Promise<{ outcome: CommitOutcome | "aborted"; result: T | null }> {
  let outcome: CommitOutcome = "conflict";
  for (let i = 0; i < attempts; i += 1) {
    const { board, version } = await readBoardVersioned();
    const decision = decide(board);
    if (!decision) return { outcome: "aborted", result: null };

    outcome = await commit({ ...decision.commit, expectedVersion: version });
    if (outcome === "ok") return { outcome, result: decision.result };
    if (outcome === "duplicate" || outcome === "stale") {
      return { outcome, result: null };
    }
  }
  return { outcome, result: null };
}

export async function getTransaction(id: string) {
  if (!boardIsDurable()) return mem().transactions.get(id) ?? null;
  const [raw] = await pipeline([["GET", txKey(id)]]);
  return parseTransaction(raw);
}

/** Writes a transaction on its own, without touching the tape. */
export async function putTransaction(tx: PaymentTransaction) {
  if (!boardIsDurable()) {
    mem().transactions.set(tx.id, tx);
    return;
  }
  await pipeline([["SET", txKey(tx.id), JSON.stringify(tx), "EX", TX_TTL]]);
}

/**
 * True the first time a visitor plays a given song within the dedupe window, so
 * holding down the play button cannot inflate a count.
 */
export async function claimPlay(visitorId: string, trackId: string) {
  const key = playKey(visitorId, trackId);
  if (!boardIsDurable()) {
    const plays = mem().plays;
    const now = Date.now();
    const last = plays.get(key);
    if (last && now - last < PLAY_DEDUPE_TTL * 1000) return false;
    plays.set(key, now);
    if (plays.size > 10_000) plays.clear();
    return true;
  }
  const [set] = await pipeline([["SET", key, "1", "NX", "EX", PLAY_DEDUPE_TTL]]);
  return set !== null;
}
