import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

/**
 * The independence disclosures.
 *
 * PlaylistBid uses Spotify track links, Spotify's public oEmbed metadata and
 * Spotify's official embedded player. It is an independent fan project with no
 * affiliation to Spotify AB, and nothing on this site should be readable as an
 * official Spotify product. That statement is made in four places — the strip
 * under the masthead, the card below the hero, a footnote wherever Spotify
 * artwork or playback appears, and the footer — so it cannot be missed by
 * someone who never scrolls to the bottom.
 *
 * All three components here are server-renderable and carry no state.
 */

/**
 * A drawn information mark. Deliberately an inline SVG rather than an emoji:
 * emoji render as a different typeface on every platform and are announced by
 * screen readers as their own noun.
 */
function InfoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      <circle cx="12" cy="12" r="9.25" />
      <path d="M12 10.75v6" />
      <path d="M12 7.4v0.05" strokeWidth="2.4" />
    </svg>
  );
}

/**
 * The primary disclosure, printed directly below the hero.
 *
 * A product disclosure, not an alert: label stock, one ballpoint rule across
 * the top, and the site's own type. "Not affiliated with Spotify" carries the
 * marker colour so it reads first.
 */
export function IndependenceCard() {
  return (
    <aside className="indie" aria-labelledby="independence-tag">
      <InfoMark className="indie-mark" />
      <div className="min-w-0">
        <span id="independence-tag" className="indie-tag">
          independent fan project
        </span>
        <p className="indie-text">
          {SITE_NAME} is <b>not affiliated with Spotify</b> — not endorsed by,
          sponsored by, or connected to Spotify AB. Track positions are bought
          and held on this site only.{" "}
          <Link href="/rules" className="slip tie whitespace-nowrap">
            what that means
          </Link>
        </p>
      </div>
    </aside>
  );
}

/**
 * The contextual footnote for the tape: covers, links and the embedded player
 * all come from Spotify, and none of that makes Spotify a party to this site.
 */
export function SpotifyContentNote({ className }: { className?: string }) {
  return (
    <p className={`footnote ${className ?? ""}`}>
      <InfoMark className="h-3.5 w-3.5" />
      <span>
        Song titles, artwork and playback are provided through Spotify&apos;s
        own supported services — its public oEmbed endpoint and its official
        embedded player. {SITE_NAME} is an independent fan project and is not
        affiliated with Spotify AB.
      </span>
    </p>
  );
}

/**
 * The purchase footnote, shown at the paddle before the payment button.
 *
 * A slot on this tape is the whole of what is being sold. Nothing about the
 * purchase reaches Spotify, and the payment provider has no connection to it
 * either — so neither is named alongside the other.
 */
export function PurchaseScopeNote({ className }: { className?: string }) {
  return (
    <p className={`footnote ${className ?? ""}`}>
      <InfoMark className="h-3.5 w-3.5" />
      <span>
        You&apos;re purchasing a position on the {SITE_NAME} tape. This does not
        modify Spotify playlists, charts, rankings, or stream counts, and buys
        no promotion, advertising or placement anywhere else.
      </span>
    </p>
  );
}
