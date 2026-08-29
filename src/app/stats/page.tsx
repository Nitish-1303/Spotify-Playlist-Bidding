import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { StatsView } from "@/components/stats-view";

export const metadata: Metadata = {
  title: "House ledger — live visitors and board figures",
  description:
    "Live traffic and board figures for PlaylistBid: visitors in the room now, views today, top pages, referrers, standing bids and money by shelf.",
  alternates: { canonical: "/stats" },
};

export default function StatsPage() {
  return (
    <>
      <SiteHeader />
      <main className="rack pt-8 pb-16">
        <Link href="/" className="slip tie">
          ← back to the rack
        </Link>
        <h1 className="marquee mt-4 text-4xl">House ledger</h1>
        <p className="mt-4 max-w-2xl leading-relaxed">
          Two sets of numbers. Traffic is counted server-side for everyone who
          opens the site. The rack figures are the confirmed bids saved in this
          browser.
        </p>
        <div className="mt-7">
          <StatsView />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
