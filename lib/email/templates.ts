/**
 * 出品審査の結果メール(承認 / 却下)。純粋関数(Client/Server 両用・テスト可能)。
 *
 * HTML はメールクライアント互換のためインラインスタイルで最小限に留める。
 * text は HTML を読めない環境向けのプレーン版。
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const BRAND = "パラDa-iCE";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(bodyHtml: string): string {
  return [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.7">',
    `<p style="font-weight:700;font-size:18px;margin:0 0 16px">${BRAND}</p>`,
    bodyHtml,
    '<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />',
    `<p style="font-size:12px;color:#888;margin:0">このメールは ${BRAND} の出品審査に関する自動通知です。</p>`,
    "</div>",
  ].join("");
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

/** 承認(公開)通知。 */
export function reviewApprovedEmail(input: {
  productTitle: string;
  productUrl: string;
}): EmailContent {
  const title = input.productTitle || "(無題)";
  const subject = `【${BRAND}】作品が公開されました: ${title}`;
  const html = shell(
    [
      `<p>「<strong>${escapeHtml(title)}</strong>」の審査が承認され、ストアに公開されました 🎉</p>`,
      "<p>下のボタンから公開ページを確認できます。</p>",
      button(input.productUrl, "公開ページを見る"),
    ].join(""),
  );
  const text = [
    `${BRAND}`,
    "",
    `「${title}」の審査が承認され、ストアに公開されました。`,
    "",
    `公開ページ: ${input.productUrl}`,
    "",
    `— このメールは ${BRAND} の出品審査に関する自動通知です。`,
  ].join("\n");
  return { subject, html, text };
}

/** 却下通知(理由付き)。 */
export function reviewRejectedEmail(input: {
  productTitle: string;
  reason: string;
  editUrl: string;
}): EmailContent {
  const title = input.productTitle || "(無題)";
  const reason = input.reason.trim() || "(理由は記載されていません)";
  const subject = `【${BRAND}】作品の審査結果: ${title}`;
  const html = shell(
    [
      `<p>「<strong>${escapeHtml(title)}</strong>」は、今回の審査では公開を見送らせていただきました。</p>`,
      `<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;margin:16px 0"><strong>却下理由:</strong><br />${escapeHtml(reason).replace(/\n/g, "<br />")}</p>`,
      "<p>内容を修正のうえ、編集ページから再度審査に申請いただけます。</p>",
      button(input.editUrl, "編集ページを開く"),
    ].join(""),
  );
  const text = [
    `${BRAND}`,
    "",
    `「${title}」は、今回の審査では公開を見送らせていただきました。`,
    "",
    `却下理由: ${reason}`,
    "",
    "内容を修正のうえ、編集ページから再度審査に申請いただけます。",
    `編集ページ: ${input.editUrl}`,
    "",
    `— このメールは ${BRAND} の出品審査に関する自動通知です。`,
  ].join("\n");
  return { subject, html, text };
}
