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

/**
 * Who made it, and where.
 *
 * A named person is worth more here than a bare "built by the team" line: it
 * gives search engines an entity to attach the site to, and it gives a visitor
 * being asked for a dollar somebody to hold responsible for it. Same reason the
 * Person node exists in the structured data.
 *
 * The link goes to a profile that is verifiably the maker's. Swap it for a
 * LinkedIn or personal site if that's the better front door.
 */
export const MAKER_NAME = "Nitish Yeluru";
export const MAKER_URL = "https://github.com/Nitish-1303";
export const MAKER_LOCATION = "India";

export const SITE_DESCRIPTION =
  "Put your favorite song at #1. PlaylistBid is one shared playlist where every position is for sale: paste a song link, pick the slot you want, and pay a dollar more than whoever is holding it. An independent fan project, not affiliated with Spotify AB.";

/**
 * Search intent, not a wish list.
 *
 * Google has ignored this tag for years, so nothing here earns a rank on its
 * own — the title, the description, the headings and the structured data do
 * that. It stays because Next supports it, some smaller engines still read it,
 * and the crawlers that feed answer engines do too.
 *
 * Deliberately no "Spotify" term anywhere in it. Bidding on Spotify's name to
 * pull in their traffic is exactly the implied-endorsement problem the rest of
 * the site is built to avoid, and no amount of reach is worth being the site
 * that did that.
 *
 * Both spellings of "favourite" are here on purpose: the page copy settles on
 * the American one to match en_US, and the British one is a different query
 * with its own volume.
 */
export const SITE_KEYWORDS = [
  "PlaylistBid",
  "put your favorite song at number 1",
  "put your favourite song at number 1",
  "favorite song leaderboard",
  "favourite song leaderboard",
  "shared playlist",
  "collaborative playlist",
  "song ranking site",
  "playlist leaderboard",
  "song bidding",
  "bid for song rank",
  "pay to rank songs",
  "music leaderboard",
  "music bidding site",
  "song billboard",
  "competitive music board",
  "songs ranked by fans",
  "best songs of all time list",
  "music chart game",
  "music lovers community",
  "top songs chart",
  "music discovery site",
];
