#!/usr/bin/env node
/**
 * Static check (runs as `prebuild`).
 *
 * Two rules:
 *   1. Files listed in REQUIRE_SERVER_ONLY must start with
 *      `import "server-only";` (within the first 8 non-empty non-comment lines).
 *   2. Files beginning with the `"use client"` directive must not import
 *      from any of the SERVER_ONLY_MODULE_PREFIXES.
 *
 * Designed to fail loudly with actionable messages, never with generic
 * "static check failed". When this script complains, the fix is mechanical.
 *
 * Limitations:
 *   - Imports via dynamic `import()` or string concatenation are not scanned.
 *   - Re-exports through index files are not followed transitively.
 *   - Comments inside import paths are not handled.
 * For MVP we accept these as low-risk and re-run the build-time
 * `check:secrets` script as a backstop.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRE_SERVER_ONLY = [
  "lib/supabase/admin.ts",
  "lib/supabase/server.ts",
  "lib/stripe/client.ts",
  "lib/stripe/webhook.ts",
  "lib/storage/signed-url.ts",
  "lib/format/storage.ts",
  "lib/access/library-access.ts",
  "lib/access/purchase-access.ts",
  "lib/access/upload-access.ts",
  "lib/storage/signed-upload-url.ts",
  "lib/mutations/purchases.ts",
  "lib/mutations/creator-products.ts",
  "lib/mutations/admin.ts",
  "lib/mutations/product-paths.ts",
  "lib/queries/products.ts",
  "lib/queries/creator-products.ts",
  "lib/queries/library.ts",
  "lib/queries/admin.ts",
  "lib/session/get-user.ts",
  "lib/session/require.ts",
  "lib/api/origin.ts",
];

// Anything matching these prefixes is a server-only module surface area.
// A client component must NOT import from these.
const SERVER_ONLY_MODULE_PREFIXES = [
  "@/lib/supabase/admin",
  "@/lib/supabase/server",
  "@/lib/stripe/client",
  "@/lib/stripe/webhook",
  "@/lib/storage/signed-url",
  "@/lib/format/storage",
  "@/lib/access/library-access",
  "@/lib/access/purchase-access",
  "@/lib/access/upload-access",
  "@/lib/storage/signed-upload-url",
  "@/lib/mutations/purchases",
  "@/lib/mutations/creator-products",
  "@/lib/mutations/admin",
  "@/lib/mutations/product-paths",
  "@/lib/queries/products",
  "@/lib/queries/creator-products",
  "@/lib/queries/library",
  "@/lib/queries/admin",
  "@/lib/session/get-user",
  "@/lib/session/require",
  "@/lib/api/origin",
];

// Directories to scan for client components.
const CLIENT_SCAN_DIRS = ["app", "components"];

const SCAN_EXTS = new Set([".ts", ".tsx"]);

const failures = [];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      yield* walk(full);
    } else if (entry.isFile() && SCAN_EXTS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

function startsWithUseClient(source) {
  // Skip blank lines and line comments at the top.
  const lines = source.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("//")) continue;
    if (line.startsWith("/*")) continue;
    return line.startsWith('"use client"') || line.startsWith("'use client'");
  }
  return false;
}

function hasServerOnlyImport(source) {
  // Look within the first ~600 chars; server-only should be at the top.
  const head = source.slice(0, 600);
  return /\bimport\s+["']server-only["']\s*;?/.test(head);
}

function extractImportSources(source) {
  // Match `import ... from "..."` and `import "..."`.
  // Exclude type-only imports (`import type { X } from "..."`): they are
  // erased at compile time and cannot leak runtime code. Mixed imports
  // like `import { type X, Y } from "..."` are still flagged because the
  // value `Y` is a real runtime import.
  const sources = [];
  const re = /\bimport\s+(type\s+)?(?:[^"']*?from\s+)?["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    if (m[1]) continue; // type-only import
    sources.push(m[2]);
  }
  return sources;
}

function isServerOnlyImport(spec) {
  return SERVER_ONLY_MODULE_PREFIXES.some(
    (prefix) => spec === prefix || spec.startsWith(`${prefix}/`),
  );
}

// --- Rule 1: required `import "server-only"` ---
for (const rel of REQUIRE_SERVER_ONLY) {
  const abs = path.join(ROOT, rel);
  if (!(await exists(abs))) {
    failures.push(`[missing-file] ${rel} does not exist`);
    continue;
  }
  const source = await readFile(abs, "utf8");
  if (!hasServerOnlyImport(source)) {
    failures.push(
      `[missing-server-only] ${rel} is on the server-only list but does not import "server-only" at the top`,
    );
  }
}

// --- Rule 2: client components must not import server-only modules ---
for (const dir of CLIENT_SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!(await exists(abs))) continue;
  for await (const file of walk(abs)) {
    const source = await readFile(file, "utf8");
    if (!startsWithUseClient(source)) continue;

    const imports = extractImportSources(source);
    for (const spec of imports) {
      if (isServerOnlyImport(spec)) {
        const rel = path.relative(ROOT, file).replace(/\\/g, "/");
        failures.push(
          `[client-imports-server-only] ${rel} (use client) imports "${spec}" which is server-only`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error("\nServer-only static check failed.\n");
  for (const f of failures) console.error("  -", f);
  console.error("\nHow to fix:");
  console.error("  1. Add `import \"server-only\";` to the top of the listed module(s).");
  console.error("  2. Stop importing those modules from any file that starts with `\"use client\"`.");
  console.error("  3. If a client component needs server data, move the data fetch into a");
  console.error("     parent Server Component and pass the result down as props.\n");
  process.exit(1);
}

console.log("[check-server-only] passed");
