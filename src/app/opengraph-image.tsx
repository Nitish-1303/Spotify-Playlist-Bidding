import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PlaylistBid — pick the track, pay for the slot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The same tokens the site runs on. The green is ours, not Spotify's, and no
   Spotify logo or wordmark appears on the card. */
const PAPER = "#0a0a0b";
const STRIP = "#17171a";
const EDGE = "#2b2b31";
const INK = "#f5f5f6";
const HAMMER = "#22c55e";
const ON_HAMMER = "#05140a";
const PRESS = "#7cb2ff";
const CHROME = "#a7a7ae";
const SLOT = "#52525b"; /* an unlit row in the mark — lifted from #3f3f46,
                           which goes muddy at this size */

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
          background: `linear-gradient(150deg, #14251b 0%, ${PAPER} 46%, ${PAPER} 100%)`,
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
          {/* The mark: three rows, top slot lit. Same shapes as the favicon,
              drawn as boxes so nothing here depends on a font. */}
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              background: STRIP,
              border: `1px solid ${EDGE}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              gap: 5,
              padding: 11,
            }}
          >
            <div style={{ width: 36, height: 8, borderRadius: 4, background: HAMMER }} />
            <div style={{ width: 27, height: 8, borderRadius: 4, background: SLOT }} />
            <div style={{ width: 18, height: 8, borderRadius: 4, background: SLOT }} />
          </div>
          {/* Satori needs display:flex on any box with more than one child, and
              a text node beside the coloured span counts as two. Without it the
              whole card fails to render rather than falling back. */}
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
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

        {/* One row of the tape, the way the site prints them. */}
        <div
          style={{
            marginTop: 44,
            display: "flex",
            width: 1000,
            background: STRIP,
            border: `1px solid ${EDGE}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 84,
              background: HAMMER,
              color: ON_HAMMER,
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
                A dollar clear of the holder · card checkout · live liner notes
              </div>
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, color: HAMMER }}>$1+</div>
          </div>
        </div>

        {/* The share card is often the whole first impression, so it carries
            the disclosure too. */}
        <div
          style={{
            marginTop: 26,
            fontSize: 20,
            letterSpacing: 2,
            color: PRESS,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Independent fan project · not affiliated with Spotify AB
        </div>
      </div>
    ),
    { ...size },
  );
}
