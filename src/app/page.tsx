import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { HomeBoard } from "@/components/home-board";
import { IndependenceCard } from "@/components/independence";
import { HomeJsonLd } from "@/components/json-ld";

const CONDITIONS = [
  {
    title: "You buy a track position, not a number",
    body: "Pick the track you want — track 1, track 3, anywhere down the tape — and pay a dollar more than whoever holds it. The song takes that slot.",
  },
  {
    title: "Everyone below shifts one later",
    body: "Taking track 3 pushes the old track 3 to track 4, and so on down. Nobody drops two slots at once.",
  },
  {
    title: "The price decides the position",
    body: "The tape is ordered by price, highest first. Picking a slot opens a card checkout, and the song is written on once that payment is confirmed.",
  },
  {
    title: "The same link moves up, never repeats",
    body: "Send a song already on the tape and it moves that song to the slot you picked, instead of writing it on twice.",
  },
  {
    title: "Plays are counted here only",
    body: "Tapping a cover plays it in the deck and records a play on this tape. It does not reach Spotify charts, playlists or stream counts.",
  },
  {
    title: "Public song links only",
    body: "One open.spotify.com/track link per slot. Titles, artists, artwork and playback come from Spotify’s public metadata APIs and official embedded player.",
  },
] as const;

export default function Page() {
  return (
    <>
      <HomeJsonLd />
      <SiteHeader />

      <section className="rack pt-10 pb-8">
        <p className="slip">
          one tape · made by everyone · track 1 opens at $1
        </p>
        <h1 className="marquee headline mt-3 max-w-3xl">
          Pick the track.
          <br />
          Pay for the slot.
        </h1>
        <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed">
          It&apos;s one long mixtape and every slot on it has a price. Paste a
          public Spotify track link, choose the exact position you want — track
          1, track 4, anywhere down the tape — and pay what that slot costs. The
          song lands there and everything below shifts one track later. A
          position here is a slot on this site; it does not change Spotify
          playlists, charts, rankings or streams.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <a href="#bid" className="btn btn-hammer btn-lg">
            Pick a slot
          </a>
          <a href="#rack" className="btn btn-lg">
            Play the tape
          </a>
          <Link href="/stats" className="btn btn-press btn-lg">
            Liner notes
          </Link>
        </div>

        {/*
          Directly below the introduction, before the tape itself: a visitor
          cannot reach the songs without passing this.
        */}
        <div className="mt-7 max-w-2xl">
          <IndependenceCard />
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
            <p className="slip">how the tape works</p>
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
        <p className="slip">liner notes</p>
        <h2 id="about-heading" className="marquee mt-1.5 text-2xl">
          A mixtape anyone can write on
        </h2>
        <div className="mt-4 grid max-w-4xl gap-5 text-sm leading-relaxed sm:grid-cols-2">
          <p>
            Most music discovery runs on a feed nobody can see inside. This tape
            runs on a public number instead: every slot has a price written next
            to it, and anyone can read that price, the play count, and the minute
            the track last moved.
          </p>
          <p>
            The tape is kept on the server, so the running order you see is the
            running order everyone sees. The play and visitor counts printed
            here are measured server-side from a random id your browser keeps —
            no IP addresses, cookies or user agents. Traffic to the site is
            counted separately by a cookieless third-party analytics script.
            PlaylistBid is an independent fan project and is not affiliated
            with, endorsed by, sponsored by, or connected to Spotify AB.
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
