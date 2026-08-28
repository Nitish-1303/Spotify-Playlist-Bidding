import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BoardProvider } from "@/lib/board-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PlaylistBid — Rank a song on the board",
  description:
    "A fan billboard for favorite songs. Paste a public track link, bid for rank on this site. Not affiliated with Spotify.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <BoardProvider>{children}</BoardProvider>
      </body>
    </html>
  );
}
