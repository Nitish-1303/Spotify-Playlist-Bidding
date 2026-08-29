"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { formatInt } from "@/lib/format";
import { PAYPAL_ME_URL, SITE_NAME } from "@/lib/site";
import { useVisitorStats } from "@/lib/visitor-stats";

const NAV = [
  { href: "/", label: "The rack" },
  { href: "/stats", label: "Ledger" },
  { href: "/rules", label: "Conditions" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { stats } = useVisitorStats();
  const live = stats?.liveNow;

  return (
    <header className="masthead">
      <div className="rack flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6 sm:gap-9">
          <Logo />
          <nav className="hidden items-center gap-6 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav ${pathname === item.href ? "nav-on" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <Link href="/stats" className="live shrink-0" title="Visitors in the room now">
          <span className="live-dot" aria-hidden />
          <span className="slip" style={{ color: "var(--hammer)" }}>
            {typeof live === "number" ? formatInt(live) : "—"} in the room
          </span>
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-2" style={{ borderColor: "var(--press)" }}>
      <div className="rack space-y-6 py-9">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <Logo />
          <div className="flex flex-wrap items-center gap-6">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="nav">
                {item.label}
              </Link>
            ))}
            <a
              href={PAYPAL_ME_URL}
              target="_blank"
              rel="noreferrer"
              className="nav"
            >
              Support
            </a>
          </div>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed chrome">
          {SITE_NAME} is an independent fan billboard. It is not affiliated with,
          endorsed by, or connected to Spotify AB. Titles, artwork and playback
          come from Spotify&apos;s public oEmbed endpoint and official embedded
          player. A lot number here is a position on this site — it does not
          change Spotify playlists, charts or streams.
        </p>
      </div>
    </footer>
  );
}
