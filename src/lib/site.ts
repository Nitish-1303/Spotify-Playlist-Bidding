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

/**
 * The Product Hunt listing, and the live badge that goes with it.
 *
 * The badge is an SVG served by Product Hunt and rendered fresh on every load,
 * so the number on it is theirs to change, not ours to update. Before a launch
 * it reads "FIND US ON" with a count of zero; once the launch is live it
 * becomes "FEATURED ON" and carries the running upvote count. That is the whole
 * reason to embed the image rather than ship a screenshot of it.
 *
 * theme=dark to sit on our own background — the light variant is a white card
 * and would look pasted on.
 */
export const PRODUCT_HUNT_ID = "1238392";
export const PRODUCT_HUNT_URL =
  "https://www.producthunt.com/products/playlistbid?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-playlistbid";
export const PRODUCT_HUNT_BADGE = `https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=${PRODUCT_HUNT_ID}&theme=dark`;

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
