"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { startOfDay } from "./format";
import { chartOrder } from "./ranks";
import type { Activity, BoardState, Spot, TimeFilter } from "./types";
import { readVisitorId } from "./visitor-stats";

/**
 * The tape as the browser sees it: read-only.
 *
 * It used to live in localStorage, which meant the page that took the money was
 * also the page that decided the running order — and a visitor could edit it.
 * Now it is served from /api/board and the only thing that changes it is a
 * verified payment webhook. Nothing in here can write a slot.
 */

const EMPTY: BoardState = { spots: [], activity: [], prevRanks: {} };

type BoardContextValue = {
  spots: Spot[];
  activity: Activity[];
  prevRanks: Record<string, number>;
  /** False until the first response from the server has landed. */
  hydrated: boolean;
  /** False when the server has no durable store, so slots cannot be sold. */
  durable: boolean;
  /** Re-reads the tape. Called after a payment is confirmed. */
  refresh: () => Promise<void>;
  /** Counts a play. Cannot change prices or positions. */
  registerPlay: (trackId: string) => void;
};

const BoardContext = createContext<BoardContextValue | null>(null);

type BoardResponse = BoardState & { durable?: boolean };

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BoardState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [durable, setDurable] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/board", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as BoardResponse;
      if (!Array.isArray(data.spots)) return;
      setState({
        spots: data.spots,
        activity: Array.isArray(data.activity) ? data.activity : [],
        prevRanks: data.prevRanks ?? {},
      });
      setDurable(data.durable !== false);
    } catch {
      // Offline or a blip: keep showing the tape we already have.
    } finally {
      inFlight.current = false;
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-read when the tab comes back, so a buyer returning from checkout sees
  // the tape as it now stands rather than as it was when they left.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const registerPlay = useCallback(
    (trackId: string) => {
      // Shown straight away, then confirmed by the server's own count on the
      // next read. A play is a play count — it buys nothing.
      setState((prev) => ({
        ...prev,
        spots: prev.spots.map((s) =>
          s.trackId === trackId ? { ...s, clicks: s.clicks + 1 } : s,
        ),
      }));
      void fetch("/api/board/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, visitorId: readVisitorId() }),
      }).catch(() => {});
    },
    [],
  );

  const value = useMemo(
    () => ({
      spots: chartOrder(state.spots),
      activity: state.activity,
      prevRanks: state.prevRanks,
      hydrated,
      durable,
      refresh,
      registerPlay,
    }),
    [state, hydrated, durable, refresh, registerPlay],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside BoardProvider");
  return ctx;
}

/** Narrows the rack to what was written on inside a window of time. */
export function filterSpots(spots: Spot[], time: TimeFilter) {
  const startToday = startOfDay();
  const startWeek = Date.now() - 7 * 86400000;

  return spots.filter((s) => {
    if (time === "today" && s.raisedAt < startToday) return false;
    if (time === "week" && s.raisedAt < startWeek) return false;
    return true;
  });
}

/** Positive = the track climbed since the last finalised payment. */
export function rankDelta(
  prevRanks: Record<string, number>,
  id: string,
  currentRank: number,
) {
  const before = prevRanks[id];
  if (typeof before !== "number") return null;
  return before - currentRank;
}
