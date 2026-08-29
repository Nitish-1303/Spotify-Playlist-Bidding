"use client";

import { useNowPlaying } from "@/lib/now-playing";
import { spotifyEmbedUrl } from "@/lib/spotify";

/**
 * The deck: tap any cover and the song docks here and keeps playing while you
 * scroll the tape. Playback is Spotify's official embed, not our own player.
 */
export function MiniPlayer() {
  const { track, stop } = useNowPlaying();
  if (!track) return null;

  return (
    <>
      <div className="deck-space" aria-hidden />
      <div className="deck" role="region" aria-label="Now playing">
        <div className="deck-in">
          <span className="deck-reels" aria-hidden>
            <span className="reel reel-spin" />
            <span className="reel reel-spin" />
          </span>

          <div className="deck-meta">
            <p className="deck-now">now playing</p>
            <p className="deck-title">{track.title}</p>
            <p className="deck-artist">{track.artist}</p>
          </div>

          <iframe
            key={track.trackId}
            src={spotifyEmbedUrl(track.trackId)}
            title={`Spotify player for ${track.title}`}
            className="deck-frame"
            height="80"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />

          <button
            type="button"
            className="deck-eject"
            onClick={stop}
            aria-label="Eject — stop playing and close the deck"
            title="Eject"
          >
            ⏏
          </button>
        </div>
      </div>
    </>
  );
}
