export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://playlistbid.vercel.app";

export const SITE_NAME = "PlaylistBid";

/** PayPal.Me tip/bid checkout — amount appended as /{dollars} */
export const PAYPAL_ME_URL = "https://paypal.me/YeluruNitish";

/** Personal UPI (India) — no merchant account required */
export const UPI_ID =
  process.env.NEXT_PUBLIC_UPI_ID?.trim() || "9676446375@ybl";

export const UPI_NAME =
  process.env.NEXT_PUBLIC_UPI_NAME?.trim() || "Yeluru Nitish";

/** Approx USD→INR for UPI intents (board bids stay in USD) */
export const USD_TO_INR = Number(process.env.NEXT_PUBLIC_USD_TO_INR) || 84;

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
