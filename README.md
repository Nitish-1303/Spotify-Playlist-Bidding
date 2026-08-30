# PlaylistBid

Competitive song billboard built around Spotify track links. Paste a track link,
pay for a position on the tape, and your song moves there once the payment is
confirmed.

PlaylistBid is an independent fan project. It is **not affiliated with, endorsed
by, sponsored by, or connected to Spotify AB**, and Spotify is a trademark of
Spotify AB. The site uses Spotify track links, Spotify's own public metadata
APIs and Spotify's official embedded player, and nothing more. Track positions
exist only on PlaylistBid and do not change Spotify playlists, charts, rankings,
or streams. That statement is carried in the UI in four places — the strip under
the masthead, a printed card below the hero, a footnote wherever Spotify
artwork or playback appears, and the footer — so it is not reachable only by
scrolling to the bottom. See [`src/components/independence.tsx`](src/components/independence.tsx).

Payments run entirely through [Dodo Payments](https://dodopayments.com). There is
no other rail: no PayPal, no UPI, no manual "I paid" button. Dodo is the card
processor and has no connection to Spotify.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

## How the tape works

The tape is a single shared document on the server, not per-browser state. It
holds one entry per song: position, title, artist, cover, the price currently
holding that slot, play count, and when it last moved.

Two rules govern it:

- **Order follows the money.** Songs are sorted by price descending; where two
  songs hold the same price, the one that has held it longest stays above. That
  tie rule is what makes a bought position land exactly where it was paid for.
- **A song moves, it never repeats.** Paying for a higher position on a song
  already on the tape relocates its existing entry — play count and all —
  rather than writing the song on twice.

Only a signature-verified Dodo payment changes any of this. Nothing the browser
sends can move the tape.

## Payment lifecycle

1. The buyer picks a song and a position. The browser sends only
   `{ track, position }` to `POST /api/payments/create-checkout`.
2. The server validates the Spotify link and the position, reads the current
   tape, and **calculates the price itself**. An `amount` in the request body is
   ignored — the backend is the only source of truth for what a slot costs.
3. The server reads the song's real title and artist from Spotify — the Web API
   track endpoint when `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` are set,
   falling back to the public oEmbed endpoint otherwise — so a crafted request
   cannot label a slot however it likes. oEmbed has no artist field at all, so
   without the Web API credentials a song goes on the tape with its title alone.
4. The server creates the Dodo checkout with its own amount and its own
   metadata, records a **PENDING** `PaymentTransaction`, and returns the
   checkout URL plus a one-time owner token.
5. The browser redirects to Dodo. The buyer pays there; this app never sees card
   details.
6. Dodo POSTs to `/api/webhooks/dodo`. The signature is verified against
   `DODO_PAYMENTS_WEBHOOK_KEY` before any handler runs.
7. On confirmed success the transaction is marked **SUCCESS** and the tape is
   moved in the same atomic commit. Songs below the bought slot shift one
   position later.
8. Dodo returns the buyer to `/success?tx=…`. That redirect is a UI event only —
   the page proves nothing. It polls `GET /api/payments/:transactionId` with the
   owner token and reports whatever the server says, then refreshes the tape.

### Transaction states

| State | Meaning |
| --- | --- |
| `PENDING` | Checkout opened. Nothing has been paid, nothing has moved. |
| `PROCESSING` | Dodo is still confirming. The tape is untouched. |
| `SUCCESS` | Payment confirmed and the tape has moved. Terminal. |
| `FAILED` | Payment failed. The tape is untouched. Terminal. |
| `CANCELLED` | Buyer abandoned the checkout. The tape is untouched. Terminal. |
| `REFUNDED` | The money was returned. The song comes off the tape. Terminal. |
| `CHARGEBACK` | A dispute went the cardholder's way. Same as a refund. Terminal. |

A transaction never walks backwards out of `SUCCESS`: a late `payment.failed`
for a payment that already settled is recorded as already-final and ignored. The
two reversal states are final the same way, so a stray `payment.processing` can
never put a refunded payment back on its feet.

### When money goes back

`refund.succeeded`, `dispute.lost` and `dispute.accepted` are the three events
where Dodo says the funds have reached the cardholder, and each one runs the
purchase backwards. A position is not stored anywhere — it is read off the order —
so removing the song closes the gap by itself and every song below it moves up
one, the mirror of what buying does.

Two cases deliberately leave the tape alone, and both are logged:

- **A partial refund.** Part of the price came back, which is a judgement about
  whether the sale stands. It is recorded and left to a person.
- **A larger payment holds the position.** A song can be paid for more than once,
  and it is the largest payment that ranks it. If the reversed one is not that
  payment, removing the song would take the slot from someone who has not been
  refunded.

`dispute.opened` is not a reversal. Funds are only held at that stage and the
dispute can still be won, so it is logged loudly and nothing more — a song pulled
off on suspicion cannot be handed its position back once the tape has moved on.

### Idempotency and races

Finalization claims a `paymentId:eventType` key inside the same indivisible
commit that writes the tape, so a redelivered webhook produces one payment and
one tape mutation however the two deliveries interleave. A settled payment also
claims a marker in that same step, and any later non-final event is required to
find it unclaimed — so a retried `payment.processing` arriving after the
`payment.succeeded` it was overtaken by cannot walk the payment backwards, even
if the two land at the same instant.

Concurrent finalizations are serialized by an optimistic version check and
retried, so two buyers paying for the same position both land — the larger,
newer payment keeps the slot and the other is recorded with the position it
actually landed at, never silently overwritten.

## API surface

| Route | Purpose |
| --- | --- |
| `POST /api/payments/create-checkout` | Validate, price server-side, open a Dodo checkout, record a PENDING transaction. |
| `GET /api/payments/:transactionId` | Owner-only view of one payment. Requires the owner token (`?token=` or `x-payment-token`). A wrong token and an unknown id both answer `404 {"error":"Not found."}`. |
| `POST /api/webhooks/dodo` | The only thing that can move the tape. Signature-verified. |
| `GET /api/board` | The public tape. Positions, songs, plays, holding price. No buyers, no payment or transaction ids. |
| `POST /api/board/play` | Records a play. One per visitor per song per hour. Never changes a price or position. |

### Ownership without accounts

There is no login. Opening a checkout mints a 32-byte random owner token; only
its SHA-256 hash is stored, and the token lives in the buyer's own browser. The
receipt endpoint compares in constant time and answers identically for a wrong
token and a nonexistent id, so transactions can be neither read by others nor
enumerated.

## Environment variables

All payment credentials are server-side only. None is `NEXT_PUBLIC_`, and none
is imported by a client component. See [`.env.example`](.env.example) for the
annotated list; placeholders only, never real values.

| Variable | Required | Notes |
| --- | --- | --- |
| `DODO_PAYMENTS_API_KEY` | yes | Unset → checkout answers `503` instead of pretending to take money. |
| `DODO_PAYMENTS_PRODUCT_ID` | yes | The product a slot is billed against. |
| `DODO_PAYMENTS_WEBHOOK_KEY` | yes | Signing secret (`whsec_…`). Unset → the webhook answers `503` and refuses every delivery. |
| `DODO_PAYMENTS_ENVIRONMENT` | no | `test_mode` (default) or `live_mode`. |
| `DODO_PAYMENTS_PRICING_MODE` | no | `pwyw` (default) or `quantity`. |
| `UPSTASH_REDIS_REST_URL` | in production | Also accepted as `KV_REST_API_URL`, except on preview builds. |
| `UPSTASH_REDIS_REST_TOKEN` | in production | Also accepted as `KV_REST_API_TOKEN`, except on preview builds. |
| `SPOTIFY_CLIENT_ID` | no | Web API lookup. Unset → songs go on the tape with no artist. |
| `SPOTIFY_CLIENT_SECRET` | no | Pairs with the id above; both or neither. |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical URLs and sitemap. |

Without Redis the tape falls back to process memory. That is fine for
`npm run dev`, but on serverless it is per-instance and resets on redeploy, so
the site reports itself as not durable and the paddle refuses to take money.

Vercel preview deployments ignore the `KV_REST_API_*` pair on purpose, so a
branch build cannot move slots on the tape people paid for: the Upstash
marketplace integration attaches those names to Preview as well as Production
and will not let the scope be narrowed. Previews run on memory as a result. To
give them a durable tape of their own, set `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` on the Preview environment against a second
database — that pair is honoured everywhere.

### The Spotify pair is enrichment, not a dependency

Spotify's oEmbed endpoint carries a title and a cover and no artist field at
all, which is why songs bought before this lookup existed sit on the tape
labelled `Unknown artist`. The Web API's track endpoint does carry the artist,
and the client-credentials flow is enough to read it: public catalogue data, no
listener logs in, no listener's account is touched. Create an app at
[developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) — it
needs no scopes, and the redirect URI the form demands is never used.

Missing credentials, a refused token, a rate limit or a slow response all fall
through to oEmbed, because a song must not fail to reach the tape over a missing
artist name: the payment has already been taken by then. A song with no artist
prints its title alone rather than a guess, and `artistLine()` in
[`src/lib/format.ts`](src/lib/format.ts) treats the stored `Unknown artist`
label as the absence it always was.

Both variables are read only in [`src/lib/spotify-api.ts`](src/lib/spotify-api.ts),
which no client component imports. The pure link helpers client components do
need stayed behind in [`src/lib/spotify.ts`](src/lib/spotify.ts) — that is the
whole reason the two files are separate.

## Dodo Payments setup — what you must configure by hand

None of this is automatic. The code reads these values; it cannot create them
for you.

**1. Create the product.** Dodo dashboard → Products.

- **Recommended:** a one-time **Pay What You Want** product. The server sends
  `amount = dollars * 100` in minor units per checkout. Leave
  `DODO_PAYMENTS_PRICING_MODE=pwyw`.
- **Alternative:** a fixed **$1** product, and set
  `DODO_PAYMENTS_PRICING_MODE=quantity`. The server then sends
  `quantity = dollars`.

Copy the product id into `DODO_PAYMENTS_PRODUCT_ID`.

**2. Create an API key.** Dashboard → Developer → API Keys →
`DODO_PAYMENTS_API_KEY`.

**3. Create the webhook endpoint.** Dashboard → Developer → Webhooks → add:

```
https://playlistbid.vercel.app/api/webhooks/dodo
```

Subscribe it to these events. The first is what moves the tape, the next three
keep the buyer's receipt honest, and the last three take a song back off when the
money goes back — without them a refunded buyer keeps their slot:

```
payment.succeeded
payment.failed
payment.cancelled
payment.processing
refund.succeeded
dispute.lost
dispute.accepted
```

Copy that endpoint's signing secret (`whsec_…`) into
`DODO_PAYMENTS_WEBHOOK_KEY`.

**4. Provision Redis.** Create an Upstash Redis database (or a Vercel KV store)
and set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

**5. Add every variable to Vercel.** Project → Settings → Environment
Variables. A local `.env.local` is not deployed.

## Webhooks in local development

`localhost` is not reachable from Dodo, so a tunnel is needed. With the
[Dodo CLI](https://docs.dodopayments.com):

```bash
dodo login
dodo listen --forward-to http://localhost:3000/api/webhooks/dodo
```

Or with any tunnel — for example:

```bash
npx localtunnel --port 3000
```

Then register the tunnel's HTTPS URL plus `/api/webhooks/dodo` as a **separate**
test-mode webhook endpoint in the dashboard, and put *that* endpoint's signing
secret in `.env.local`. Each endpoint has its own secret; the production one
will not verify tunnelled deliveries.

Two things to know while testing locally:

- Without Redis the tape lives in process memory. It survives hot reloads but
  not a restart, and the paddle refuses to open a checkout at all — so set the
  Upstash variables in `.env.local` if you want to run a payment end to end.
- The webhook rejects deliveries whose timestamp is outside Dodo's tolerance, so
  a replayed body captured earlier will not verify.

## Security notes

Every value arriving from a browser is treated as untrusted.

- The client cannot set the price. `amount` in a request body is ignored; the
  server computes it from the tape it just read.
- The client cannot set the title, artist, or metadata. The server reads the
  song from Spotify and writes the Dodo metadata itself.
- The client cannot claim success. `{"paid": true}` or `{"status":"SUCCESS"}` in
  any request body changes nothing; only a verified webhook does.
- An invalid, unsigned, wrongly-keyed, or stale signature is rejected with `401`
  and the tape is untouched.
- The public tape carries no buyer, no owner token, no transaction id, and no
  Dodo payment or checkout id.
- Errors returned to the browser are generic — e.g.
  `{"error": "Unable to start payment. Please try again."}`. Provider messages,
  trace ids, and stack traces are logged server-side only.

Each of these is covered by a test in [`tests/`](tests).




