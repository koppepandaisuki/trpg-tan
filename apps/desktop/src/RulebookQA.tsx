import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";

/**
 * ルールブック Q&A。GM のローカルファイル(txt / md)を登録し、質問すると
 * ルールブック本文から関連箇所を検索して提示する。
 *
 * v1 は完全ローカルの検索ベース(段落分割 + 語/2-gram スコアリング)。
 * 外部 AI(LLM)による要約・回答生成は後続フェーズで同じ UI に被せる。
 * ルールブックの本文は著作物なので、端末外へは送らない方針。
 */

interface BookRef {
  name: string;
  path: string;
}
interface Hit {
  book: string;
  text: string;
  score: number;
}

const booksKey = (playId: string) => `trpg.play.rulebooks.v1::${playId}`;

function loadBooks(playId: string): BookRef[] {
  try {
    const raw = localStorage.getItem(booksKey(playId));
    const list = raw ? (JSON.parse(raw) as BookRef[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 質問文 → 検索語(空白区切り + CJK 連続部分の 2-gram)。 */
function termsOf(q: string): string[] {
  const out = new Set<string>();
  for (const w of q.toLowerCase().split(/[\s、。・,?？!！]+/).filter(Boolean)) {
    out.add(w);
    // 日本語はわかち書きされないので 2-gram も足す
    if (/[぀-ヿ㐀-鿿]/.test(w)) {
      for (let i = 0; i + 1 < w.length; i++) out.add(w.slice(i, i + 2));
    }
  }
  return [...out];
}

/** 本文 → 段落(見出し/空行区切り。短すぎる断片は前と結合)。 */
function paragraphsOf(text: string): string[] {
  const blocks = text
    .split(/\r?\n\s*\r?\n|(?=^#+\s)/m)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const b of blocks) {
    if (out.length > 0 && (b.length < 40 || out[out.length - 1].length < 40)) {
      out[out.length - 1] += "\n" + b;
    } else {
      out.push(b);
    }
  }
  return out;
}

function searchBooks(
  contents: { name: string; text: string }[],
  question: string,
  topN = 3,
): Hit[] {
  const terms = termsOf(question);
  if (terms.length === 0) return [];
  const hits: Hit[] = [];
  for (const c of contents) {
    for (const para of paragraphsOf(c.text)) {
      const low = para.toLowerCase();
      let score = 0;
      for (const t of terms) {
        let i = low.indexOf(t);
        while (i !== -1) {
          // 長い語ほど重く(2-gram=2 < 単語)。出現ごとに加点。
          score += t.length;
          i = low.indexOf(t, i + t.length);
        }
      }
      if (score > 0) {
        // 長文段落のスコア希釈(やや対数寄りに正規化)
        hits.push({ book: c.name, text: para, score: score / Math.log2(16 + para.length) });
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, topN);
}

export function RulebookQA({ playId }: { playId: string }) {
  const [books, setBooks] = useState<BookRef[]>(() => loadBooks(playId));
  const [question, setQuestion] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setBooks(loadBooks(playId)), [playId]);

  function persist(list: BookRef[]) {
    setBooks(list);
    try {
      localStorage.setItem(booksKey(playId), JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  async function addBooks() {
    setError(null);
    try {
      const sel = await open({
        multiple: true,
        filters: [{ name: "テキスト / Markdown", extensions: ["txt", "md", "markdown"] }],
      });
      if (!sel) return;
      const paths = Array.isArray(sel) ? sel : [sel];
      const added = paths
        .filter((p) => !books.some((b) => b.path === p))
        .map((p) => ({ path: p, name: p.split(/[\\/]/).pop() ?? p }));
      if (added.length) persist([...books, ...added]);
    } catch (e) {
      setError(`追加できませんでした: ${String(e)}`);
    }
  }

  async function ask() {
    const q = question.trim();
    if (!q || books.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const contents = await Promise.all(
        books.map(async (b) => ({ name: b.name, text: await readTextFile(b.path) })),
      );
      setHits(searchBooks(contents, q));
    } catch (e) {
      setError(`読み込めませんでした(移動/削除の可能性): ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rqa">
      {books.length === 0 ? (
        <p className="palette-empty muted">
          ルールブック(txt / md)を登録すると、質問に対して本文から関連箇所を
          検索して提示します。本文はこの端末の外へ送信しません。
        </p>
      ) : (
        <div className="rqa-books">
          {books.map((b) => (
            <span key={b.path} className="rqa-book" title={b.path}>
              📕 {b.name}
              <button
                className="rqa-book-del"
                onClick={() => persist(books.filter((x) => x.path !== b.path))}
                title="登録を外す"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <button className="btn mini" style={{ width: "100%" }} onClick={() => void addBooks()}>
        ＋ ルールブックを追加（txt / md）
      </button>

      <div className="pinput-row">
        <input
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void ask()}
          placeholder="例: 戦闘中の回避は何回まで？"
          disabled={books.length === 0}
        />
        <button
          className="btn mini btn-primary"
          onClick={() => void ask()}
          disabled={busy || books.length === 0 || !question.trim()}
        >
          {busy ? "検索中…" : "質問"}
        </button>
      </div>

      {error && (
        <p className="tag fail" style={{ fontSize: 11 }}>
          {error}
        </p>
      )}

      {hits !== null &&
        (hits.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>
            該当箇所が見つかりませんでした。言い回しを変えてみてください。
          </p>
        ) : (
          <div className="rqa-hits">
            {hits.map((h, i) => (
              <div key={i} className="rqa-hit">
                <div className="rqa-hit-src">📕 {h.book}</div>
                <p className="rqa-hit-text">{h.text}</p>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
