import { useState } from "react";
import { Bug } from "lucide-react";
import { hasWebhook, sendReport } from "./diag";

/**
 * 画面右下の「不具合報告」フローティングボタン。クリックで小さなパネルを開き、
 * 任意のメモを添えて直近のログ/エラーを Discord へ 1 クリック送信する。
 * 送信先(VITE_DISCORD_WEBHOOK_URL)が未設定なら何も表示しない。
 */
export function ReportButton() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [err, setErr] = useState<string | null>(null);

  if (!hasWebhook()) return null;

  async function send() {
    setStatus("sending");
    setErr(null);
    try {
      await sendReport(note);
      setStatus("sent");
      setNote("");
      window.setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1600);
    } catch (e) {
      setStatus("error");
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="diag-report">
      {open && (
        <div className="diag-pop" role="dialog" aria-label="不具合報告">
          <div className="diag-pop-head">
            <strong>不具合・ログを送信</strong>
            <button
              className="diag-x"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
          <p className="diag-help muted">
            直近のログとエラーを開発者へ送ります（卓の本文やキャラ内容は送りません）。
            気づいたことがあれば一言添えてください。
          </p>
          <textarea
            className="input"
            rows={3}
            placeholder="任意: 何が起きた？（例: 駒を動かしたら相手画面に反映されない）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={status === "sending"}
          />
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={status === "sending"}
            onClick={() => void send()}
          >
            {status === "sending"
              ? "送信中…"
              : status === "sent"
                ? "✓ 送信しました"
                : "Discord に送信"}
          </button>
          {err && (
            <p className="tag fail" style={{ fontSize: 11 }}>
              {err}
            </p>
          )}
        </div>
      )}
      <button
        className="diag-fab"
        title="不具合・ログを開発者へ送る"
        onClick={() => setOpen((v) => !v)}
      >
        <Bug size={15} /> 不具合報告
      </button>
    </div>
  );
}
