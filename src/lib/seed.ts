import type { Activity, Spot } from "./types";
import { spotifyTrackUrl } from "./spotify";

function hoursAgo(h: number) {
  return Date.now() - h * 60 * 60 * 1000;
}

/**
 * trackId, title, artist, cover, price, plays, hours since it last moved.
 *
 * Listed in chart order. Where two songs hold the same price the one listed
 * first must be the one that has held it longest, because that is the tie rule
 * the tape runs on — so the hours only ever grow down a run of equal prices.
 */
const SEED: [string, string, string, string, number, number, number][] = [
  ["0VjIjW4GlUZAMYd2vXMi3b", "Blinding Lights", "The Weeknd", "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e028863bc11d2aa12b54f5aeb36", 9, 41, 0.02],
  ["7KXjTSCq5nL1LoYtL7XAwS", "HUMBLE.", "Kendrick Lamar", "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e028b52c6b9bc4e43d873869699", 8, 28, 0.5],
  ["4u7EnebtmKWzUH433cf5Qv", "Bohemian Rhapsody", "Queen", "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e319baafd16e84f0408af2a0", 7, 19, 1],
  ["3n3Ppam7vgaVa1iaRUc9Lp", "Mr. Brightside", "The Killers", "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029c284a6855f4945dc5a3cd73", 6, 12, 0.05],
  ["1zi7xx7UVEFkmKfv06H8x0", "One Dance", "Drake", "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029416ed64daf84936d89e671c", 5, 33, 2],
  ["0bYg9bo50gSsH3LtXe2SQn", "All I Want for Christmas Is You", "Mariah Carey", "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02c0862332847213b151ffab31", 4, 9, 3],
  ["1mea3bSkSGXuIRvnydlB5b", "Viva La Vida", "Coldplay", "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02e21cc1db05580b6f2d2a3b6e", 3, 15, 4],
  ["0pqnGHJpmpxLKifKRmU6WP", "Believer", "Imagine Dragons", "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025675e83f707f1d7271e5cf8a", 2, 22, 8],
  ["6GyFP1nfCDB8lbD2bG0Hq9", "Midnight City", "M83", "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0262100064780b1d919a95fcf4", 2, 7, 6],
  ["6habFhsOp2NvshLv26DqMb", "Despacito", "Luis Fonsi", "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ef0d4234e1a645740f77d59c", 1, 18, 20],
  ["5HCyWlXZPP0y6Gqq8TgA20", "Stay", "The Kid LAROI, Justin Bieber", "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02aed1660585c1e3c9ffb50b6a", 1, 11, 18],
  ["0e7ipj03S05BNilyu5bRzt", "rockstar", "Post Malone", "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02b1c4b76e23414c9f20242268", 1, 5, 12],
];

/** The tape as it ships, before anyone has paid for a slot. */
export const SEED_SPOTS: Spot[] = SEED.map(
  ([trackId, title, artist, thumbnailUrl, bid, clicks, hours], i) => ({
    id: `s${i + 1}`,
    trackId,
    trackUrl: spotifyTrackUrl(trackId),
    title,
    artist,
    thumbnailUrl,
    bid,
    clicks,
    raisedAt: hoursAgo(hours),
  }),
);

export const SEED_ACTIVITY: Activity[] = SEED_SPOTS.slice(0, 6).map((s, i) => ({
  id: `a${i}`,
  trackId: s.trackId,
  title: s.title,
  artist: s.artist,
  bid: s.bid,
  at: s.raisedAt,
}));
