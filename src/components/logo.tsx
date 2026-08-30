import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

/**
 * The side-and-track pair you'd write in the corner of a cassette label. A1 is
 * the slot everyone wants: side A, track 1, the song the tape opens with.
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
        className="grid h-8 w-8 place-items-center rounded-full text-[0.8125rem] font-extrabold tracking-tight"
        style={{ background: "var(--hammer)", color: "var(--on-hammer)" }}
      >
        A1
      </span>
      {!compact && (
        <span className="marquee text-[1.125rem] leading-none">
          Playlist<span className="hammer">Bid</span>
        </span>
      )}
    </Link>
  );
}
