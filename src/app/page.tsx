import { SiteFooter, SiteHeader } from "@/components/chrome";
import { HomeBoard } from "@/components/home-board";
import { HomeJsonLd } from "@/components/json-ld";
import Link from "next/link";

const RULES = [
  {
    title: "Rank follows the bid amount.",
    body: "New songs start at $1. Higher bids rank above lower bids. Equal bids keep the earlier position.",
  },
  {
    title: "PayPal confirmation puts you on the board.",
    body: "After paying on PayPal, return here and tap “I paid — put me on the board” to publish your spot.",
  },
  {
    title: "Same link raises your total.",
    body: "Paste the same Spotify track again to raise its bid. Your new total must be higher than the current amount.",
  },
  {
    title: "Clicks are counted on this site.",
    body: "Opening a title on Spotify counts as a click on PlaylistBid only — not on Spotify charts or playlists.",
  },
  {
    title: "Public Spotify track links only.",
    body: "Submit a public open.spotify.com/track link. Playlists and albums are not accepted.",
  },
  {
    title: "Official player and artwork only.",
    body: "Titles, covers, and previews come from Spotify’s public oEmbed and official player. Do not upload files.",
  },
] as const;

export default function Page() {
  return (
    <>
      <HomeJsonLd />
      <SiteHeader />
      <section className="mx-auto max-w-6xl border-b border-white/8 px-4 py-6 sm:px-6">
        <p className="text-sm text-[#a7a7a7]">
          Independent song board · Not affiliated with Spotify
        </p>
        <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl">
          Bid for song rank on a live music leaderboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#b3b3b3]">
          Paste a public track link, outbid for the top spot, and compete on this
          fan billboard. Ranking here does not change Spotify playlists, charts,
          or streams.
        </p>
      </section>
      <HomeBoard />

      <section
        id="rules-home"
        className="mx-auto max-w-6xl border-t border-white/8 px-4 py-14 sm:px-6"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Rules / how it works</h2>
            <p className="mt-1 text-sm text-[#a7a7a7]">
              Simple rules. Visible outcomes.
            </p>
          </div>
          <Link href="/rules" className="text-sm text-(--accent) hover:underline">
            Full rules →
          </Link>
        </div>
        <p className="mb-6 max-w-2xl text-sm text-[#b3b3b3]">
          Every confirmed bid buys a public position on PlaylistBid — not a
          promise of permanent #1.
        </p>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map((rule, i) => (
            <li key={rule.title} className="card p-4">
              <p className="text-xs font-bold tracking-wide text-(--accent)">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-sm font-semibold">{rule.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a7a7a7]">
                {rule.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="about"
        className="mx-auto max-w-6xl border-t border-white/8 px-4 py-14 sm:px-6"
      >
        <h2 className="text-xl font-bold">About PlaylistBid</h2>
        <p className="mt-1 text-sm text-[#a7a7a7]">
          An attention market for favorite songs.
        </p>
        <div className="mt-5 max-w-3xl space-y-4 text-sm leading-relaxed text-[#b3b3b3]">
          <p>
            Fans compete with money, not an opaque feed. Paste a public Spotify
            track, pay your bid on PayPal, and claim a visible rank on this
            independent music billboard.
          </p>
          <p>
            We fetch public metadata automatically, show bid amounts and clicks,
            and keep the rules legible. PlaylistBid is not affiliated with,
            endorsed by, or connected to Spotify AB.
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
