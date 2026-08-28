export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://playlistbid.vercel.app";

export const SITE_NAME = "PlaylistBid";

export const SITE_DESCRIPTION =
  "PlaylistBid is a song bidding leaderboard. Paste a public track link, bid for rank, and put your favorite song at the top of this independent music billboard. Not affiliated with Spotify.";

export const SITE_KEYWORDS = [
  "PlaylistBid",
  "song bidding",
  "music leaderboard",
  "bid for song rank",
  "song billboard",
  "music bidding site",
  "favorite song leaderboard",
  "competitive music board",
];
