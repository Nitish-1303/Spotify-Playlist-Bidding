import type { Activity, Spot } from "./types";

function hoursAgo(h: number) {
  return Date.now() - h * 60 * 60 * 1000;
}

export const SEED_SPOTS: Spot[] = [
  {
    id: "s1",
    trackId: "0VjIjW4GlUZAMYd2vXMi3b",
    trackUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
    title: "Blinding Lights",
    artist: "The Weeknd",
    thumbnailUrl:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e028863bc11d2aa12b54f5aeb36",
    genre: "Pop",
    bid: 9,
    clicks: 41,
    raisedAt: hoursAgo(0.02),
  },
  {
    id: "s2",
    trackId: "7KXjTSCq5nL1LoYtL7XAwS",
    trackUrl: "https://open.spotify.com/track/7KXjTSCq5nL1LoYtL7XAwS",
    title: "HUMBLE.",
    artist: "Kendrick Lamar",
    thumbnailUrl:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e028b52c6b9bc4e43d873869699",
    genre: "Hip-Hop",
    bid: 8,
    clicks: 28,
    raisedAt: hoursAgo(0.5),
  },
  {
    id: "s3",
    trackId: "4u7EnebtmKWzUH433cf5Qv",
    trackUrl: "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    thumbnailUrl:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e319baafd16e84f0408af2a0",
    genre: "Rock",
    bid: 7,
    clicks: 19,
    raisedAt: hoursAgo(1),
  },
  {
    id: "s4",
    trackId: "3n3Ppam7vgaVa1iaRUc9Lp",
    trackUrl: "https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp",
    title: "Mr. Brightside",
    artist: "The Killers",
    thumbnailUrl:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029c284a6855f4945dc5a3cd73",
    genre: "Indie",
    bid: 6,
    clicks: 12,
    raisedAt: hoursAgo(0.05),
  },
  {
    id: "s5",
    trackId: "1zi7xx7UVEFkmKfv06H8x0",
    trackUrl: "https://open.spotify.com/track/1zi7xx7UVEFkmKfv06H8x0",
    title: "One Dance",
    artist: "Drake",
    thumbnailUrl:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029416ed64daf84936d89e671c",
    genre: "R&B",
    bid: 5,
    clicks: 33,
    raisedAt: hoursAgo(2),
  },
  {
    id: "s6",
    trackId: "0bYg9bo50gSsH3LtXe2SQn",
    trackUrl: "https://open.spotify.com/track/0bYg9bo50gSsH3LtXe2SQn",
    title: "All I Want for Christmas Is You",
    artist: "Mariah Carey",
    thumbnailUrl:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02c0862332847213b151ffab31",
    genre: "Pop",
    bid: 4,
    clicks: 9,
    raisedAt: hoursAgo(3),
  },
  {
    id: "s7",
    trackId: "1mea3bSkSGXuIRvnydlB5b",
    trackUrl: "https://open.spotify.com/track/1mea3bSkSGXuIRvnydlB5b",
    title: "Viva La Vida",
    artist: "Coldplay",
    thumbnailUrl:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02e21cc1db05580b6f2d2a3b6e",
    genre: "Rock",
    bid: 3,
    clicks: 15,
    raisedAt: hoursAgo(4),
  },
  {
    id: "s8",
    trackId: "0pqnGHJpmpxLKifKRmU6WP",
    trackUrl: "https://open.spotify.com/track/0pqnGHJpmpxLKifKRmU6WP",
    title: "Believer",
    artist: "Imagine Dragons",
    thumbnailUrl:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025675e83f707f1d7271e5cf8a",
    genre: "Rock",
    bid: 2,
    clicks: 22,
    raisedAt: hoursAgo(6),
  },
  {
    id: "s9",
    trackId: "6GyFP1nfCDB8lbD2bG0Hq9",
    trackUrl: "https://open.spotify.com/track/6GyFP1nfCDB8lbD2bG0Hq9",
    title: "Midnight City",
    artist: "M83",
    thumbnailUrl:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0262100064780b1d919a95fcf4",
    genre: "Electronic",
    bid: 2,
    clicks: 7,
    raisedAt: hoursAgo(8),
    askingPrice: 20,
  },
  {
    id: "s10",
    trackId: "6habFhsOp2NvshLv26DqMb",
    trackUrl: "https://open.spotify.com/track/6habFhsOp2NvshLv26DqMb",
    title: "Despacito",
    artist: "Luis Fonsi",
    thumbnailUrl:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ef0d4234e1a645740f77d59c",
    genre: "Latin",
    bid: 1,
    clicks: 18,
    raisedAt: hoursAgo(12),
  },
  {
    id: "s11",
    trackId: "5HCyWlXZPP0y6Gqq8TgA20",
    trackUrl: "https://open.spotify.com/track/5HCyWlXZPP0y6Gqq8TgA20",
    title: "Stay",
    artist: "The Kid LAROI, Justin Bieber",
    thumbnailUrl:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02aed1660585c1e3c9ffb50b6a",
    genre: "Pop",
    bid: 1,
    clicks: 11,
    raisedAt: hoursAgo(18),
  },
  {
    id: "s12",
    trackId: "0e7ipj03S05BNilyu5bRzt",
    trackUrl: "https://open.spotify.com/track/0e7ipj03S05BNilyu5bRzt",
    title: "rockstar",
    artist: "Post Malone",
    thumbnailUrl:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02b1c4b76e23414c9f20242268",
    genre: "Hip-Hop",
    bid: 1,
    clicks: 5,
    raisedAt: hoursAgo(20),
  },
];

export const SEED_ACTIVITY: Activity[] = SEED_SPOTS.slice(0, 6).map((s, i) => ({
  id: `a${i}`,
  trackId: s.trackId,
  title: s.title,
  artist: s.artist,
  bid: s.bid,
  at: s.raisedAt,
}));
