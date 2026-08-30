import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { StatsView } from "@/components/stats-view";

export const metadata: Metadata = {
  title: "Liner notes — live listeners and tape figures",
  description:
    "Live traffic and tape figures for PlaylistBid: people listening now, views today, top pages, referrers, and what each track on the tape is holding.",
  alternates: { canonical: "/stats" },
};

export default function StatsPage() {
  return (
    <>
      <SiteHeader />
      <main className="rack pt-8 pb-16">
        <Link href="/" className="slip tie">
          ← back to the tape
        </Link>
        <h1 className="marquee mt-4 text-4xl">Liner notes</h1>
        <p className="mt-4 max-w-2xl leading-relaxed">
          Two sets of numbers, both counted server-side: traffic from everyone
          who opens the site, and the tape as confirmed payments have left it.
        </p>
        <div className="mt-7">
          <StatsView />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
