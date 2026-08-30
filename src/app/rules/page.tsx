import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { IndependenceCard } from "@/components/independence";

export const metadata: Metadata = {
  title: "How the tape works",
  description:
    "How PlaylistBid works: pick a track position, pay a dollar more than whoever holds it, and the song lands on that slot. Track links only, playback in Spotify's own embedded player, positions on this site only. An independent fan project, not affiliated with Spotify AB.",
  alternates: { canonical: "/rules" },
};

const CONDITIONS = [
  {
    head: "You buy a track position",
    body: "Pick the slot you want — side A track 1, side B track 3 — and pay what it costs. The song lands on that slot, not on “whatever your money was worth”.",
  },
  {
    head: "A slot costs a dollar more than its holder",
    body: "Whoever holds side A track 2 at $9 sets the price of side A track 2 at $10. The open end of the tape always costs $1.",
  },
  {
    head: "Everything below shifts one track later",
    body: "Taking track 3 moves the old track 3 to track 4, track 4 to track 5, and so on. Nobody drops two slots from one payment.",
  },
  {
    head: "Ties keep the earlier song above",
    body: "The tape is ordered by price, highest first. When two songs carry the same price the one written on earlier stays above — which is what makes a bought slot land exactly where you paid.",
  },
  {
    head: "The song goes on once the payment clears",
    body: "Picking a slot opens a card checkout. The tape only moves when the payment is confirmed back to us — so a checkout you abandon changes nothing, and nothing you click here can write a song on by itself.",
  },
  {
    head: "The same link moves up, never repeats",
    body: "Sending a song that is already on the tape moves that song instead of writing it on twice. Only positions above its current one are offered.",
  },
  {
    head: "Public song links only",
    body: "One open.spotify.com/track link per slot. Albums and playlists are turned away — the parser reads a track id and nothing else.",
  },
  {
    head: "Plays are counted here only",
    body: "Tapping a cover plays it in the deck at the bottom of the screen and records a play on this tape. It has no effect on Spotify charts, playlists or stream counts.",
  },
  {
    head: "Titles and playback come from Spotify",
    body: "Names, artists and cover art are read from Spotify’s public oEmbed endpoint, and playback runs in Spotify’s own embedded player. Nothing is uploaded or rehosted, and none of it makes PlaylistBid a Spotify product.",
  },
  {
    head: "One tape, the same for everyone",
    body: "The tape is kept on the server, not in your browser, so the positions you see are the positions everyone sees. Your receipt is the one private part — it is readable only by the browser that opened the checkout.",
  },
] as const;

export default function RulesPage() {
  return (
    <>
      <SiteHeader />
      <main className="rack pt-8 pb-16">
        <Link href="/" className="slip tie">
          ← back to the tape
        </Link>
        <h1 className="marquee mt-4 text-4xl">How the tape works</h1>
        <p className="mt-4 max-w-2xl leading-relaxed">
          PlaylistBid is one mixtape on{" "}
          <span className="hammer">this website</span>. Every track position has a
          price, and you buy the position rather than a rank you hope for.
          Playback runs through Spotify’s official embedded player. We do not add
          songs to Spotify playlists and we do not touch streams.
        </p>

        <div className="mt-6 max-w-2xl">
          <IndependenceCard />
        </div>

        <ol className="mt-7 grid gap-3 sm:grid-cols-2">
          {CONDITIONS.map((item, i) => (
            <li key={item.head} className="strip">
              <div className="strip-tab">
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
          PlaylistBid is an independent fan project. It is not affiliated with,
          endorsed by, sponsored by, or connected to Spotify AB. Spotify is a
          trademark of Spotify AB. Track positions exist only on PlaylistBid and
          do not change Spotify playlists, charts, rankings, or streams. Payments
          are handled by Dodo Payments on their own hosted checkout — we never
          see your card details.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
