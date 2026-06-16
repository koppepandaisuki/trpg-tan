import { describe, it, expect } from "vitest";
import {
  buildModerationInput,
  parseModerationResponse,
} from "@/lib/moderation/ai-screen";
import {
  isAiVerdict,
  aiVerdictBadgeVariant,
  aiVerdictPriority,
} from "@/lib/moderation/verdict";

describe("buildModerationInput", () => {
  it("includes title, tags and description", () => {
    const out = buildModerationInput({
      title: "深淵のシナリオ",
      description: "クトゥルフ神話TRPG向け",
      tags: ["CoC", "ホラー"],
    });
    expect(out).toContain("深淵のシナリオ");
    expect(out).toContain("CoC, ホラー");
    expect(out).toContain("クトゥルフ神話TRPG向け");
  });

  it("shows placeholders for empty fields", () => {
    const out = buildModerationInput({ title: "", description: "", tags: [] });
    expect(out).toContain("(空)");
    expect(out).toContain("(なし)");
  });
});

describe("parseModerationResponse", () => {
  it("parses a clean JSON verdict", () => {
    const r = parseModerationResponse('{"verdict":"allow","reason":"TRPG素材"}');
    expect(r.verdict).toBe("allow");
    expect(r.reason).toBe("TRPG素材");
  });

  it("extracts JSON even with surrounding prose / code fences", () => {
    const text = 'はい。\n```json\n{"verdict":"flag","reason":"情報不足"}\n```\n以上';
    const r = parseModerationResponse(text);
    expect(r.verdict).toBe("flag");
    expect(r.reason).toBe("情報不足");
  });

  it("passes through block", () => {
    expect(parseModerationResponse('{"verdict":"block","reason":"無関係"}').verdict).toBe(
      "block",
    );
  });

  it("returns error for non-JSON", () => {
    expect(parseModerationResponse("わかりません").verdict).toBe("error");
  });

  it("returns error for an invalid verdict value", () => {
    expect(parseModerationResponse('{"verdict":"maybe","reason":"x"}').verdict).toBe(
      "error",
    );
  });

  it("rejects skipped/error coming from the model itself", () => {
    expect(parseModerationResponse('{"verdict":"skipped"}').verdict).toBe("error");
  });

  it("truncates an overly long reason", () => {
    const long = "あ".repeat(500);
    const r = parseModerationResponse(`{"verdict":"allow","reason":"${long}"}`);
    expect(r.verdict).toBe("allow");
    expect(r.reason.length).toBeLessThanOrEqual(280);
  });

  it("tolerates a missing reason", () => {
    const r = parseModerationResponse('{"verdict":"allow"}');
    expect(r.verdict).toBe("allow");
    expect(r.reason).toBe("");
  });
});

describe("verdict helpers", () => {
  it("isAiVerdict guards values", () => {
    expect(isAiVerdict("allow")).toBe(true);
    expect(isAiVerdict("nope")).toBe(false);
    expect(isAiVerdict(null)).toBe(false);
  });

  it("maps verdicts to badge variants", () => {
    expect(aiVerdictBadgeVariant("allow")).toBe("category");
    expect(aiVerdictBadgeVariant("flag")).toBe("warning");
    expect(aiVerdictBadgeVariant("block")).toBe("default");
    expect(aiVerdictBadgeVariant("skipped")).toBe("muted");
  });

  it("prioritizes block > flag > error > others", () => {
    expect(aiVerdictPriority("block")).toBeGreaterThan(aiVerdictPriority("flag"));
    expect(aiVerdictPriority("flag")).toBeGreaterThan(aiVerdictPriority("error"));
    expect(aiVerdictPriority("error")).toBeGreaterThan(aiVerdictPriority("allow"));
    expect(aiVerdictPriority("allow")).toBe(0);
    expect(aiVerdictPriority("skipped")).toBe(0);
  });
});
