# Spotify brand assets

`Full_Logo_White_RGB.svg` is Spotify's official full logo, downloaded unchanged
from Spotify's design guidelines asset pack:

    https://developer.spotify.com/documentation/design
    → Download Full Logo (2024-spotify-full-logo.zip)

It is here because Spotify requires it. Their guidelines state that any Spotify
metadata you display — track names, artwork, playback — "must always be
accompanied by the Spotify brand", and that "you must always attribute content
from Spotify with the logo". This site shows titles and cover art from Spotify's
public oEmbed endpoint and plays audio through Spotify's embedded player, so the
attribution is not optional.

Rules this file is subject to, taken from that same page. Read them before
touching anything here:

- **Do not modify it.** No recolouring, rotating, stretching, filling, cropping,
  or rebuilding it from shapes. There are no exceptions, which is why the vendor
  file is committed verbatim rather than redrawn inline.
- **White, not green, on this site.** The green logo may only sit on a black or
  white background; every other background takes a monochrome logo. Our `--paper`
  is `#0a0a0b`, which is not black, so the white version is the correct one.
- **Minimum size 70px wide** for the full logo (21px for the icon alone).
- **Clear space** on all sides equal to half the height of the icon.
- **No co-branding.** It must not appear beside the PlaylistBid logo, so it stays
  out of the masthead and the footer, and it must never be placed over artwork.
- The full logo (icon + wordmark) is the default; the icon may stand alone only
  where there is no room for the full lockup. The wordmark may never stand alone.

Displayed metadata must also link back to Spotify. Each row title on the tape
links to its `open.spotify.com/track/…` page, which is what satisfies that.

Using the logo this way is attribution for Spotify's content. It is not a claim
of endorsement, and the independence disclosures in `src/components/independence.tsx`
say so in the site's own words.
