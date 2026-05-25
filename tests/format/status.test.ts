import { describe, it, expect } from "vitest";
import { statusLabel, statusBadgeVariant } from "@/lib/format/status";

describe("statusLabel", () => {
  it("returns Japanese labels", () => {
    expect(statusLabel("draft")).toBe("下書き");
    expect(statusLabel("published")).toBe("公開中");
    expect(statusLabel("suspended")).toBe("停止中");
  });
});

describe("statusBadgeVariant", () => {
  it("maps each status to a stable variant", () => {
    expect(statusBadgeVariant("published")).toBe("category");
    expect(statusBadgeVariant("suspended")).toBe("default");
    expect(statusBadgeVariant("draft")).toBe("muted");
  });
});
