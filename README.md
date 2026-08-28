# PlaylistBid

Competitive Spotify song billboard. Paste a track link, bid for rank, and put your favorite song in front of everyone.

Payments are powered by [Dodo Payments](https://dodopayments.com).

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Dodo Payments setup

1. Create a product in the Dodo dashboard.
   - **Recommended:** one-time **Pay What You Want** product (we send `amount = bid * 100` cents).
   - **Alternative:** a fixed **$1** product and set `DODO_PAYMENTS_PRICING_MODE=quantity` (quantity = bid dollars).
2. Copy into `.env.local`:
   - `DODO_PAYMENTS_API_KEY`
   - `DODO_PAYMENTS_PRODUCT_ID`
   - `DODO_PAYMENTS_WEBHOOK_KEY` (optional until you enable webhooks)
   - `DODO_PAYMENTS_ENVIRONMENT=test_mode`
   - `NEXT_PUBLIC_DODO_PAYMENTS_MODE=test`
   - `DODO_PAYMENTS_RETURN_URL=http://localhost:3000/success`
3. Point a Dodo webhook to `https://your-domain/api/webhooks/dodo` for `payment.succeeded`.
4. On Vercel, add the same env vars (use your production URL for `DODO_PAYMENTS_RETURN_URL`).

Without API keys, the board stays in **demo mode** (local bids, no charge).

## Scripts

```bash
npm run dev
npm run build
npm run start
```
