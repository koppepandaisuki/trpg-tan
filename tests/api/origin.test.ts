import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/api/origin";

function fakeRequest(opts: {
  method: string;
  origin?: string;
  host?: string;
  forwardedHost?: string;
  forwardedProto?: string;
}): NextRequest {
  const headers = new Headers();
  if (opts.origin !== undefined) headers.set("origin", opts.origin);
  if (opts.host !== undefined) headers.set("host", opts.host);
  if (opts.forwardedHost !== undefined)
    headers.set("x-forwarded-host", opts.forwardedHost);
  if (opts.forwardedProto !== undefined)
    headers.set("x-forwarded-proto", opts.forwardedProto);
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

  it("fails closed when NEXT_PUBLIC_SITE_URL is unset and no host header", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(
      isSameOriginRequest(
        fakeRequest({ method: "POST", origin: "http://localhost:3000" }),
      ),
    ).toBe(false);
  });

  // ===== Host ベースの同一オリジン判定(複数本番ドメイン対応) =====

  it("accepts POST when Origin matches the request Host, even if env points elsewhere", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://re-dice.net";
    // paradaice.jp で開いているブラウザからの正当なリクエスト
    expect(
      isSameOriginRequest(
        fakeRequest({
          method: "POST",
          origin: "https://paradaice.jp",
          host: "paradaice.jp",
          forwardedProto: "https",
        }),
      ),
    ).toBe(true);
    // www 付きドメイン
    expect(
      isSameOriginRequest(
        fakeRequest({
          method: "POST",
          origin: "https://www.re-dice.net",
          host: "www.re-dice.net",
          forwardedProto: "https",
        }),
      ),
    ).toBe(true);
  });

  it("accepts POST when Origin matches X-Forwarded-Host (proxy)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://re-dice.net";
    expect(
      isSameOriginRequest(
        fakeRequest({
          method: "POST",
          origin: "https://paradaice.jp",
          host: "internal.vercel.app",
          forwardedHost: "paradaice.jp",
          forwardedProto: "https",
        }),
      ),
    ).toBe(true);
  });

  it("rejects cross-site POST even when host headers are present", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://re-dice.net";
    expect(
      isSameOriginRequest(
        fakeRequest({
          method: "POST",
          origin: "https://evil.example",
          host: "paradaice.jp",
          forwardedHost: "paradaice.jp",
          forwardedProto: "https",
        }),
      ),
    ).toBe(false);
  });

  it("rejects http Origin when the proxy says the request came in via https", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://re-dice.net";
    expect(
      isSameOriginRequest(
        fakeRequest({
          method: "POST",
          origin: "http://paradaice.jp",
          host: "paradaice.jp",
          forwardedProto: "https",
        }),
      ),
    ).toBe(false);
  });

  it("still accepts env-matching Origin when Host is an internal name", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://re-dice.net";
    expect(
      isSameOriginRequest(
        fakeRequest({
          method: "POST",
          origin: "https://re-dice.net",
          host: "internal-proxy.local",
        }),
      ),
    ).toBe(true);
  });
});
