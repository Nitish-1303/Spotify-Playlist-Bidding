"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { useBoard } from "@/lib/board-context";
import { formatMoney } from "@/lib/format";

export function SiteHeader() {
  const { spots } = useBoard();
  const totalValue = spots.reduce((sum, s) => sum + s.bid, 0);

  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-[#121212]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-4 text-sm text-[#b3b3b3]">
          <Link href="/#board" className="hover:text-white">
            Board
          </Link>
          <Link href="/rules" className="hover:text-white">
            Rules
          </Link>
          <span className="hidden text-[#a7a7a7] sm:inline">
            {spots.length} songs · {formatMoney(totalValue)}
          </span>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/8">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex gap-5 text-sm text-[#a7a7a7]">
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
