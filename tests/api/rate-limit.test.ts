import { describe, it, expect } from "vitest";
import {
  RATE_LIMITS,
  tooManyRequestsResponse,
} from "@/lib/api/rate-limit";

describe("RATE_LIMITS config", () => {
  it("every rule has a positive limit and window (limit=0 would block all traffic)", () => {
    for (const [name, rule] of Object.entries(RATE_LIMITS)) {
      expect(rule.limit, `${name}.limit`).toBeGreaterThanOrEqual(1);
      expect(rule.windowSeconds, `${name}.windowSeconds`).toBeGreaterThanOrEqual(
        1,
      );
      expect(Number.isInteger(rule.limit), `${name}.limit int`).toBe(true);
      expect(
        Number.isInteger(rule.windowSeconds),
        `${name}.windowSeconds int`,
      ).toBe(true);
    }
  });

  it("covers the sensitive routes", () => {
    expect(Object.keys(RATE_LIMITS).sort()).toEqual(
      [
        "ai",
        "feedback",
        "goldCheckout",
        "purchaseGold",
        "redeem",
        "tips",
      ].sort(),
    );
  });
});

describe("tooManyRequestsResponse", () => {
  it("returns a 429 with a rate_limited reason", async () => {
    const res = tooManyRequestsResponse();
    expect(res.status).toBe(429);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("rate_limited");
  });
});
