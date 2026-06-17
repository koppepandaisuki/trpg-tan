import { describe, it, expect } from "vitest";
import {
  reviewApprovedEmail,
  reviewRejectedEmail,
  reviewSuspendedEmail,
} from "@/lib/email/templates";

describe("reviewApprovedEmail", () => {
  it("includes the title and product url", () => {
    const e = reviewApprovedEmail({
      productTitle: "深淵のシナリオ",
      productUrl: "https://example.com/store/abyss",
    });
    expect(e.subject).toContain("深淵のシナリオ");
    expect(e.subject).toContain("公開されました");
    expect(e.html).toContain("https://example.com/store/abyss");
    expect(e.text).toContain("https://example.com/store/abyss");
    expect(e.text).toContain("深淵のシナリオ");
  });

  it("falls back to (無題) for an empty title", () => {
    const e = reviewApprovedEmail({ productTitle: "", productUrl: "https://x/y" });
    expect(e.subject).toContain("(無題)");
  });
});

describe("reviewRejectedEmail", () => {
  it("includes the reason and edit url", () => {
    const e = reviewRejectedEmail({
      productTitle: "テスト作品",
      reason: "TRPG 素材ではありません",
      editUrl: "https://example.com/creator/products/123/edit",
    });
    expect(e.subject).toContain("テスト作品");
    expect(e.html).toContain("TRPG 素材ではありません");
    expect(e.html).toContain("https://example.com/creator/products/123/edit");
    expect(e.text).toContain("TRPG 素材ではありません");
    expect(e.text).toContain("https://example.com/creator/products/123/edit");
  });

  it("uses a placeholder when reason is blank", () => {
    const e = reviewRejectedEmail({
      productTitle: "x",
      reason: "   ",
      editUrl: "https://x/edit",
    });
    expect(e.html).toContain("理由は記載されていません");
    expect(e.text).toContain("理由は記載されていません");
  });

  it("escapes HTML in title and reason (no raw tags injected)", () => {
    const e = reviewRejectedEmail({
      productTitle: "<script>alert(1)</script>",
      reason: "<b>x</b> & 'y'",
      editUrl: "https://x/edit",
    });
    expect(e.html).not.toContain("<script>alert(1)</script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).toContain("&amp;");
    // text 版は素のまま(エスケープ不要)
    expect(e.text).toContain("<script>alert(1)</script>");
  });

  it("renders newlines in reason as <br /> in html", () => {
    const e = reviewRejectedEmail({
      productTitle: "x",
      reason: "一行目\n二行目",
      editUrl: "https://x/edit",
    });
    expect(e.html).toContain("一行目<br />二行目");
  });
});

describe("reviewSuspendedEmail", () => {
  it("states suspension and links to the edit page", () => {
    const e = reviewSuspendedEmail({
      productTitle: "停止テスト",
      reason: "通報多数",
      editUrl: "https://example.com/creator/products/9/edit",
    });
    expect(e.subject).toContain("公開を停止");
    expect(e.subject).toContain("停止テスト");
    expect(e.html).toContain("通報多数");
    expect(e.html).toContain("https://example.com/creator/products/9/edit");
    expect(e.text).toContain("通報多数");
  });

  it("omits the reason block when no reason is given", () => {
    const e = reviewSuspendedEmail({
      productTitle: "x",
      editUrl: "https://x/edit",
    });
    expect(e.html).not.toContain("理由:");
    expect(e.text).not.toContain("理由:");
  });

  it("escapes HTML in the reason", () => {
    const e = reviewSuspendedEmail({
      productTitle: "x",
      reason: "<img src=x>",
      editUrl: "https://x/edit",
    });
    expect(e.html).not.toContain("<img src=x>");
    expect(e.html).toContain("&lt;img");
  });
});
