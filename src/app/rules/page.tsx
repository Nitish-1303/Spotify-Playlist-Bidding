import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export const metadata: Metadata = {
  title: "Rules for song bidding",
  description:
    "How PlaylistBid song bidding works: track links only, $1 minimum bids, official Spotify player previews, and ranks on this site only — not on Spotify.",
  alternates: { canonical: "/rules" },
};

export default function RulesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <p className="text-sm text-[#a7a7a7]">
          <Link href="/" className="hover:text-white">
            ← Board
          </Link>
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Rules</h1>
        <p className="mt-4 text-[#b3b3b3] leading-relaxed">
          PlaylistBid is a ranking on{" "}
          <b className="font-semibold text-white">this website</b>. Highest bid
          is #1. Playback uses Spotify’s official player. We do not add songs to
          Spotify playlists or boost streams.
        </p>
        <ol className="mt-8 space-y-3">
          {[
            <>
              Paste a public <b className="font-semibold text-white">song</b> link
              only (not a playlist or album).
            </>,
            <>Bids start at $1. A lower bid still lands at the rank that amount earns.</>,
            <>The same song link raises an existing bid instead of adding a duplicate.</>,
            <>Titles open on Spotify. That click is counted on this board only.</>,
            <>Cover art and preview play come from Spotify. Do not upload files.</>,
          ].map((item, i) => (
            <li key={i} className="flex gap-3 rounded-xl bg-[#181818] p-4 text-[#b3b3b3]">
              <span className="rank-badge rank-badge-top shrink-0">{i + 1}</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-[#a7a7a7]">
          PlaylistBid is not affiliated with Spotify. Spotify is a trademark of
          Spotify AB.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
