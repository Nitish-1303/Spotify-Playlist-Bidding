import { SiteFooter, SiteHeader } from "@/components/chrome";
import { HomeBoard } from "@/components/home-board";
import { HomeJsonLd } from "@/components/json-ld";

export default function Page() {
  return (
    <>
      <HomeJsonLd />
      <SiteHeader />
      <section className="mx-auto max-w-6xl border-b border-white/8 px-4 py-8 sm:px-6">
        <p className="text-sm text-[#a7a7a7]">
          Independent song board · Not affiliated with Spotify
        </p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          PlaylistBid — bid for song rank on a live music leaderboard
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#b3b3b3]">
          Paste a public track link, place a bid, and compete for the top spot
          on this song bidding billboard. Highest bid ranks #1 here — ranking
          does not change Spotify playlists, charts, or streams.
        </p>
      </section>
      <HomeBoard />
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="text-xl font-bold">Song bidding FAQ</h2>
        <dl className="mt-5 space-y-5 text-[#b3b3b3]">
          <div>
            <dt className="font-semibold text-white">What is PlaylistBid?</dt>
            <dd className="mt-1 text-sm leading-relaxed">
              A competitive music leaderboard where fans bid to rank favorite
              songs on this website.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white">
              Does this put my song on Spotify playlists?
            </dt>
            <dd className="mt-1 text-sm leading-relaxed">
              No. PlaylistBid is independent. Playback uses Spotify’s official
              player, but your bid only ranks the track on PlaylistBid.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white">How do I bid for song rank?</dt>
            <dd className="mt-1 text-sm leading-relaxed">
              Paste a public song link, set a bid starting at $1, and submit.
              The same link again raises your existing bid.
            </dd>
          </div>
        </dl>
      </section>
      <SiteFooter />
    </>
  );
}
