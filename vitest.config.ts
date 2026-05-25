import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // `server-only` exists as a Next.js bundler convention; outside Next
      // it has no resolvable runtime. Point it at an empty stub so unit
      // tests for server-only modules can import normally. See
      // tests/__mocks__/server-only.ts for context.
      "server-only": path.resolve(root, "tests/__mocks__/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    reporters: "default",
  },
});
