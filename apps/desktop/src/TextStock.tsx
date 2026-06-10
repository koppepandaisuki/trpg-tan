import { useEffect, useState } from "react";

/**
 * シナリオテキストストック。シナリオの定型文(描写・導入・NPC セリフ等)を
 * 1 行 1 テキストで保持し、チャパレと同じ操作感で使う:
 *   クリック = 入力欄へ展開(手で調整可) / ダブルクリック = 即送信(GM)。
 * `#` / `//` 行は見出し。本文は .play(卓データ)に保存される。
 */
export function TextStockPanel({
  stock,
  onFill,
  onSend,
  onEdit,
}: {
  stock: string;
  onFill: (text: string) => void;
  onSend: (text: string) => void;
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
    .map((l) =>
      l.startsWith("#") || l.startsWith("//")
        ? { text: l.replace(/^#+\s*|^\/\/\s*/, ""), comment: true }
        : { text: l, comment: false },
    );

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
              "1 行 1 テキスト\n# 導入\n古びた洋館の扉が軋む——\n「ようこそ、お待ちしておりました」"
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
          「✎ 編集」でシナリオの定型文を登録（クリックで入力欄に / ダブルクリックで即送信）
        </p>
      ) : (
        <div className="palette-lines">
          {lines.map((ln, i) =>
            ln.comment ? (
              <div key={i} className="palette-head-line">
                {ln.text}
              </div>
            ) : (
              <button
                key={i}
                className="palette-line"
                onClick={() => onFill(ln.text)}
                onDoubleClick={() => onSend(ln.text)}
                title="クリック: 入力欄に / ダブルクリック: 即送信"
              >
                {ln.text}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
