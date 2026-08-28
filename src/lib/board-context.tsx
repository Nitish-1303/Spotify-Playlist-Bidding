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

const STORAGE_KEY = "playlistbid-board-v2";

function sortSpots(spots: Spot[]) {
  return [...spots].sort((a, b) => b.bid - a.bid || b.raisedAt - a.raisedAt);
}

function loadState(): BoardState {
  if (typeof window === "undefined") {
    return { spots: SEED_SPOTS, activity: SEED_ACTIVITY, online: 23 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { spots: SEED_SPOTS, activity: SEED_ACTIVITY, online: 23 };
    }
    const parsed = JSON.parse(raw) as BoardState;
    if (!Array.isArray(parsed.spots) || parsed.spots.length === 0) {
      return { spots: SEED_SPOTS, activity: SEED_ACTIVITY, online: 23 };
    }
    return {
      spots: parsed.spots,
      activity: parsed.activity ?? [],
      online: parsed.online ?? 23,
    };
  } catch {
    return { spots: SEED_SPOTS, activity: SEED_ACTIVITY, online: 23 };
  }
}

type BoardContextValue = {
  spots: Spot[];
  activity: Activity[];
  online: number;
  placeBid: (input: Omit<Spot, "id" | "clicks" | "raisedAt">) => Spot;
  registerClick: (id: string) => void;
  listForSale: (trackId: string, askingPrice: number) => void;
};

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BoardState>({
    spots: SEED_SPOTS,
    activity: SEED_ACTIVITY,
    online: 23,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => ({
        ...prev,
        online: Math.max(8, prev.online + Math.floor(Math.random() * 5) - 2),
      }));
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const placeBid = useCallback(
    (input: Omit<Spot, "id" | "clicks" | "raisedAt">) => {
      let nextSpot: Spot | undefined;
      setState((prev) => {
        const existing = prev.spots.find((s) => s.trackId === input.trackId);
        const now = Date.now();
        if (existing) {
          nextSpot = {
            ...existing,
            ...input,
            bid: Math.max(existing.bid, input.bid),
            raisedAt: now,
          };
        } else {
          nextSpot = {
            ...input,
            id: crypto.randomUUID(),
            clicks: 0,
            raisedAt: now,
          };
        }
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
        ].slice(0, 40);
        return { ...prev, spots, activity };
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
      online: state.online,
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
