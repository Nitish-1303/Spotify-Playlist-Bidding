"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type PlayingTrack = {
  trackId: string;
  title: string;
  artist: string;
};

type NowPlayingValue = {
  track: PlayingTrack | null;
  play: (track: PlayingTrack) => void;
  stop: () => void;
};

const NowPlayingContext = createContext<NowPlayingValue | null>(null);

/**
 * Holds whatever is docked in the deck at the bottom of the screen. Only the
 * track id lives here — playback itself stays inside Spotify's own embed.
 */
export function NowPlayingProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<PlayingTrack | null>(null);

  const play = useCallback((next: PlayingTrack) => setTrack(next), []);
  const stop = useCallback(() => setTrack(null), []);

  const value = useMemo(() => ({ track, play, stop }), [track, play, stop]);

  return (
    <NowPlayingContext.Provider value={value}>
      {children}
    </NowPlayingContext.Provider>
  );
}

export function useNowPlaying() {
  const ctx = useContext(NowPlayingContext);
  if (!ctx) throw new Error("useNowPlaying must be used inside NowPlayingProvider");
  return ctx;
}
