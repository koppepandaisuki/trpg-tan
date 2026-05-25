import { describe, it, expect } from "vitest";
import {
  draftSchema,
  publishSchema,
  normalizeTag,
  TAG_MAX_LENGTH,
  TAGS_MAX_COUNT,
} from "@/lib/validators/product";

const BASE = {
  title: "黄昏のアーカイブ",
  description: "サンプル説明",
  productType: "scenario" as const,
  fileFormat: "pdf" as const,
  priceJpy: 1500,
  systemLabel: "",
  players: "",
  playtime: "",
  recommendedSkills: "",
  allowCommercial: false,
  allowRedistribution: false,
  tags: ["coc"],
};

describe("normalizeTag", () => {
  it("trims and lowercases", () => {
    expect(normalizeTag("  Horror  ")).toBe("horror");
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag("   ")).toBeNull();
  });

  it("returns null when the tag exceeds the max length", () => {
    expect(normalizeTag("x".repeat(TAG_MAX_LENGTH + 1))).toBeNull();
  });

  it("accepts non-ASCII characters in lowercase form", () => {
    expect(normalizeTag("ホラー")).toBe("ホラー");
  });
});

describe("draftSchema", () => {
  it("accepts the minimal payload (title + priceJpy)", () => {
    const result = draftSchema.safeParse({
      ...BASE,
      description: "",
      tags: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(draftSchema.safeParse({ ...BASE, title: "" }).success).toBe(false);
  });

  it("rejects a title longer than 100 characters", () => {
    expect(
      draftSchema.safeParse({ ...BASE, title: "x".repeat(101) }).success,
    ).toBe(false);
  });

  it("rejects negative price", () => {
    expect(draftSchema.safeParse({ ...BASE, priceJpy: -1 }).success).toBe(false);
  });

  it("rejects price above 10,000,000", () => {
    expect(
      draftSchema.safeParse({ ...BASE, priceJpy: 10_000_001 }).success,
    ).toBe(false);
  });

  it("rejects unknown productType", () => {
    // zod's safeParse accepts `unknown`, so a bad enum value is a runtime
    // concern only — there is no compile-time error to suppress here.
    expect(
      draftSchema.safeParse({ ...BASE, productType: "podcast" }).success,
    ).toBe(false);
  });

  it("rejects unknown fileFormat", () => {
    expect(
      draftSchema.safeParse({ ...BASE, fileFormat: "epub" }).success,
    ).toBe(false);
  });

  it("rejects tags exceeding the count limit", () => {
    const tooMany = Array.from({ length: TAGS_MAX_COUNT + 1 }, (_, i) => `tag${i}`);
    expect(draftSchema.safeParse({ ...BASE, tags: tooMany }).success).toBe(false);
  });
});

describe("publishSchema", () => {
  it("accepts a fully-filled payload", () => {
    expect(publishSchema.safeParse(BASE).success).toBe(true);
  });

  it("requires description (non-empty after trim)", () => {
    expect(
      publishSchema.safeParse({ ...BASE, description: "" }).success,
    ).toBe(false);
    expect(
      publishSchema.safeParse({ ...BASE, description: "   " }).success,
    ).toBe(false);
  });

  it("requires at least one tag", () => {
    expect(publishSchema.safeParse({ ...BASE, tags: [] }).success).toBe(false);
  });

  it("accepts the boundary case of exactly one tag", () => {
    expect(publishSchema.safeParse({ ...BASE, tags: ["coc"] }).success).toBe(true);
  });
});
