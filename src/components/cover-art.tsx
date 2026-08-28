"use client";

import { useEffect, useState } from "react";

type CoverArtProps = {
  trackId: string;
  src: string;
  alt?: string;
  className?: string;
};

export function CoverArt({ trackId, src, alt = "", className }: CoverArtProps) {
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
      // fall through
    }
    setFailed(true);
  }

  if (failed || !url) {
    return (
      <span className={`grid place-items-center bg-white/5 text-[#1ed760] ${className ?? ""}`}>
        ♪
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        void recover();
      }}
    />
  );
}
