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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Song Bidding Leaderboard | Bid for Music Rank`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
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
    title: `${SITE_NAME} — Song Bidding Leaderboard`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Song Bidding Leaderboard`,
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
