import { describe, it, expect } from "vitest";
import {
  formatAnomalyDigest,
  type AnomalyReport,
} from "@/lib/security/anomaly";

const base: AnomalyReport = {
  hours: 24,
  gold_by_kind: [
    { kind: "ai_usage", cnt: 40, total: 80 },
    { kind: "purchase", cnt: 10, total: 5000 },
  ],
  redeems_total: 3,
  top_codes: [],
  flags: [],
};

describe("formatAnomalyDigest", () => {
  it("uses a ✅ headline and omits the flag block when there are no flags", () => {
    const out = formatAnomalyDigest(base);
    expect(out).toContain("✅");
    expect(out).toContain("異常なし");
    expect(out).toContain("AI利用 40件/80G");
    expect(out).toContain("リデーム: 3 件");
  });

  it("uses a ⚠️ headline and lists each flag when flags exist", () => {
    const out = formatAnomalyDigest({
      ...base,
      flags: [
        { type: "heavy_ai", user_id: "abcdef12-3456-7890-aaaa-bbbbbbbbbbbb", cnt: 150 },
        { type: "code_leak", code: "FREEGOLD", users: 42 },
      ],
    });
    expect(out).toContain("⚠️");
    expect(out).toContain("要確認 2 件");
    expect(out).toContain("AI連打: abcdef12… が 150 回");
    expect(out).toContain("コード漏洩疑い: 「FREEGOLD」を 42 人");
  });

  it("renders tip concentration and bulk purchase flags", () => {
    const out = formatAnomalyDigest({
      ...base,
      flags: [
        { type: "tip_concentration", user_id: "11111111-2222-3333-4444-555555555555", total: 30000 },
        { type: "bulk_purchase", user_id: "99999999-8888-7777-6666-555555555555", cnt: 25 },
      ],
    });
    expect(out).toContain("30,000G 受取");
    expect(out).toContain("25 件");
  });

  it("caps output length for Discord's limit", () => {
    const many: AnomalyReport = {
      ...base,
      flags: Array.from({ length: 200 }, (_, i) => ({
        type: "heavy_ai" as const,
        user_id: `user${i}-0000-0000-0000-000000000000`,
        cnt: 100 + i,
      })),
    };
    expect(formatAnomalyDigest(many).length).toBeLessThanOrEqual(1900);
  });
});
