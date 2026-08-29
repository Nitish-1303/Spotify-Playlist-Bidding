import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { HomeBoard } from "@/components/home-board";
import { HomeJsonLd } from "@/components/json-ld";

const CONDITIONS = [
  {
    title: "The highest bid holds the lot",
    body: "Every song opens at $1. A bigger number sits above a smaller one, and matching bids keep the earlier timestamp.",
  },
  {
    title: "You confirm your own fill",
    body: "Pay with PayPal or, in India, UPI. Come back and press “I paid”. Nothing prints on the rack until you confirm it.",
  },
  {
    title: "The same link raises, never repeats",
    body: "Send a song that is already on the rack and it raises that lot instead of opening a second one.",
  },
  {
    title: "Plays are counted here only",
    body: "Opening a title records a play on this board. It does not reach Spotify charts, playlists or stream counts.",
  },
  {
    title: "Public song links only",
    body: "One open.spotify.com/track link per lot. Albums and playlists are turned away at the door.",
  },
  {
    title: "Titles and artwork come from Spotify",
    body: "Names, covers and playback use Spotify’s public oEmbed endpoint and official embedded player. Nothing is uploaded.",
  },
] as const;

export default function Page() {
  return (
    <>
      <HomeJsonLd />
      <SiteHeader />

      <section className="rack pt-10 pb-8">
        <p className="slip">independent song auction · bidding open · min $1</p>
        <h1 className="marquee headline mt-3 max-w-3xl">
          Pay for the top
          <br />
          of the board.
        </h1>
        <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed">
          Every song here has a price on it. Paste a public Spotify link, name
          what the number one slot is worth to you, and your bid prints on the
          rack for everyone to read. A lot number is a position on this site — it
          does not change Spotify playlists, charts or streams.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <a href="#bid" className="btn btn-hammer btn-lg">
            Raise your hand
          </a>
          <a href="#rack" className="btn btn-lg">
            See the rack
          </a>
          <Link href="/stats" className="btn btn-press btn-lg">
            House ledger
          </Link>
          <div className="stamp ml-1">
            <b>not affiliated with spotify</b>
            Independent fan project · no connection to Spotify AB
          </div>
        </div>
      </section>

      <HomeBoard />

      <section
        id="conditions"
        className="rack band dashed-t"
        aria-labelledby="conditions-heading"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="slip">conditions of sale</p>
            <h2 id="conditions-heading" className="marquee mt-1.5 text-2xl">
              Six rules, no fine print
            </h2>
          </div>
          <Link href="/rules" className="slip tie">
            read them in full
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONDITIONS.map((item) => (
            <li key={item.title} className="card card-bd">
              <h3 className="text-[0.9375rem] font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed chrome">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rack band dashed-t" aria-labelledby="about-heading">
        <p className="slip">about the house</p>
        <h2 id="about-heading" className="marquee mt-1.5 text-2xl">
          An open market for attention
        </h2>
        <div className="mt-4 grid max-w-4xl gap-5 text-sm leading-relaxed sm:grid-cols-2">
          <p>
            Most music discovery runs on a feed nobody can see inside. This board
            runs on a public number instead: whoever pays most for a lot holds it,
            and anyone can read the price, the play count and the minute it last
            moved.
          </p>
          <p>
            Your lots are saved in your own browser. Visitor counts are measured
            server-side from a random id your browser keeps — no IP addresses,
            cookies or user agents. PlaylistBid is not affiliated with, endorsed
            by, or connected to Spotify AB.
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
