import Script from "next/script";

/**
 * DataFast page analytics.
 *
 * Production deployment only. `VERCEL_ENV` is "preview" on branch builds and
 * undefined under `npm run dev`, and the tag reports whatever domain it is
 * configured with wherever it runs — so without this gate a local page load or
 * a preview URL would be counted as playlistbid.vercel.app traffic.
 *
 * The website id and the domain are public by design: they are readable in the
 * page source by anyone who looks. They sit here as literals rather than in an
 * env var so the tag cannot quietly disappear from a deploy that forgot one.
 *
 * `afterInteractive` rather than the vendor snippet's `defer`, which is what
 * next/script exists to do — the tag loads once after hydration and is not
 * re-injected on client navigations.
 */
export function DataFastAnalytics() {
  if (process.env.VERCEL_ENV !== "production") return null;

  return (
    <Script
      strategy="afterInteractive"
      src="https://datafa.st/js/script.js"
      data-website-id="dfid_KVY89deiSFdNpM15MaMIC"
      data-domain="playlistbid.vercel.app"
    />
  );
}
