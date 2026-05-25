import { describe, it, expect } from "vitest";
import {
  safeNext,
  sanitizeInternalPath,
  sanitizeSlug,
} from "@/lib/api/redirect";

describe("safeNext", () => {
  it("returns / for null / undefined / empty", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  it("rejects paths that do not start with /", () => {
    expect(safeNext("http://evil.example")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("foo")).toBe("/");
  });

  it("rejects protocol-relative URLs (//host)", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("//evil.example/path")).toBe("/");
  });

  it("passes through legitimate internal paths", () => {
    expect(safeNext("/library")).toBe("/library");
    expect(safeNext("/creator/products/new")).toBe("/creator/products/new");
  });
});

describe("sanitizeInternalPath", () => {
  it("falls back to the provided default", () => {
    expect(sanitizeInternalPath(null, "/library")).toBe("/library");
    expect(sanitizeInternalPath("//bad", "/library")).toBe("/library");
  });

  it("returns the path when it is safe", () => {
    expect(sanitizeInternalPath("/store", "/library")).toBe("/store");
  });
});

describe("sanitizeSlug", () => {
  it("returns empty for null / undefined / empty / non-string", () => {
    expect(sanitizeSlug(null)).toBe("");
    expect(sanitizeSlug(undefined)).toBe("");
    expect(sanitizeSlug("")).toBe("");
  });

  it("rejects slugs longer than 80 characters", () => {
    expect(sanitizeSlug("a".repeat(81))).toBe("");
  });

  it("rejects slugs containing disallowed characters", () => {
    expect(sanitizeSlug("../etc/passwd")).toBe("");
    expect(sanitizeSlug("hello world")).toBe("");
    expect(sanitizeSlug("hello?next=1")).toBe("");
    expect(sanitizeSlug("日本語")).toBe("");
  });

  it("accepts well-formed slugs", () => {
    expect(sanitizeSlug("twilight-archive")).toBe("twilight-archive");
    expect(sanitizeSlug("abc123")).toBe("abc123");
    expect(sanitizeSlug("MixedCase-OK")).toBe("MixedCase-OK");
  });
});
