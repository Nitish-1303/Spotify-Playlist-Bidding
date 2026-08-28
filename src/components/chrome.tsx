"use client";

import Link from "next/link";
import { useBoard } from "@/lib/board-context";

export function SiteHeader() {
  const { online, spots } = useBoard();
  const totalValue = spots.reduce((sum, s) => sum + s.bid, 0);
  const totalClicks = spots.reduce((sum, s) => sum + s.clicks, 0);

  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-[#050506]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1ed760] text-[#04140a]">
            ♪
          </span>
          PlaylistBid
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-[#c7ccc9] sm:flex">
          <Link href="/#board" className="hover:text-white">
            Leaderboard
          </Link>
          <Link href="/#categories" className="hover:text-white">
            Genres
          </Link>
          <Link href="/rules" className="hover:text-white">
            Rules
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/6">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-1 px-4 py-2 text-xs text-[#9aa0a6]">
          <span>
            <b className="text-[#1ed760]">{online}</b> listening now
          </span>
          <span>
            <b className="text-white">{spots.length}</b> songs on the board
          </span>
          <span>
            <b className="text-white">${totalValue}</b> total value
          </span>
          <span>
            <b className="text-white">{totalClicks}</b> total plays
          </span>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-[#9aa0a6]">
        <span>PlaylistBid © 2026</span>
        <div className="flex gap-5">
          <Link href="/rules">Rules</Link>
          <a href="mailto:hello@playlistbid.local">Contact</a>
        </div>
      </div>
    </footer>
  );
}
