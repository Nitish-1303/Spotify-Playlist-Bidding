export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://playlistbid.vercel.app";

export const SITE_NAME = "PlaylistBid";

/**
 * Card payments run through Dodo Payments' hosted checkout. Everything secret
 * (API key, product id, webhook key) stays server-side in the checkout route —
 * nothing about the merchant account belongs in the browser bundle.
 */
export const PAYMENT_PROVIDER = "Dodo Payments";
export const PAYMENT_PROVIDER_URL = "https://dodopayments.com";

export const SITE_DESCRIPTION =
  "PlaylistBid is an independent fan project: one shared mixtape where every track position has a price. Paste a public Spotify track link and buy the slot you want. Not affiliated with Spotify AB.";

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
