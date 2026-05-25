import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/api/origin";

function fakeRequest(opts: {
  method: string;
  origin?: string;
}): NextRequest {
  const headers = new Headers();
  if (opts.origin !== undefined) headers.set("origin", opts.origin);
  return {
    method: opts.method,
    headers,
  } as unknown as NextRequest;
}

describe("isSameOriginRequest", () => {
  const originalSite = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSite;
  });

  it("allows GET / HEAD / OPTIONS without checking origin", () => {
    expect(isSameOriginRequest(fakeRequest({ method: "GET" }))).toBe(true);
    expect(isSameOriginRequest(fakeRequest({ method: "HEAD" }))).toBe(true);
    expect(isSameOriginRequest(fakeRequest({ method: "OPTIONS" }))).toBe(true);
  });

  it("rejects POST without an Origin header", () => {
    expect(isSameOriginRequest(fakeRequest({ method: "POST" }))).toBe(false);
  });

  it("accepts POST when Origin matches NEXT_PUBLIC_SITE_URL", () => {
    expect(
      isSameOriginRequest(
        fakeRequest({ method: "POST", origin: "http://localhost:3000" }),
      ),
    ).toBe(true);
  });

  it("rejects POST when Origin is a different scheme/host", () => {
    expect(
      isSameOriginRequest(
        fakeRequest({ method: "POST", origin: "http://evil.example" }),
      ),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        fakeRequest({ method: "POST", origin: "https://localhost:3000" }),
      ),
    ).toBe(false);
  });

  it("rejects POST when Origin is malformed", () => {
    expect(
      isSameOriginRequest(fakeRequest({ method: "POST", origin: "not a url" })),
    ).toBe(false);
  });

  it("fails closed when NEXT_PUBLIC_SITE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(
      isSameOriginRequest(
        fakeRequest({ method: "POST", origin: "http://localhost:3000" }),
      ),
    ).toBe(false);
  });
});
