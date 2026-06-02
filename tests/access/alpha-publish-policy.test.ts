import { describe, it, expect } from "vitest";
import {
  isAlphaAllowFreeWithoutConnectEnabled,
  decidePublishGate,
} from "@/lib/access/alpha-publish-policy";

describe("isAlphaAllowFreeWithoutConnectEnabled", () => {
  it("returns true only for the exact string 'true'", () => {
    expect(isAlphaAllowFreeWithoutConnectEnabled("true")).toBe(true);
  });

  it("rejects 'TRUE' (case-sensitive, defensive)", () => {
    expect(isAlphaAllowFreeWithoutConnectEnabled("TRUE")).toBe(false);
  });

  it("rejects truthy-ish values: '1', 'yes', 'on'", () => {
    expect(isAlphaAllowFreeWithoutConnectEnabled("1")).toBe(false);
    expect(isAlphaAllowFreeWithoutConnectEnabled("yes")).toBe(false);
    expect(isAlphaAllowFreeWithoutConnectEnabled("on")).toBe(false);
  });

  it("rejects empty / undefined / falsy variants", () => {
    expect(isAlphaAllowFreeWithoutConnectEnabled(undefined)).toBe(false);
    expect(isAlphaAllowFreeWithoutConnectEnabled("")).toBe(false);
    expect(isAlphaAllowFreeWithoutConnectEnabled("false")).toBe(false);
    expect(isAlphaAllowFreeWithoutConnectEnabled("0")).toBe(false);
  });
});

describe("decidePublishGate", () => {
  it("allows when Connect is completed (paid product)", () => {
    expect(
      decidePublishGate({
        stripeChargesEnabled: true,
        priceJpy: 1500,
        alphaAllowFreeWithoutConnect: false,
      }),
    ).toEqual({ allowed: true, reason: "connect_completed" });
  });

  it("allows when Connect is completed (free product)", () => {
    expect(
      decidePublishGate({
        stripeChargesEnabled: true,
        priceJpy: 0,
        alphaAllowFreeWithoutConnect: false,
      }),
    ).toEqual({ allowed: true, reason: "connect_completed" });
  });

  it("allows free product when Connect is not completed but alpha flag is on", () => {
    expect(
      decidePublishGate({
        stripeChargesEnabled: false,
        priceJpy: 0,
        alphaAllowFreeWithoutConnect: true,
      }),
    ).toEqual({ allowed: true, reason: "alpha_free_exception" });
  });

  it("blocks paid product when Connect not completed (alpha flag on, hint at lowering price)", () => {
    expect(
      decidePublishGate({
        stripeChargesEnabled: false,
        priceJpy: 1500,
        alphaAllowFreeWithoutConnect: true,
      }),
    ).toEqual({ allowed: false, reason: "connect_required_for_paid" });
  });

  it("blocks any product when Connect not completed and alpha flag is off (D-020 default)", () => {
    expect(
      decidePublishGate({
        stripeChargesEnabled: false,
        priceJpy: 0,
        alphaAllowFreeWithoutConnect: false,
      }),
    ).toEqual({ allowed: false, reason: "connect_required" });

    expect(
      decidePublishGate({
        stripeChargesEnabled: false,
        priceJpy: 1500,
        alphaAllowFreeWithoutConnect: false,
      }),
    ).toEqual({ allowed: false, reason: "connect_required" });
  });
});
