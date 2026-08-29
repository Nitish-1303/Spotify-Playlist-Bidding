"use client";

import { useEffect, useState } from "react";

type CoverArtProps = {
  trackId: string;
  src: string;
  alt?: string;
  className?: string;
  /** Render as a button so the artwork itself is a control. */
  as?: "img" | "button";
  onClick?: () => void;
  title?: string;
};

/**
 * Spotify's CDN occasionally 404s a cached thumbnail. One silent re-fetch
 * through /api/track recovers it; after that we show the record glyph.
 */
export function CoverArt({
  trackId,
  src,
  alt = "",
  className,
  as = "img",
  onClick,
  title,
}: CoverArtProps) {
  const [url, setUrl] = useState(src);
  const [failed, setFailed] = useState(!src);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    setUrl(src);
    setFailed(!src);
    setRetried(false);
  }, [src, trackId]);

  async function recover() {
    if (retried || !trackId) {
      setFailed(true);
      return;
    }
    setRetried(true);
    try {
      const res = await fetch(`/api/track?id=${encodeURIComponent(trackId)}`);
      const data = (await res.json()) as { thumbnailUrl?: string };
      if (res.ok && data.thumbnailUrl) {
        setUrl(data.thumbnailUrl);
        setFailed(false);
        return;
      }
    } catch {
      // fall through to the glyph
    }
    setFailed(true);
  }

  const inner =
    failed || !url ? (
      <span
        className="grid h-full w-full place-items-center press"
        style={{ background: "var(--press-wash)" }}
        aria-hidden
      >
        ◎
      </span>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={as === "button" ? "" : alt}
        className="h-full w-full object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          void recover();
        }}
      />
    );

  if (as === "button") {
    return (
      <button type="button" className={className} onClick={onClick} title={title}>
        {inner}
      </button>
    );
  }

  return (
    <span className={className} role="img" aria-label={alt || undefined}>
      {inner}
    </span>
  );
}
