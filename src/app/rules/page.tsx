import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export default function RulesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-[#1ed760]">
          <Link href="/">← Back to the board</Link>
        </p>
        <h1 className="mt-4 text-4xl font-semibold">Rules</h1>
        <div className="mt-8 space-y-6 text-[#c7ccc9]">
          <p>
            PlaylistBid is a live leaderboard for favorite Spotify songs. Highest
            bid sits at #1. Everyone else ranks by bid amount.
          </p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>Submit a Spotify <b>track</b> URL only. Playlists, albums, and artist pages are not accepted.</li>
            <li>Bids start at $1. When Dodo Payments is configured, you pay that amount at checkout; otherwise the board runs in demo mode in your browser.</li>
            <li>The same song link raises your existing bid instead of creating a duplicate row.</li>
            <li>Clicking a title opens Spotify and counts as a play on the board.</li>
            <li>Optional asking prices mark a rank as for sale. Contact is up to you.</li>
            <li>No copyrighted artwork uploads — we pull cover art from Spotify.</li>
          </ol>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
