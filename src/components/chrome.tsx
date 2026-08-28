"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { useBoard } from "@/lib/board-context";

export function SiteHeader() {
  const { spots, online } = useBoard();
  const totalClicks = spots.reduce((sum, s) => sum + s.clicks, 0);

  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#121212]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-6">
          <Logo />
          <nav className="flex flex-wrap items-center gap-3 text-sm text-[#b3b3b3] sm:gap-4">
            <Link href="/#board" className="hover:text-white">
              Leaderboard
            </Link>
            <Link href="/#categories" className="hover:text-white">
              Categories
            </Link>
            <Link href="/#about" className="hover:text-white">
              About
            </Link>
            <Link href="/rules" className="hover:text-white">
              Rules
            </Link>
          </nav>
        </div>
        <p className="text-xs text-[#a7a7a7] sm:text-sm">
          <span className="text-white">{online}</span> online
          <span className="mx-1.5 text-white/20">·</span>
          <span className="text-white">{totalClicks.toLocaleString()}</span> clicks
          <span className="mx-1.5 text-white/20">·</span>
          <span className="text-(--accent)">live board</span>
        </p>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/8">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex flex-wrap gap-5 text-sm text-[#a7a7a7]">
            <Link href="/#board" className="hover:text-white">
              Leaderboard
            </Link>
            <Link href="/rules" className="hover:text-white">
              Rules
            </Link>
            <a
              href="https://paypal.me/YeluruNitish"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              Support
            </a>
            <a href="mailto:hello@playlistbid.local" className="hover:text-white">
              Contact
            </a>
          </div>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-[#a7a7a7]">
          PlaylistBid is an independent fan billboard. It is not affiliated with,
          endorsed by, or connected to Spotify AB. Song names, artwork, and
          playback come from Spotify’s public oEmbed and official player. Ranking
          here does not change Spotify playlists, charts, or streams.
        </p>
      </div>
    </footer>
  );
}
