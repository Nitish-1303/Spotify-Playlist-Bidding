import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export const metadata: Metadata = {
  title: "Conditions of sale",
  description:
    "How PlaylistBid song bidding works: track links only, $1 minimum bids, official Spotify player previews, and ranks on this site only — not on Spotify.",
  alternates: { canonical: "/rules" },
};

const CONDITIONS = [
  {
    head: "Public song links only",
    body: "One open.spotify.com/track link per lot. Albums and playlists are turned away — the parser reads a track id and nothing else.",
  },
  {
    head: "Bidding opens at $1",
    body: "Any whole dollar amount from $1 up is valid. A small bid still takes whatever lot number that price earns; it does not have to beat the lead.",
  },
  {
    head: "Price sets the lot number",
    body: "The rack is sorted by standing bid, highest first. When two lots carry the same price, the one raised earlier stays above.",
  },
  {
    head: "You confirm your own fill",
    body: "Pay with PayPal or UPI, come back to the rack, and press “I paid — fill my bid”. Until then the bid is a draft in your browser and nothing is printed.",
  },
  {
    head: "The same link raises, never repeats",
    body: "Sending a song that is already on the rack raises that lot instead of opening a second one. The new amount has to be higher to move it.",
  },
  {
    head: "Plays are counted here only",
    body: "Opening a title records a play on this board. It has no effect on Spotify charts, playlists or stream counts.",
  },
  {
    head: "Titles and playback come from Spotify",
    body: "Names, artists and cover art are read from Spotify’s public oEmbed endpoint; previews run in the official embedded player. Nothing is uploaded or rehosted.",
  },
  {
    head: "Your rack lives in your browser",
    body: "Lots and bid history are stored in this browser’s local storage. Visitor counts in the ledger are the part measured server-side for everyone.",
  },
] as const;

export default function RulesPage() {
  return (
    <>
      <SiteHeader />
      <main className="rack pt-8 pb-16">
        <Link href="/" className="slip tie">
          ← back to the rack
        </Link>
        <h1 className="marquee mt-4 text-4xl">Conditions of sale</h1>
        <p className="mt-4 max-w-2xl leading-relaxed">
          PlaylistBid is a ranking on <span className="hammer">this website</span>.
          The highest standing bid holds lot 01. Playback runs through Spotify’s
          official player. We do not add songs to Spotify playlists and we do not
          touch streams.
        </p>

        <ol className="mt-7 grid gap-3 sm:grid-cols-2">
          {CONDITIONS.map((item, i) => (
            <li key={item.head} className="strip">
              <div className="strip-tab">
                <span className="hole" aria-hidden />
                <span className="strip-lot">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="min-w-0 flex-1 p-4">
                <h2 className="text-[0.9375rem] font-semibold">{item.head}</h2>
                <p className="mt-2 text-sm leading-relaxed chrome">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <hr className="hair my-8" />

        <p className="max-w-3xl text-xs leading-relaxed chrome">
          PlaylistBid is not affiliated with, endorsed by, or connected to Spotify
          AB. Spotify is a trademark of Spotify AB. Payments are handled by PayPal
          or your own UPI app — we never see your card or bank details.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
