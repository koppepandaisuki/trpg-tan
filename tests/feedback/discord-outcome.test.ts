import { describe, it, expect } from "vitest";
import {
  decideFeedbackOutcome,
  type FeedbackContext,
} from "@/lib/feedback/discord";
import type { FeedbackInput } from "@/lib/validators/feedback";

const FIXED_NOW = new Date("2026-06-02T10:00:00.000Z");
const fakeContext: FeedbackContext = {
  userId: "user-uuid-1",
  email: "tester@example.com",
  displayName: "テスター",
  now: FIXED_NOW,
};

function fakeInput(overrides: Partial<FeedbackInput> = {}): FeedbackInput {
  return {
    category: "bug",
    body: "ライブラリで該当作品が表示されない。テストカードで購入完走しているが反映されない",
    pageUrl: "https://trpg-tan.vercel.app/library",
    ...overrides,
  };
}

describe("decideFeedbackOutcome", () => {
  it("sends a Discord payload when webhook URL is configured", () => {
    const out = decideFeedbackOutcome(
      fakeInput(),
      fakeContext,
      "https://discord.com/api/webhooks/123/abc",
    );

    expect(out.type).toBe("send");
    if (out.type !== "send") return;

    expect(out.payload.embeds).toHaveLength(1);
    const embed = out.payload.embeds[0];
    expect(embed.title).toContain("バグ");
    expect(embed.timestamp).toBe(FIXED_NOW.toISOString());
    expect(embed.footer.text).toContain("user-uuid-1");

    const fieldsByName = Object.fromEntries(
      embed.fields.map((f) => [f.name, f.value]),
    );
    expect(fieldsByName["ユーザー"]).toContain("テスター");
    expect(fieldsByName["ユーザー"]).toContain("tester@example.com");
    expect(fieldsByName["ページ URL"]).toBe("https://trpg-tan.vercel.app/library");
    expect(fieldsByName["本文"]).toContain("ライブラリで該当作品が表示されない");
  });

  it("skips when webhook URL is null (α 立ち上げ時の運用猶予)", () => {
    const out = decideFeedbackOutcome(fakeInput(), fakeContext, null);
    expect(out).toEqual({ type: "skip", reason: "missing_webhook_url" });
  });

  it("uses category-specific color and label", () => {
    const out = decideFeedbackOutcome(
      fakeInput({ category: "feature_request", body: "Dark mode を入れてほしい" }),
      fakeContext,
      "https://discord.com/api/webhooks/123/abc",
    );
    if (out.type !== "send") throw new Error("expected send");

    expect(out.payload.embeds[0].title).toContain("機能要望");
    // blue-500 in decimal
    expect(out.payload.embeds[0].color).toBe(0x3b82f6);
  });

  it("substitutes (不明) when pageUrl is missing", () => {
    const out = decideFeedbackOutcome(
      fakeInput({ pageUrl: undefined }),
      fakeContext,
      "https://discord.com/api/webhooks/123/abc",
    );
    if (out.type !== "send") throw new Error("expected send");

    const fieldsByName = Object.fromEntries(
      out.payload.embeds[0].fields.map((f) => [f.name, f.value]),
    );
    expect(fieldsByName["ページ URL"]).toBe("(不明)");
  });

  it("substitutes (no name) when displayName is empty", () => {
    const out = decideFeedbackOutcome(
      fakeInput(),
      { ...fakeContext, displayName: "" },
      "https://discord.com/api/webhooks/123/abc",
    );
    if (out.type !== "send") throw new Error("expected send");

    const userField = out.payload.embeds[0].fields.find(
      (f) => f.name === "ユーザー",
    );
    expect(userField?.value).toContain("(no name)");
  });

  it("truncates very long bodies (Discord embed has limits)", () => {
    const longBody = "あ".repeat(1000);
    const out = decideFeedbackOutcome(
      fakeInput({ body: longBody }),
      fakeContext,
      "https://discord.com/api/webhooks/123/abc",
    );
    if (out.type !== "send") throw new Error("expected send");

    const bodyField = out.payload.embeds[0].fields.find(
      (f) => f.name === "本文",
    );
    expect(bodyField).toBeDefined();
    expect(bodyField!.value.length).toBeLessThanOrEqual(900);
  });

  it("includes all 4 categories with distinct titles", () => {
    const categories: FeedbackInput["category"][] = [
      "bug",
      "feature_request",
      "question",
      "other",
    ];
    const titles = categories.map((category) => {
      const out = decideFeedbackOutcome(
        fakeInput({ category }),
        fakeContext,
        "https://discord.com/api/webhooks/123/abc",
      );
      if (out.type !== "send") throw new Error("expected send");
      return out.payload.embeds[0].title;
    });

    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(4);
  });
});
