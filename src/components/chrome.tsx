"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { formatInt } from "@/lib/format";
import { PAYPAL_ME_URL, SITE_NAME } from "@/lib/site";
import { useVisitorStats } from "@/lib/visitor-stats";

const NAV = [
  { href: "/", label: "The tape" },
  { href: "/stats", label: "Liner notes" },
  { href: "/rules", label: "How it works" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { stats } = useVisitorStats();
  const live = stats?.liveNow;

  return (
    <>
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

          <Link
            href="/stats"
            className="live shrink-0"
            title="People listening right now"
          >
            <span className="live-dot" aria-hidden />
            <span className="slip" style={{ color: "var(--hammer)" }}>
              {typeof live === "number" ? formatInt(live) : "—"} listening
            </span>
          </Link>
        </div>
      </header>

      <div className="disclaim">
        <p className="rack disclaim-in">
          <span className="disclaim-mark">not spotify</span>
          <span className="disclaim-text">
            {SITE_NAME} is an independent fan project — not affiliated with,
            endorsed by, or connected to Spotify AB.
          </span>
          <Link href="/rules" className="slip tie">
            what that means
          </Link>
        </p>
      </div>
    </>
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
        <div className="stamp">
          <b>not affiliated with spotify</b>
          Independent fan project · no connection to Spotify AB
        </div>
        <p className="max-w-3xl text-xs leading-relaxed chrome">
          {SITE_NAME} is an independent fan mixtape. It is not affiliated with,
          endorsed by, sponsored by, or connected to Spotify AB, and Spotify is a
          trademark of Spotify AB. Titles, artwork and playback come from
          Spotify&apos;s public oEmbed endpoint and official embedded player. A
          track position here is a slot on this site — it does not change Spotify
          playlists, charts or streams.
        </p>
      </div>
    </footer>
  );
}
