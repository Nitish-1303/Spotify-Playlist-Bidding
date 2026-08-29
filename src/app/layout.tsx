import "./globals.css";
import type { Metadata, Viewport } from "next";import { Analytics } from "@vercel/analytics/next";
import {
  Courier_Prime,
  Instrument_Sans,
  Permanent_Marker,
} from "next/font/google";
import { BoardProvider } from "@/lib/board-context";
import { NowPlayingProvider } from "@/lib/now-playing";
import { VisitorStatsProvider } from "@/lib/visitor-stats";
import { MiniPlayer } from "@/components/mini-player";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

/**
 * Marker face — song titles, prices and headlines, as if someone wrote them
 * onto the cassette label by hand. Nowhere else.
 */
const hand = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
  display: "swap",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

/** Typewriter face for the typed parts of a tape label: sides, tracks, counts. */
const slip = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-slip",
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
  themeColor: "#efe3c8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hand.variable} ${body.variable} ${slip.variable}`}
      suppressHydrationWarning
    >
      <body className={body.className} suppressHydrationWarning>
        <BoardProvider>
          <VisitorStatsProvider>
            <NowPlayingProvider>
              {children}
              <MiniPlayer />
            </NowPlayingProvider>
          </VisitorStatsProvider>
        </BoardProvider>
        <Analytics />
      </body>
    </html>
  );
}
