import {
  MAKER_LOCATION,
  MAKER_NAME,
  MAKER_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

/**
 * Structured data. Every field here is a public claim about what this site is,
 * so the independence statement belongs in it too — a rich result should not be
 * able to read as an official Spotify product either.
 */
const INDEPENDENCE =
  "PlaylistBid is an independent fan project. It is not affiliated with, endorsed by, sponsored by, or connected to Spotify AB. Spotify is a trademark of Spotify AB.";

const MAKER_ID = `${SITE_URL}/#maker`;

export function HomeJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      /*
        One Person node, referenced by @id everywhere else rather than repeated.
        This is what turns "some site" into "a thing a named person made", which
        is the difference between a page and an entity as far as a search engine
        is concerned — and it is the machine-readable half of the credit line in
        the footer.
      */
      {
        "@type": "Person",
        "@id": MAKER_ID,
        name: MAKER_NAME,
        url: MAKER_URL,
        nationality: MAKER_LOCATION,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        disambiguatingDescription: INDEPENDENCE,
        inLanguage: "en",
        author: { "@id": MAKER_ID },
        creator: { "@id": MAKER_ID },
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Web",
        description: SITE_DESCRIPTION,
        disambiguatingDescription: INDEPENDENCE,
        author: { "@id": MAKER_ID },
        creator: { "@id": MAKER_ID },
        countryOfOrigin: {
          "@type": "Country",
          name: MAKER_LOCATION,
        },
        offers: {
          "@type": "Offer",
          price: "1.00",
          priceCurrency: "USD",
          description:
            "Opening price for a track position on the PlaylistBid tape. A position exists on this site only.",
        },
      },
      /*
        The tape, typed as what it is. No track list: the running order is read
        by the browser after this page is served, and structured data that names
        songs the HTML does not is the kind of mismatch Google penalises. This
        describes the playlist; the songs describe themselves on the page.
      */
      {
        "@type": "MusicPlaylist",
        "@id": `${SITE_URL}/#tape`,
        name: `The ${SITE_NAME} tape`,
        url: SITE_URL,
        description:
          "One shared playlist, ordered by what each position cost. Anyone can take a position by paying a dollar more than whoever is holding it, and every song on it was put there by somebody who paid for that slot.",
        disambiguatingDescription: INDEPENDENCE,
        genre: "Any",
        isAccessibleForFree: true,
        creator: { "@id": MAKER_ID },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "What is PlaylistBid?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "PlaylistBid is an independent fan project: one shared mixtape where every track position has a price. You paste a public Spotify track link and buy the position you want on this website. It is not affiliated with, endorsed by, sponsored by, or connected to Spotify AB.",
            },
          },
          {
            "@type": "Question",
            name: "Is PlaylistBid affiliated with Spotify?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `No. ${INDEPENDENCE} PlaylistBid uses Spotify track links, Spotify's own public metadata APIs and Spotify's official embedded player, and nothing more.`,
            },
          },
          {
            "@type": "Question",
            name: "Does buying a position change Spotify playlists or charts?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Track positions exist only on PlaylistBid and do not change Spotify playlists, charts, rankings, or streams. Plays are counted on this site alone.",
            },
          },
          {
            "@type": "Question",
            name: "How do I buy a track position?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Paste a public Spotify track link, pick the track position you want, and pay what that slot costs — a dollar more than whoever holds it, starting at $1 for the open end of the tape. The song lands on that position once the card payment is confirmed.",
            },
          },
          {
            "@type": "Question",
            name: "Can I put any song at number 1?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Any song with a public Spotify track link. Track 1 costs a dollar more than whatever the song currently holding it paid, so the price of the top of the tape is set by whoever wanted it most so far. Nobody can be outbid off the tape entirely — a song that loses track 1 moves to track 2.",
            },
          },
          {
            "@type": "Question",
            name: "Is PlaylistBid free to use?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Listening to the tape, reading every price and play count, and playing any song in the embedded player are all free and need no account. Money is only involved in taking a track position, which is a one-off card payment for that slot — there is no subscription and nothing is stored to charge you again.",
            },
          },
          {
            "@type": "Question",
            name: "Who made PlaylistBid, and where?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `${SITE_NAME} was built in ${MAKER_LOCATION} by ${MAKER_NAME}, a software engineer, as an independent side project. It is not a company product and has no connection to any music service. The pricing mechanic is based on outbid.lol, which applies the same idea to startups rather than songs.`,
            },
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
