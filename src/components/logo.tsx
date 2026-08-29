import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

/**
 * The side-and-track pair you'd write in the corner of a cassette label. A1 is
 * the slot everyone wants: side A, track 1, the song the tape opens with.
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
        className="marquee grid h-8 w-8 place-items-center rounded-[3px] text-[0.9375rem] text-white"
        style={{ background: "var(--hammer)" }}
      >
        A1
      </span>
      {!compact && (
        <span className="marquee text-[1.0625rem] leading-none tracking-[0.01em]">
          Playlist<span className="hammer">Bid</span>
        </span>
      )}
    </Link>
  );
}
