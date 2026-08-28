import "./globals.css";
import type { Metadata } from "next";
import { BoardProvider } from "@/lib/board-context";

export const metadata: Metadata = {
  title: "PlaylistBid — Bid your favorite Spotify song",
  description:
    "The competitive Spotify billboard. Drop a track link, outbid the board, and put your favorite song in front of everyone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <BoardProvider>{children}</BoardProvider>
      </body>
    </html>
  );
}
