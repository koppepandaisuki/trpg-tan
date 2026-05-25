#!/usr/bin/env node
/**
 * Build-output secret check.
 *
 * Run AFTER `pnpm build`. Walks `.next/static/` (the client-shipped bundle)
 * and fails if any of the FORBIDDEN_TOKENS show up. This catches the case
 * where a server-only env var name (or its value) accidentally got inlined
 * into a client chunk — for example, via a missing `import "server-only"`.
 *
 * Note: env var NAMES alone are usually fine if the value isn't there.
 * But seeing the NAME in a client bundle is itself a signal something
 * unwanted got bundled, so we flag it.
 *
 * Usage:
 *   pnpm build           # ensures .next/static exists
 *   pnpm check:secrets   # this script
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_DIR = path.join(ROOT, ".next/static");

// Substrings that must NEVER appear in client-shipped output.
const FORBIDDEN_TOKENS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

// File extensions we actually need to scan. Maps, json sourcemaps, etc.
// are skipped to keep runtime fast; sourcemaps can leak too but we don't
// ship them in production by default.
const SCAN_EXTS = new Set([".js", ".mjs", ".css", ".html"]);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && SCAN_EXTS.has(path.extname(entry.name))) yield full;
  }
}

if (!(await exists(STATIC_DIR))) {
  console.error(
    `[check-no-secrets] ${path.relative(ROOT, STATIC_DIR)} not found.\n` +
      "Run `pnpm build` first.",
  );
  process.exit(1);
}

let scanned = 0;
const hits = [];

for await (const file of walk(STATIC_DIR)) {
  scanned++;
  const source = await readFile(file, "utf8");
  for (const token of FORBIDDEN_TOKENS) {
    if (source.includes(token)) {
      hits.push({ file: path.relative(ROOT, file), token });
    }
  }
}

if (hits.length > 0) {
  console.error("\nSecret-leak check failed.\n");
  for (const hit of hits) {
    console.error(`  - "${hit.token}" found in ${hit.file}`);
  }
  console.error(
    "\nHow to fix:\n" +
      "  1. Find the source file that references the env var.\n" +
      "  2. Make sure it has `import \"server-only\";` at the top.\n" +
      "  3. Make sure no client component imports that file.\n" +
      "  4. Re-run `pnpm build && pnpm check:secrets`.\n",
  );
  process.exit(1);
}

console.log(
  `[check-no-secrets] passed (${scanned} files scanned under .next/static)`,
);
