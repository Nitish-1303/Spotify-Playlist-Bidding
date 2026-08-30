import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

/**
 * The tape itself: three rows with the top slot lit, the same shape the rows
 * below are printed in. Drawn, not typed, so it matches the favicon and the
 * share card exactly and needs no font.
 *
 * Our own mark, in our own green. No Spotify logo or wordmark is used anywhere
 * on this site, and this one is deliberately nothing like it.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2.5"
      aria-label={`${SITE_NAME} home`}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center"
      >
        <svg viewBox="0 0 32 32" className="h-[1.625rem] w-[1.625rem]" fill="none">
          <rect x="2" y="6" width="28" height="5.5" rx="2.75" fill="var(--hammer)" />
          <rect x="2" y="14" width="21" height="5.5" rx="2.75" fill="#52525b" />
          <rect x="2" y="22" width="14" height="5.5" rx="2.75" fill="#52525b" />
        </svg>
      </span>
      {!compact && (
        <span className="marquee text-[1.125rem] leading-none">
          Playlist<span className="hammer">Bid</span>
        </span>
      )}
    </Link>
  );
}
