import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

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
        offers: {
          "@type": "Offer",
          price: "1.00",
          priceCurrency: "USD",
          description: "Minimum bid to rank a song on the PlaylistBid leaderboard",
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
              text: "PlaylistBid is an independent song bidding leaderboard. You paste a public track link and bid for rank on this website.",
            },
          },
          {
            "@type": "Question",
            name: "Does bidding place my song on Spotify playlists?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. PlaylistBid ranks songs only on this site. It is not affiliated with Spotify and does not change Spotify playlists, charts, or streams.",
            },
          },
          {
            "@type": "Question",
            name: "How do I bid for song rank?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Paste a public song link, choose a bid amount starting at $1, and submit. The highest bid sits at #1 on the PlaylistBid board.",
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
