import { describe, it, expect } from "vitest";
import {
  parseAlphaCreatorEmails,
  isAlphaCreatorEmail,
} from "@/lib/access/alpha-whitelist";

describe("parseAlphaCreatorEmails", () => {
  it("returns empty set for undefined env", () => {
    expect(parseAlphaCreatorEmails(undefined).size).toBe(0);
  });

  it("returns empty set for empty string", () => {
    expect(parseAlphaCreatorEmails("").size).toBe(0);
  });

  it("parses a single email", () => {
    const set = parseAlphaCreatorEmails("a@example.com");
    expect(set.size).toBe(1);
    expect(set.has("a@example.com")).toBe(true);
  });

  it("parses multiple comma-separated emails", () => {
    const set = parseAlphaCreatorEmails("a@example.com,b@example.com,c@example.com");
    expect(set.size).toBe(3);
    expect(set.has("a@example.com")).toBe(true);
    expect(set.has("c@example.com")).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const set = parseAlphaCreatorEmails(" a@example.com , b@example.com ");
    expect(set.size).toBe(2);
    expect(set.has("a@example.com")).toBe(true);
    expect(set.has("b@example.com")).toBe(true);
  });

  it("lowercases addresses", () => {
    const set = parseAlphaCreatorEmails("USER@Example.COM");
    expect(set.size).toBe(1);
    expect(set.has("user@example.com")).toBe(true);
  });

  it("ignores empty entries from sloppy commas", () => {
    const set = parseAlphaCreatorEmails(",,a@example.com,,,b@example.com,");
    expect(set.size).toBe(2);
  });
});

describe("isAlphaCreatorEmail", () => {
  it("matches case-insensitively (lookup side)", () => {
    expect(isAlphaCreatorEmail("Test@Example.COM", "test@example.com")).toBe(true);
  });

  it("matches case-insensitively (env side)", () => {
    expect(isAlphaCreatorEmail("test@example.com", "TEST@EXAMPLE.COM")).toBe(true);
  });

  it("trims surrounding whitespace on lookup", () => {
    expect(isAlphaCreatorEmail("  a@example.com  ", "a@example.com")).toBe(true);
  });

  it("matches when email is in the list", () => {
    expect(
      isAlphaCreatorEmail("a@example.com", "a@example.com,b@example.com"),
    ).toBe(true);
  });

  it("rejects when email is not in the list", () => {
    expect(
      isAlphaCreatorEmail("c@example.com", "a@example.com,b@example.com"),
    ).toBe(false);
  });

  it("rejects when env is undefined (feature disabled)", () => {
    expect(isAlphaCreatorEmail("a@example.com", undefined)).toBe(false);
  });

  it("rejects when env is empty string (feature disabled)", () => {
    expect(isAlphaCreatorEmail("a@example.com", "")).toBe(false);
  });

  it("rejects empty email even when in whitelist", () => {
    expect(isAlphaCreatorEmail("", "a@example.com")).toBe(false);
  });
});
