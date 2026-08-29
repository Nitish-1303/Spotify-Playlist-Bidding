import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

/**
 * A jukebox selection button: the letter-number pair you press to play a
 * record. Here it stands for the lot you are bidding on.
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
        B1
      </span>
      {!compact && (
        <span className="marquee text-[1.0625rem] leading-none tracking-[0.01em]">
          Playlist<span className="hammer">Bid</span>
        </span>
      )}
    </Link>
  );
}
