import { useEffect, useState } from "react";

interface StockEntry {
  text: string;
  comment: boolean;
  seName: string | undefined;
}

/** 1 ブロック → 本文エントリ([SE:名前] を抽出し、改行は保持)。 */
function toEntry(block: string): StockEntry {
  const m = block.match(/\[SE:([^\]]+)\]/i);
  const text = block
    .replace(/\[SE:[^\]]+\]/gi, "") // SE タグだけ除去(改行は残す)
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+$/g, "")) // 行末の空白だけ落とす
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
  return { text, comment: false, seName: m?.[1]?.trim() };
}

/**
 * 定型文のパース。
 *   - 空行(空白だけの行も可)でエントリを区切る = 1 エントリ内で自由に改行できる。
 *   - 後方互換: 空行が 1 つも無いストックは従来どおり「1 行 1 エントリ」。
 *   - 行頭 `#` / `//` は見出し。見出し直後は空行が無くても本文と分けて扱う。
 */
function parseStock(stock: string): StockEntry[] {
  const hasBlank = /\r?\n[ \t]*\r?\n/.test(stock);
  const rawBlocks = hasBlank
    ? stock.split(/\r?\n[ \t]*\r?\n+/)
    : stock.split(/\r?\n/);
  return rawBlocks
    .map((b) =>
      b
        .split(/\r?\n/)
        .map((l) => l.replace(/[ \t]+$/g, ""))
        .join("\n")
        .replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, ""),
    )
    .filter((b) => b.length > 0)
    .flatMap((b): StockEntry[] => {
      const nl = b.indexOf("\n");
      const first = (nl >= 0 ? b.slice(0, nl) : b).trim();
      if (first.startsWith("#") || first.startsWith("//")) {
        const heading: StockEntry = {
          text: first.replace(/^#+\s*|^\/\/\s*/, ""),
          comment: true,
          seName: undefined,
        };
        const rest = nl >= 0 ? b.slice(nl + 1).replace(/^\n+/, "") : "";
        return rest.trim() ? [heading, toEntry(rest)] : [heading];
      }
      return [toEntry(b)];
    });
}

/**
 * シナリオテキストストック。シナリオの定型文(描写・導入・NPC セリフ等)を
 * 保持し、チャパレと同じ操作感で使う:
 *   クリック = 入力欄へ展開 / ダブルクリック or 💬 = チャットへ送信 /
 *   📢 = 画面中央にどーんとテロップ表示(チャットには流さない)。
 * 空行でエントリを区切り、区切り内は自由に改行できる(長文を読みやすく)。
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

  const lines = parseStock(stock);

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
            rows={8}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              "空行でテキストを区切ります（区切りの中は自由に改行OK）。\n\n# 導入\n古びた洋館の扉が軋む—— [SE:軋み]\n\n「ようこそ。\n長い口上もこのように\n複数行で読みやすく置けます」\n\n※ [SE:名前] で SE パネルの効果音を一緒に鳴らせます"
            }
          />
          <p className="muted" style={{ fontSize: 11, margin: "2px 2px 0" }}>
            空行でテキストを区切ります。区切りの中は改行して長文を読みやすく置けます。
          </p>
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
