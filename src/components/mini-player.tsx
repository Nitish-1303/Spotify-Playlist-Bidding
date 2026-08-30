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

          {/*
            The deck is a strip of screen with no room for a sentence, so the
            disclosure is announced rather than printed. It is printed in full
            on the tape above, at the paddle, and in the footer.
          */}
          <p className="sr-only">
            Playback is provided by Spotify&apos;s official embedded player.
            PlaylistBid is an independent fan project and is not affiliated
            with, endorsed by, sponsored by, or connected to Spotify AB.
          </p>

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
