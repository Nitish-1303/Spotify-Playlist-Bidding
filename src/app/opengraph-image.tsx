import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PlaylistBid — Song bidding leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "#121212",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#2dd4bf",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#042f2e",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            ♪
          </div>
          <div style={{ fontSize: 48, fontWeight: 700 }}>PlaylistBid</div>
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15, maxWidth: 900 }}>
          Bid for song rank on a live music leaderboard
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: "#a7a7a7", maxWidth: 820 }}>
          Paste a track link. Highest bid sits at #1. Independent board — not Spotify.
        </div>
      </div>
    ),
    { ...size },
  );
}
