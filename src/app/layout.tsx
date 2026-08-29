import "./globals.css";
import type { Metadata, Viewport } from "next";import { Analytics } from "@vercel/analytics/next";
import { Anton, Courier_Prime, Instrument_Sans } from "next/font/google";
import { BoardProvider } from "@/lib/board-context";
import { VisitorStatsProvider } from "@/lib/visitor-stats";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

/** Marquee face — hammer prices, lot numbers, headlines only. */
const marquee = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marquee",
  display: "swap",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

/** Typed consignment-slip face for labels, counts and ledger columns. */
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
  themeColor: "#efeee8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${marquee.variable} ${body.variable} ${slip.variable}`}
      suppressHydrationWarning
    >
      <body className={body.className} suppressHydrationWarning>
        <BoardProvider>
          <VisitorStatsProvider>{children}</VisitorStatsProvider>
        </BoardProvider>
        <Analytics />
      </body>
    </html>
  );
}
