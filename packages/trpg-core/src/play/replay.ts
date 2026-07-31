import type { PlayEvent } from "./types.js";

/**
 * リプレイ(セッションログ)の書き出し。プレーンテキストと、発言者色・
 * タイムスタンプつきの整形 HTML の 2 形式を作る。GM・参加者の双方から
 * 使える純粋関数(名前解決は呼び出し側が渡す)。
 *
 * デスクトップ(PlayTable/PlayClient)と Web(components/play/*)が同じ
 * 書き出し結果になるよう core に置く。ここは DOM にも fs にも触れない。
 */

export type NameResolver = (channelId?: string) => string;

/**
 * 秘匿ロールの出目を書き出してよいか(参加者視点のマスク用)。
 * GM は常に true、参加者は visibleTo に含まれるときのみ true を返す。
 * 未指定なら常に見える(GM 相当)。
 */
export type SecretGuard = (ev: Extract<PlayEvent, { kind: "roll" }>) => boolean;

function timeOf(ts: string): string {
  return new Date(ts).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ロール結果の短い説明(成功/失敗/レベル or 自由ロールの detail)。 */
function rollResult(ev: Extract<PlayEvent, { kind: "roll" }>): string {
  if (ev.detail) return ev.detail;
  if (ev.check) return `${ev.check.isSuccess ? "成功" : "失敗"}(${ev.check.level})`;
  if (ev.success !== undefined) return ev.success ? "成功" : "失敗";
  return "";
}

/** プレーンテキスト(既存互換)。canSee 未指定なら全出目を書き出す。 */
export function replayToText(
  log: PlayEvent[],
  nameOf: NameResolver,
  canSee?: SecretGuard,
): string {
  const lines: string[] = [];
  for (const ev of log) {
    const time = timeOf(ev.ts);
    if (ev.kind === "chat") {
      lines.push(`[${time}][${nameOf(ev.channel)}] ${ev.actor}: ${ev.text}`);
    } else if (ev.kind === "roll") {
      // 参加者視点で見えない秘匿ロールは出目を伏せる。
      if (ev.secret && canSee && !canSee(ev)) {
        lines.push(
          `[${time}][${nameOf(ev.channel)}] ${ev.actor}: 🎲 ${ev.label} （シークレット・非公開）`,
        );
        continue;
      }
      const res = rollResult(ev);
      lines.push(
        `[${time}][${nameOf(ev.channel)}] ${ev.actor}: 🎲 ${ev.label} [${ev.dice.join(",")}] = ${ev.total}${res ? ` ${res}` : ""}${ev.secret ? "（シークレット）" : ""}`,
      );
    } else if (ev.kind === "resource") {
      lines.push(
        `[${time}] ${ev.actor}: ${ev.label} ${ev.delta >= 0 ? "+" : ""}${ev.delta} → ${ev.current}`,
      );
    } else if (ev.kind === "system") {
      lines.push(`[${time}] ${ev.text}`);
    }
  }
  return lines.join("\n");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 発言者色を安全な CSS 色にする(未指定は既定)。 */
function safeColor(c?: string): string {
  if (!c) return "";
  // 単純なホワイトリスト: #hex / rgb() / 英名のみ許可(HTML 注入対策)。
  if (/^#[0-9a-f]{3,8}$/i.test(c)) return c;
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(c)) return c;
  if (/^[a-z]{3,20}$/i.test(c)) return c;
  return "";
}

/**
 * 整形 HTML(単体で開ける。発言者色・時刻つき、ダイスは強調)。
 * ブラウザ / エディタでそのまま読める“清書リプレイ”。
 */
export function replayToHtml(
  log: PlayEvent[],
  nameOf: NameResolver,
  title: string,
): string {
  const rows: string[] = [];
  for (const ev of log) {
    const time = timeOf(ev.ts);
    if (ev.kind === "chat") {
      const col = safeColor(ev.color);
      rows.push(
        `<div class="r"><span class="t">${time}</span>` +
          `<span class="ch">${esc(nameOf(ev.channel))}</span>` +
          `<span class="a"${col ? ` style="color:${col}"` : ""}>${esc(ev.actor)}</span>` +
          `<span class="m">${esc(ev.text)}</span></div>`,
      );
    } else if (ev.kind === "roll") {
      const res = rollResult(ev);
      const col = safeColor(ev.color);
      rows.push(
        `<div class="r roll"><span class="t">${time}</span>` +
          `<span class="ch">${esc(nameOf(ev.channel))}</span>` +
          `<span class="a"${col ? ` style="color:${col}"` : ""}>${esc(ev.actor)}</span>` +
          `<span class="m">🎲 ${esc(ev.label)} <b>[${esc(ev.dice.join(","))}] = ${ev.total}</b>` +
          `${res ? ` <em>${esc(res)}</em>` : ""}${ev.secret ? ' <span class="sec">(秘匿)</span>' : ""}</span></div>`,
      );
    } else if (ev.kind === "resource") {
      rows.push(
        `<div class="r sys"><span class="t">${time}</span>` +
          `<span class="m">${esc(ev.actor)}: ${esc(ev.label)} ${ev.delta >= 0 ? "+" : ""}${ev.delta} → ${ev.current}</span></div>`,
      );
    } else if (ev.kind === "system") {
      rows.push(
        `<div class="r sys"><span class="t">${time}</span><span class="m">${esc(ev.text)}</span></div>`,
      );
    }
  }
  const now = new Date().toLocaleString("ja-JP");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>${esc(title)} — リプレイ</title>
<style>
:root{color-scheme:light dark}
body{font-family:"Noto Sans JP",system-ui,sans-serif;max-width:820px;margin:0 auto;padding:28px 20px;background:#fff;color:#1a2230;line-height:1.7}
@media(prefers-color-scheme:dark){body{background:#0f1420;color:#dfe5f0}}
h1{font-size:20px;margin:0 0 4px}
.meta{color:#8a93a6;font-size:12px;margin-bottom:18px}
.r{display:grid;grid-template-columns:44px auto 1fr;gap:8px;align-items:baseline;padding:3px 0;border-bottom:1px solid rgba(128,128,128,.12)}
.r .t{color:#9aa3b5;font-size:11px;font-variant-numeric:tabular-nums}
.r .ch{color:#8a93a6;font-size:11px}
.r .a{font-weight:800}
.r.roll .m b{color:#2a7de1}
.r.roll .m em{font-style:normal;font-weight:700;margin-left:4px}
.r.sys{grid-template-columns:44px 1fr;color:#8a93a6;font-size:13px}
.r .sec{color:#c0392b;font-size:11px}
.foot{margin-top:20px;color:#9aa3b5;font-size:11px;text-align:center}
</style></head><body>
<h1>${esc(title || "セッション")}</h1>
<div class="meta">リプレイ書き出し ・ ${esc(now)} ・ Re-dice</div>
${rows.join("\n")}
<div class="foot">Re-dice で書き出したリプレイ</div>
</body></html>`;
}
