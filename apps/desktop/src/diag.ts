/**
 * 診断ログの収集 + Discord への「ワンボタン報告」。
 *
 * テスターが不具合に遭遇したとき、直近のコンソールログ(net.* の計測ログ等)と
 * 未捕捉エラーをまとめて開発者の Discord webhook へ送る。送信先は
 * `VITE_DISCORD_WEBHOOK_URL`(apps/desktop/.env、git 管理外)で設定する。未設定なら
 * 報告ボタンは表示されない。
 *
 * プライバシー: 送信されるのは「コンソールログ・エラー・端末情報(UA)・Supabase
 * プロジェクト URL・入室名・現在の画面 URL」。卓の本文やキャラ内容は送らない。
 */

const WEBHOOK =
  (import.meta.env.VITE_DISCORD_WEBHOOK_URL as string | undefined)?.trim() || "";

const MAX_LINES = 500;
const buffer: string[] = [];

function record(level: string, args: unknown[]): void {
  try {
    const msg = args
      .map((a) => {
        if (typeof a === "string") return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ");
    const t = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    buffer.push(`${t} ${level} ${msg}`);
    if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES);
  } catch {
    // ログ収集の失敗は本体に影響させない
  }
}

let installed = false;
/** console.* と未捕捉エラーをリングバッファに取り込む(起動時に 1 回呼ぶ)。 */
export function installDiag(): void {
  if (installed) return;
  installed = true;
  const c = console as unknown as Record<
    "log" | "info" | "warn" | "error",
    (...a: unknown[]) => void
  >;
  (["log", "info", "warn", "error"] as const).forEach((level) => {
    const orig = c[level].bind(console);
    c[level] = (...args: unknown[]) => {
      record(level.toUpperCase(), args);
      orig(...args);
    };
  });
  window.addEventListener("error", (e) => {
    record("ERROR", [`window.onerror: ${e.message}`, e.filename, `${e.lineno}:${e.colno}`]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    record("ERROR", ["unhandledrejection:", String(e.reason)]);
  });
}

/** 報告ボタンを出してよいか(送信先が設定されているか)。 */
export function hasWebhook(): boolean {
  return WEBHOOK.length > 0;
}

function meta(): string {
  let name = "";
  try {
    name = localStorage.getItem("trpg.net.name.v1") ?? "";
  } catch {
    // localStorage 不可は無視
  }
  return [
    `time: ${new Date().toString()}`,
    `name: ${name || "(未設定)"}`,
    `supabase: ${import.meta.env.VITE_SUPABASE_URL ?? "(未設定)"}`,
    `ua: ${navigator.userAgent}`,
    `url: ${location.href}`,
  ].join("\n");
}

/** 添付する全文レポート(メタ情報 + ログ)。 */
export function collectReport(note?: string): string {
  const head = [
    "=== パラDa-iCE 不具合レポート ===",
    `メモ: ${note?.trim() || "(なし)"}`,
    "",
    meta(),
    "",
    `--- ログ(末尾 ${buffer.length} 行) ---`,
  ].join("\n");
  return `${head}\n${buffer.join("\n")}`;
}

/** Discord webhook へ送信(短い本文 + ログ全文を .txt 添付)。 */
export async function sendReport(note?: string): Promise<void> {
  if (!WEBHOOK) throw new Error("送信先が未設定です(VITE_DISCORD_WEBHOOK_URL)");
  const report = collectReport(note);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const summary = [
    "🐞 **不具合レポート**(パラDa-iCE)",
    note?.trim() ? `> ${note.trim().slice(0, 800)}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1900);

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({ content: summary || "🐞 不具合レポート" }),
  );
  form.append(
    "files[0]",
    new Blob([report], { type: "text/plain;charset=utf-8" }),
    `report-${ts}.txt`,
  );

  const res = await fetch(WEBHOOK, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`送信に失敗しました (HTTP ${res.status})`);
  }
}
