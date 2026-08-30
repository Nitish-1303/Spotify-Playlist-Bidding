import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The suite covers the payment and tape rules, which are plain server-side
 * TypeScript — no DOM, no React. Redis is left unconfigured on purpose so the
 * store runs on its in-memory fallback and each test gets a clean tape.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
  },
});
