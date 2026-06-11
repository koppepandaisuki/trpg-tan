import { useEffect, useState } from "react";

/**
 * シナリオテキストストック。シナリオの定型文(描写・導入・NPC セリフ等)を
 * 1 行 1 テキストで保持し、チャパレと同じ操作感で使う:
 *   クリック = 入力欄へ展開 / ダブルクリック or 💬 = チャットへ送信 /
 *   📢 = 画面中央にどーんとテロップ表示(チャットには流さない)。
 * `#` / `//` 行は見出し。本文は .play(卓データ)に保存される。
 */
export function TextStockPanel({
  stock,
  onFill,
  onSend,
  onTelop,
  onEdit,
}: {
  stock: string;
  onFill: (text: string) => void;
  /** seName は行末の [SE:名前] から(SE パネルの登録名と一致すれば鳴る)。 */
  onSend: (text: string, seName?: string) => void;
  /** 画面にテロップとして大きく表示する。 */
  onTelop: (text: string, seName?: string) => void;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stock);

  useEffect(() => {
    if (!editing) setDraft(stock);
  }, [stock, editing]);

  const lines = stock
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (l.startsWith("#") || l.startsWith("//")) {
        return {
          text: l.replace(/^#+\s*|^\/\/\s*/, ""),
          comment: true,
          seName: undefined as string | undefined,
        };
      }
      // 行内の [SE:名前] は効果音の指定(表示/送信テキストからは取り除く)。
      const m = l.match(/\[SE:([^\]]+)\]/i);
      return {
        text: l.replace(/\s*\[SE:[^\]]+\]\s*/gi, " ").trim(),
        comment: false,
        seName: m?.[1].trim(),
      };
    });

  function save() {
    onEdit(draft);
    setEditing(false);
  }

  return (
    <div className="tstock">
      <div className="ppanel-palette-head">
        <span className="ppanel-section">定型文</span>
        <button className="palette-edit" onClick={() => setEditing((v) => !v)}>
          {editing ? "閉じる" : "✎ 編集"}
        </button>
      </div>

      {editing ? (
        <div className="palette-editor">
          <textarea
            className="input"
            rows={7}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              "1 行 1 テキスト\n# 導入\n古びた洋館の扉が軋む—— [SE:軋み]\n「ようこそ、お待ちしておりました」\n※ [SE:名前] で SE パネルの効果音を一緒に鳴らせます"
            }
          />
          <div className="palette-editor-actions">
            <span style={{ flex: 1 }} />
            <button
              className="btn mini"
              onClick={() => {
                setDraft(stock);
                setEditing(false);
              }}
            >
              キャンセル
            </button>
            <button className="btn mini btn-primary" onClick={save}>
              保存
            </button>
          </div>
        </div>
      ) : lines.length === 0 ? (
        <p className="palette-empty muted">
          「✎ 編集」で定型文を登録（クリック: 入力欄へ / 💬: チャット送信 /
          📢: 画面に大きく表示）
        </p>
      ) : (
        <div className="palette-lines">
          {lines.map((ln, i) =>
            ln.comment ? (
              <div key={i} className="palette-head-line">
                {ln.text}
              </div>
            ) : (
              <div key={i} className="tstock-line">
                <button
                  className="palette-line"
                  onClick={() => onFill(ln.text)}
                  onDoubleClick={() => onSend(ln.text, ln.seName)}
                  title="クリック: 入力欄に / ダブルクリック: チャットへ即送信"
                >
                  {ln.text}
                  {ln.seName && <span className="tstock-se">♪{ln.seName}</span>}
                </button>
                <button
                  className="tstock-act"
                  onClick={() => onSend(ln.text, ln.seName)}
                  title={`チャットへ送信${ln.seName ? `（♪${ln.seName} 再生）` : ""}`}
                >
                  💬
                </button>
                <button
                  className="tstock-act"
                  onClick={() => onTelop(ln.text, ln.seName)}
                  title={`画面に大きく表示${ln.seName ? `（♪${ln.seName} 再生）` : ""}`}
                >
                  📢
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ===== テロップ(画面にどーんと表示する演出) ===== */

/** 文字数に応じた表示時間(2.8〜7 秒)。 */
function telopMs(text: string): number {
  return Math.min(7000, Math.max(2800, 1800 + text.length * 90));
}

/** 画面中央の帯 + 大きな文字。非ブロッキングで自動的に消える。 */
export function TelopOverlay({
  text,
  onDone,
}: {
  text: string;
  onDone: () => void;
}) {
  const ms = telopMs(text);

  useEffect(() => {
    const t = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(t);
  }, [text, ms, onDone]);

  return (
    <div className="telop-overlay" aria-hidden>
      <div className="telop-band" style={{ animationDuration: `${ms}ms` }} />
      <p className="telop-text" style={{ animationDuration: `${ms}ms` }}>
        {text}
      </p>
    </div>
  );
}
