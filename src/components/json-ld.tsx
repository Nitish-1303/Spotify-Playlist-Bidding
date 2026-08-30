import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Structured data. Every field here is a public claim about what this site is,
 * so the independence statement belongs in it too — a rich result should not be
 * able to read as an official Spotify product either.
 */
const INDEPENDENCE =
  "PlaylistBid is an independent fan project. It is not affiliated with, endorsed by, sponsored by, or connected to Spotify AB. Spotify is a trademark of Spotify AB.";

export function HomeJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        disambiguatingDescription: INDEPENDENCE,
        inLanguage: "en",
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
        offers: {
          "@type": "Offer",
          price: "1.00",
          priceCurrency: "USD",
          description:
            "Opening price for a track position on the PlaylistBid tape. A position exists on this site only.",
        },
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
              text: `No. ${INDEPENDENCE} PlaylistBid uses Spotify track links, Spotify's public oEmbed metadata and Spotify's official embedded player, and nothing more.`,
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
