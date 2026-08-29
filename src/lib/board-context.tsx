"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { startOfDay } from "./format";
import { SEED_ACTIVITY, SEED_SPOTS } from "./seed";
import type { Activity, BoardState, Spot, TimeFilter } from "./types";

const STORAGE_KEY = "playlistbid-board-v3";

function sortSpots(spots: Spot[]) {
  return [...spots].sort((a, b) => b.bid - a.bid || b.raisedAt - a.raisedAt);
}

function rankMap(spots: Spot[]): Record<string, number> {
  const ranks: Record<string, number> = {};
  sortSpots(spots).forEach((spot, i) => {
    ranks[spot.id] = i + 1;
  });
  return ranks;
}

function seedState(): BoardState {
  return {
    spots: SEED_SPOTS,
    activity: SEED_ACTIVITY,
    prevRanks: rankMap(SEED_SPOTS),
  };
}

function loadState(): BoardState {
  if (typeof window === "undefined") return seedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<BoardState>;
    if (!Array.isArray(parsed.spots) || parsed.spots.length === 0) {
      return seedState();
    }
    return {
      spots: parsed.spots,
      activity: parsed.activity ?? [],
      prevRanks: parsed.prevRanks ?? rankMap(parsed.spots),
    };
  } catch {
    return seedState();
  }
}

type BoardContextValue = {
  spots: Spot[];
  activity: Activity[];
  prevRanks: Record<string, number>;
  placeBid: (input: Omit<Spot, "id" | "clicks" | "raisedAt">) => Spot;
  registerClick: (id: string) => void;
  listForSale: (trackId: string, askingPrice: number) => void;
};

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BoardState>(seedState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const placeBid = useCallback(
    (input: Omit<Spot, "id" | "clicks" | "raisedAt">) => {
      let nextSpot: Spot | undefined;
      setState((prev) => {
        const existing = prev.spots.find((s) => s.trackId === input.trackId);
        const now = Date.now();
        nextSpot = existing
          ? {
              ...existing,
              ...input,
              bid: Math.max(existing.bid, input.bid),
              raisedAt: now,
            }
          : {
              ...input,
              id: crypto.randomUUID(),
              clicks: 0,
              raisedAt: now,
            };

        // Snapshot where everything stood *before* this bid so the board can
        // show a genuine rank move afterwards.
        const prevRanks = rankMap(prev.spots);
        const spots = sortSpots([
          nextSpot,
          ...prev.spots.filter((s) => s.trackId !== input.trackId),
        ]);
        const activity: Activity[] = [
          {
            id: crypto.randomUUID(),
            trackId: nextSpot.trackId,
            title: nextSpot.title,
            artist: nextSpot.artist,
            bid: nextSpot.bid,
            at: now,
          },
          ...prev.activity,
        ].slice(0, 60);
        return { spots, activity, prevRanks };
      });
      return nextSpot!;
    },
    [],
  );

  const registerClick = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      spots: prev.spots.map((s) =>
        s.id === id ? { ...s, clicks: s.clicks + 1 } : s,
      ),
    }));
  }, []);

  const listForSale = useCallback((trackId: string, askingPrice: number) => {
    setState((prev) => ({
      ...prev,
      spots: prev.spots.map((s) =>
        s.trackId === trackId ? { ...s, askingPrice } : s,
      ),
    }));
  }, []);

  const value = useMemo(
    () => ({
      spots: sortSpots(state.spots),
      activity: state.activity,
      prevRanks: state.prevRanks,
      placeBid,
      registerClick,
      listForSale,
    }),
    [state, placeBid, registerClick, listForSale],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside BoardProvider");
  return ctx;
}

export function filterSpots(
  spots: Spot[],
  genre: string,
  time: TimeFilter,
  forSaleOnly = false,
) {
  const startToday = startOfDay();
  const startWeek = Date.now() - 7 * 86400000;

  return spots.filter((s) => {
    if (genre !== "All" && s.genre !== genre) return false;
    if (forSaleOnly && !s.askingPrice) return false;
    if (time === "today" && s.raisedAt < startToday) return false;
    if (time === "week" && s.raisedAt < startWeek) return false;
    return true;
  });
}

/** Positive = the track climbed since the last confirmed bid on the board. */
export function rankDelta(
  prevRanks: Record<string, number>,
  id: string,
  currentRank: number,
) {
  const before = prevRanks[id];
  if (typeof before !== "number") return null;
  return before - currentRank;
}
