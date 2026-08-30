"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { formatInt } from "@/lib/format";
import { PAYMENT_PROVIDER, SITE_NAME } from "@/lib/site";
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

      {/*
        The compact disclosure, carried on every page. On a phone it holds to a
        single typed line — the full sentence wraps to three and pushes the tape
        below the fold — and the card below the hero states it in full, with the
        same link, a screen's-length away.
      */}
      <div className="disclaim">
        <p className="rack disclaim-in">
          <span className="disclaim-mark">
            independent<span className="hidden sm:inline"> fan project</span>
          </span>
          <span className="disclaim-text">
            <span className="sm:hidden">Not affiliated with Spotify</span>
            <span className="hidden sm:inline">
              Not affiliated with, endorsed by, sponsored by, or connected to
              Spotify AB
            </span>
          </span>
          <Link href="/rules" className="slip tie hidden sm:inline">
            what that means
          </Link>
        </p>
      </div>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t" style={{ borderColor: "var(--edge)" }}>
      <div className="rack space-y-6 py-9">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <Logo />
          <div className="flex flex-wrap items-center gap-6">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="nav">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="stamp">
          <b>not affiliated with spotify</b>
          Independent fan project · no connection to Spotify AB
        </div>
        {/* The full legal disclosure. Kept verbatim, and kept last. */}
        <div className="max-w-3xl space-y-2 text-xs leading-relaxed">
          <p>
            {SITE_NAME} is an independent fan project. It is not affiliated
            with, endorsed by, sponsored by, or connected to Spotify AB. Spotify
            is a trademark of Spotify AB.
          </p>
          <p>
            Track positions exist only on {SITE_NAME} and do not change Spotify
            playlists, charts, rankings, or streams.
          </p>
          <p className="chrome">
            Song titles, artists, artwork and playback come from Spotify&apos;s
            public metadata APIs and its official embedded player. Card payments
            are handled by {PAYMENT_PROVIDER} on their own hosted checkout.
          </p>
        </div>
      </div>
    </footer>
  );
}
