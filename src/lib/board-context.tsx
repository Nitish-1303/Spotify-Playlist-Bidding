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
import { SEED_ACTIVITY, SEED_SPOTS } from "./seed";
import type { Activity, BoardState, Spot, TimeFilter } from "./types";

const STORAGE_KEY = "playlistbid-board-v4";

function sortSpots(spots: Spot[]) {
  return chartOrder(spots);
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
  /**
   * False until the saved tape has been read back out of localStorage. Anything
   * that writes on mount must wait for it, or its write is overwritten by the
   * load that follows.
   */
  hydrated: boolean;
  placeBid: (input: Omit<Spot, "id" | "clicks" | "raisedAt">) => BidResult;
  registerClick: (id: string) => void;
  listForSale: (trackId: string, askingPrice: number) => void;
};

/** What a write returns, so the caller can see where the song actually landed. */
export type BidResult = {
  /** The row as it now sits on the tape. */
  spot: Spot;
  /** The whole tape after the write, already in track order. */
  spots: Spot[];
};

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BoardState>(seedState);
  const [hydrated, setHydrated] = useState(false);

  /**
   * The tape as it stands right now. `setState` does not land until the next
   * render, so anything that needs to read its own write back — the receipt
   * page working out which track it got — reads this instead.
   */
  const stateRef = useRef(state);

  const commit = useCallback((next: BoardState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    commit(loadState());
    setHydrated(true);
  }, [commit]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const placeBid = useCallback(
    (input: Omit<Spot, "id" | "clicks" | "raisedAt">): BidResult => {
      const prev = stateRef.current;
      const existing = prev.spots.find((s) => s.trackId === input.trackId);
      const now = Date.now();
      const spot: Spot = existing
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
        spot,
        ...prev.spots.filter((s) => s.trackId !== input.trackId),
      ]);
      const activity: Activity[] = [
        {
          id: crypto.randomUUID(),
          trackId: spot.trackId,
          title: spot.title,
          artist: spot.artist,
          bid: spot.bid,
          at: now,
        },
        ...prev.activity,
      ].slice(0, 60);

      commit({ spots, activity, prevRanks });
      return { spot, spots };
    },
    [commit],
  );

  const registerClick = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      commit({
        ...prev,
        spots: prev.spots.map((s) =>
          s.id === id ? { ...s, clicks: s.clicks + 1 } : s,
        ),
      });
    },
    [commit],
  );

  const listForSale = useCallback(
    (trackId: string, askingPrice: number) => {
      const prev = stateRef.current;
      commit({
        ...prev,
        spots: prev.spots.map((s) =>
          s.trackId === trackId ? { ...s, askingPrice } : s,
        ),
      });
    },
    [commit],
  );

  const value = useMemo(
    () => ({
      spots: sortSpots(state.spots),
      activity: state.activity,
      prevRanks: state.prevRanks,
      hydrated,
      placeBid,
      registerClick,
      listForSale,
    }),
    [state, hydrated, placeBid, registerClick, listForSale],
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
