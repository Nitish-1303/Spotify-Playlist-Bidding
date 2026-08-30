# PlaylistBid

Competitive song billboard built around Spotify track links. Paste a track link,
pay for a position on the tape, and your song moves there once the payment is
confirmed.

PlaylistBid is an independent fan project. It is **not affiliated with, endorsed
by, sponsored by, or connected to Spotify AB**, and Spotify is a trademark of
Spotify AB. The site uses Spotify track links, Spotify's public oEmbed metadata
and Spotify's official embedded player, and nothing more. Track positions exist
only on PlaylistBid and do not change Spotify playlists, charts, rankings, or
streams. That statement is carried in the UI in four places — the strip under
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
3. The server reads the song's real title and artist from Spotify's oEmbed
   endpoint, so a crafted request cannot label a slot however it likes.
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

A transaction never walks backwards out of `SUCCESS`: a late `payment.failed`
for a payment that already settled is recorded as already-final and ignored.

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
| `UPSTASH_REDIS_REST_URL` | in production | Also accepted as `KV_REST_API_URL`. |
| `UPSTASH_REDIS_REST_TOKEN` | in production | Also accepted as `KV_REST_API_TOKEN`. |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical URLs and sitemap. |

Without Redis the tape falls back to process memory. That is fine for
`npm run dev`, but on serverless it is per-instance and resets on redeploy, so
the site reports itself as not durable and the paddle refuses to take money.

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

Subscribe it to these four events — the first is what moves the tape, the other
three keep the buyer's receipt honest:

```
payment.succeeded
payment.failed
payment.cancelled
payment.processing
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




