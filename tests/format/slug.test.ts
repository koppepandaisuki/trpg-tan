import { describe, it, expect } from "vitest";
import { slugify, randomToken } from "@/lib/format/slug";

describe("slugify", () => {
  it("lowercases ASCII titles", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("collapses whitespace and underscores into single hyphens", () => {
    expect(slugify("Hello   World __ Test")).toBe("hello-world-test");
  });

  it("drops non-[a-z0-9-] characters", () => {
    expect(slugify("Hello! World?")).toBe("hello-world");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("---hello---")).toBe("hello");
  });

  it("falls back to a random token when only Japanese characters are present", () => {
    const out = slugify("黄昏のアーカイブ");
    expect(out).toMatch(/^[0-9a-f]{8}$/);
  });

  it("falls back to a random token for empty / whitespace strings", () => {
    expect(slugify("")).toMatch(/^[0-9a-f]{8}$/);
    expect(slugify("   ")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("caps length at 60 characters and trims trailing hyphens after cut", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });

  it("preserves the ASCII prefix when title mixes Japanese and English", () => {
    expect(slugify("Modern Horror モダンホラー")).toBe("modern-horror");
  });

  it("handles non-string input by returning a random token", () => {
    // @ts-expect-error testing runtime safety against bad input
    expect(slugify(123)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("randomToken", () => {
  it("returns an 8-char hex token", () => {
    expect(randomToken()).toMatch(/^[0-9a-f]{8}$/);
  });

  it("returns unique values across calls", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
  });
});
