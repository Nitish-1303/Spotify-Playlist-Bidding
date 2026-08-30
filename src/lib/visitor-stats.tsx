"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  HEARTBEAT_MS,
  type HitType,
  type StatsSnapshot,
} from "@/lib/stats-types";

const VISITOR_KEY = "playlistbid-visitor-id";

/**
 * A random id this browser keeps for itself. No IP address, no fingerprint —
 * it is how a view is counted once and how a play is counted once. Also used by
 * the play counter on the tape.
 */
export function readVisitorId() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    // Private mode with storage disabled: stay anonymous, stop counting.
    return "";
  }
}

type VisitorStatsValue = {
  stats: StatsSnapshot | null;
  /** True until the first successful response. */
  loading: boolean;
  refresh: () => void;
};

const VisitorStatsContext = createContext<VisitorStatsValue>({
  stats: null,
  loading: true,
  refresh: () => {},
});

export function VisitorStatsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const visitorId = useRef("");
  const referrerSent = useRef(false);
  const alive = useRef(true);

  const send = useCallback(
    async (type: HitType, path: string) => {
      if (!visitorId.current) return;
      const referrer =
        !referrerSent.current && typeof document !== "undefined"
          ? document.referrer
          : "";
      referrerSent.current = true;
      try {
        const res = await fetch("/api/stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId: visitorId.current,
            path,
            referrer,
            type,
          }),
          cache: "no-store",
        });
        if (!res.ok) return;
        const snapshot = (await res.json()) as StatsSnapshot;
        if (alive.current) {
          setStats(snapshot);
          setLoading(false);
        }
      } catch {
        // Offline or blocked: leave the last known snapshot in place.
      }
    },
    [],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // One view per navigation, then a heartbeat so "live now" stays honest.
  useEffect(() => {
    if (!visitorId.current) visitorId.current = readVisitorId();
    if (!visitorId.current) {
      setLoading(false);
      return;
    }

    void send("view", pathname);

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void send("ping", pathname);
    }, HEARTBEAT_MS);

    function onVisible() {
      if (document.visibilityState === "visible") void send("ping", pathname);
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, send]);

  const refresh = useCallback(() => {
    void send("ping", pathname);
  }, [pathname, send]);

  const value = useMemo(
    () => ({ stats, loading, refresh }),
    [stats, loading, refresh],
  );

  return (
    <VisitorStatsContext.Provider value={value}>
      {children}
    </VisitorStatsContext.Provider>
  );
}

export function useVisitorStats() {
  return useContext(VisitorStatsContext);
}
