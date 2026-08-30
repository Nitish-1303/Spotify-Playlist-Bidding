/**
 * Dodo's Next.js adapter re-exports part of Next's compiled server bundle,
 * which was built for CommonJS and touches `__dirname` and `__filename` while
 * it is still evaluating. Vitest loads it as ESM, where neither identifier
 * exists, so importing the webhook route would throw before a single assertion
 * ran. Defining them here lets the real adapter — standard-webhooks signature
 * verification and all — run under test rather than being mocked away.
 */
const g = globalThis as Record<string, unknown>;

g.__dirname ??= process.cwd();
g.__filename ??= `${process.cwd()}/vitest.js`;
