/**
 * Test-only stub for the `server-only` package.
 *
 * In production, `import "server-only"` is a Next.js convention that
 * throws when a module is accidentally bundled for the client. Vitest
 * runs in Node and doesn't go through the Next.js bundler, so the real
 * package can't be resolved and unit tests for server-only modules
 * (e.g. lib/api/origin.ts) fail to load.
 *
 * We alias `server-only` to this empty module in vitest.config.ts so the
 * import is a no-op during tests. Production behavior is unchanged.
 */
export {};
