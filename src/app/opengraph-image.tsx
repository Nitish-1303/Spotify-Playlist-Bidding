import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PlaylistBid — pick the track, pay for the slot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#efe3c8";
const INK = "#2a2118";
const HAMMER = "#c2402b";
const PRESS = "#2c4a7c";
const CHROME = "#8a7c65";

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
          background: PAPER,
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 5,
              background: HAMMER,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            A1
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 1 }}>
            PLAYLIST<span style={{ color: HAMMER }}>BID</span>
          </div>
          <div
            style={{
              marginLeft: 8,
              fontSize: 19,
              letterSpacing: 3,
              color: PRESS,
              fontWeight: 700,
            }}
          >
            ONE TAPE · EVERY SLOT HAS A PRICE
          </div>
        </div>

        <div
          style={{
            fontSize: 82,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: -1,
            maxWidth: 900,
          }}
        >
          Pick the track. Pay for the slot.
        </div>

        {/* One cassette label, the way the site writes them. */}
        <div
          style={{
            marginTop: 44,
            display: "flex",
            width: 1000,
            background: "#fff",
            border: `2px solid ${HAMMER}`,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 84,
              background: HAMMER,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            A1
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 26px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 30, fontWeight: 700 }}>
                Buy side A · track 1 and the song lands there
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 19,
                  letterSpacing: 2,
                  color: CHROME,
                  textTransform: "uppercase",
                }}
              >
                A dollar clear of the holder · PayPal or UPI · live liner notes
              </div>
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, color: HAMMER }}>$1+</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
