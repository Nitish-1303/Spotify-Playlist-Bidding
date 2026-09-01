import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Figtree } from "next/font/google";
import { BoardProvider } from "@/lib/board-context";
import { NowPlayingProvider } from "@/lib/now-playing";
import { VisitorStatsProvider } from "@/lib/visitor-stats";
import { DataFastAnalytics } from "@/components/datafast";
import { MiniPlayer } from "@/components/mini-player";
import {
  MAKER_NAME,
  MAKER_URL,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

/**
 * One family, the full weight range. Headings and prices run at 800 and the
 * interface at 400–600, which is where the whole visual hierarchy comes from.
 */
const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

/**
 * The title leads with what a music fan is actually searching for rather than
 * with what the thing is architecturally — nobody types "song bidding
 * leaderboard" into Google, and plenty of people type some version of getting
 * their favourite song to number one. The mechanic follows the pipe, where it
 * still counts for relevance without spending the part a searcher reads.
 *
 * `authors` and `creator` name the person, not the site. Naming the site as its
 * own author says nothing; naming a person gives search engines an entity to
 * tie this to, and gives the structured data's Person node something to agree
 * with.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Put Your Favorite Song at #1 | Song Bidding Playlist`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: MAKER_NAME, url: MAKER_URL }],
  creator: MAKER_NAME,
  publisher: SITE_NAME,
  category: "music",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Put Your Favorite Song at #1`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Put Your Favorite Song at #1`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    // Add your Google Search Console code in NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION when ready
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className={sans.className} suppressHydrationWarning>
        <BoardProvider>
          <VisitorStatsProvider>
            <NowPlayingProvider>
              {children}
              <MiniPlayer />
            </NowPlayingProvider>
          </VisitorStatsProvider>
        </BoardProvider>
        <Analytics />
        <DataFastAnalytics />
      </body>
    </html>
  );
}
