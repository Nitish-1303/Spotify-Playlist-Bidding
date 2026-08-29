import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export const metadata: Metadata = {
  title: "How the tape works",
  description:
    "How PlaylistBid works: pick a track position, pay a dollar more than whoever holds it, and the song lands on that slot. Track links only, official Spotify player, positions on this site only — not on Spotify.",
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
    head: "The song is written on as you pay",
    body: "Picking a slot writes the song onto the tape at that price and then opens PayPal, or UPI in India. There is no confirmation step to come back to — position always follows the price.",
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
    body: "Names, artists and cover art are read from Spotify’s public oEmbed endpoint; playback runs in the official embedded player. Nothing is uploaded or rehosted.",
  },
  {
    head: "Your tape lives in your browser",
    body: "Slots and payment history are stored in this browser’s local storage. Visitor counts in the liner notes are the part measured server-side for everyone.",
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
          Playback runs through Spotify’s official player. We do not add songs to
          Spotify playlists and we do not touch streams.
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
