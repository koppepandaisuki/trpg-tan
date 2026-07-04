import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { BookMarked, Sparkles, Settings2, Square, Coins } from "lucide-react";
import {
  askRulebookLLM,
  describeLLMError,
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  hasApiKey,
  LLM_MODELS,
} from "./llm";
import { aiComplete, refreshGold, useGoldBalance } from "./gold-remote";

/**
 * ルールブック Q&A。GM のローカルファイル(txt / md)を登録し、質問すると
 * ルールブック本文から関連箇所を検索して提示する。
 *
 *  - 検索モード(常時): 段落分割 + 語/2-gram スコアリングで関連箇所を抽出。
 *    本文はこの端末の外へ出ない。
 *  - AI 回答モード(任意):
 *      * 運営 AI(既定): ログインするだけで使える。1 回ごとにゴールドを消費
 *        (従量課金)。API キー不要で誰でも使える。
 *      * 自前キー(上級者): 自分の Anthropic キーを設定すると無料で使え、
 *        ストリーミング表示になる(キーはこの端末にのみ保存)。
 *    どちらも検索でヒットした抜粋 + 質問だけを送る(全文は送らない)。
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

  // AI 回答モード。運営 AI(ゴールド)なら誰でも使えるので既定 ON。
  const [aiMode, setAiMode] = useState(true);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // 自前キーがあれば直叩き(無料・ストリーミング)、無ければ運営 AI(ゴールド)。
  const [byok, setByok] = useState(() => hasApiKey());
  const goldBalance = useGoldBalance();

  // 設定(API キー / モデル)。
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState(() => getApiKey());
  const [model, setModelState] = useState(() => getModel());

  useEffect(() => setBooks(loadBooks(playId)), [playId]);
  useEffect(() => () => abortRef.current?.abort(), []);
  // 運営 AI 利用時の残高表示のため、初回に静かに取得。
  useEffect(() => {
    if (!hasApiKey()) void refreshGold();
  }, []);

  function persist(list: BookRef[]) {
    setBooks(list);
    try {
      localStorage.setItem(booksKey(playId), JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  function saveSettings() {
    setApiKey(keyInput);
    setModel(model);
    setByok(hasApiKey());
    if (!keyInput.trim()) void refreshGold();
    setShowSettings(false);
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
    setAiAnswer(null);
    try {
      const contents = await Promise.all(
        books.map(async (b) => ({ name: b.name, text: await readTextFile(b.path) })),
      );
      const found = searchBooks(contents, q);
      setHits(found);

      if (aiMode && found.length > 0) {
        const passages = found.map((h) => ({ book: h.book, text: h.text }));
        if (byok) {
          // 自前キー: 直接 Claude を叩く(無料・ストリーミング)。
          setStreaming(true);
          setAiAnswer("");
          const ctrl = new AbortController();
          abortRef.current = ctrl;
          try {
            await askRulebookLLM(
              q,
              passages,
              (delta) => setAiAnswer((a) => (a ?? "") + delta),
              ctrl.signal,
            );
          } catch (e) {
            if (!ctrl.signal.aborted) setError(describeLLMError(e));
          } finally {
            setStreaming(false);
            abortRef.current = null;
          }
        } else {
          // 運営 AI: サーバ経由(ゴールド従量課金・一括表示)。
          const r = await aiComplete(q, passages);
          if (r.ok) {
            setAiAnswer(r.text);
          } else if (r.reason === "insufficient_gold") {
            setError(
              "ゴールドが不足しています。設定 →「ゴールド」でチャージするか、自分の API キーを設定すると無料で使えます。",
            );
          } else if (r.reason === "not_configured") {
            setError("AI は現在準備中です。少し待ってお試しください。");
          } else if (r.reason === "not_authenticated") {
            setError("AI 回答にはログインが必要です(右上のアカウントから)。");
          } else {
            setError(r.message);
          }
        }
      }
    } catch (e) {
      setError(`読み込めませんでした(移動/削除の可能性): ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function stopStream() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  return (
    <div className="rqa">
      {books.length === 0 ? (
        <p className="palette-empty muted">
          ルールブック(txt / md)を登録すると、質問に対して本文から関連箇所を
          検索して提示します。検索のみなら本文は端末の外へ出ません。
        </p>
      ) : (
        <div className="rqa-books">
          {books.map((b) => (
            <span key={b.path} className="rqa-book ibtn" title={b.path}>
              <BookMarked size={12} /> {b.name}
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

      {/* AI 回答の切替 + 設定 */}
      <div className="rqa-aibar">
        <button
          className={`btn mini ibtn ${aiMode ? "btn-primary" : ""}`}
          onClick={() => setAiMode((v) => !v)}
          title="検索でヒットした抜粋を Claude に渡して回答を生成します"
        >
          <Sparkles size={13} /> AI回答 {aiMode ? "ON" : "OFF"}
        </button>
        {aiMode &&
          (byok ? (
            <span className="rqa-ai-mode muted" title="自分の API キーで無料利用中">
              自前キー・無料
            </span>
          ) : (
            <span
              className="rqa-ai-mode ibtn"
              title="運営の AI をゴールドで利用します(1 回ごとに消費)"
            >
              <Coins size={12} /> ゴールド
              {goldBalance !== null && <b>・残 {goldBalance}</b>}
            </span>
          ))}
        <button
          className="btn mini ibtn"
          onClick={() => setShowSettings((v) => !v)}
          title="API キー・モデルの設定(自前キーで無料利用)"
        >
          <Settings2 size={13} />
        </button>
      </div>

      {showSettings && (
        <div className="rqa-settings">
          <p className="sysb-help muted" style={{ marginTop: 0 }}>
            通常はキー設定不要です。ログインすれば運営の AI をゴールドで使えます。
            自分の Anthropic キーを入れると<strong>無料</strong>＆ストリーミング表示になります。
          </p>
          <label className="sysb-label">
            Anthropic API キー（この端末にのみ保存・任意）
            <input
              className="input"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
          </label>
          <label className="sysb-label">
            モデル
            <select
              className="input"
              value={model}
              onChange={(e) => setModelState(e.target.value)}
            >
              {LLM_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <p className="sysb-help muted">
            AI 回答 ON のときは、検索で見つかった抜粋と質問のみを Anthropic に
            送信します（ルールブック全文は送りません）。キーは{" "}
            <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>{" "}
            で発行できます。
          </p>
          <button className="btn mini btn-primary" onClick={saveSettings}>
            保存
          </button>
        </div>
      )}

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
          disabled={busy || streaming || books.length === 0 || !question.trim()}
        >
          {busy ? "検索中…" : "質問"}
        </button>
      </div>

      {error && (
        <p className="tag fail" style={{ fontSize: 11 }}>
          {error}
        </p>
      )}

      {/* AI 回答(ストリーミング) */}
      {aiAnswer !== null && (
        <div className="rqa-ai">
          <div className="rqa-ai-head ibtn">
            <Sparkles size={13} /> AI回答
            {streaming && (
              <button className="rqa-ai-stop ibtn" onClick={stopStream} title="停止">
                <Square size={11} /> 停止
              </button>
            )}
          </div>
          <p className="rqa-ai-text">
            {aiAnswer}
            {streaming && <span className="rqa-caret">▋</span>}
          </p>
        </div>
      )}

      {/* 検索ヒット(根拠の原文) */}
      {hits !== null &&
        (hits.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>
            該当箇所が見つかりませんでした。言い回しを変えてみてください。
          </p>
        ) : (
          <div className="rqa-hits">
            {aiAnswer !== null && (
              <p className="rqa-hits-label muted">根拠にした原文</p>
            )}
            {hits.map((h, i) => (
              <div key={i} className="rqa-hit">
                <div className="rqa-hit-src ibtn">
                  <BookMarked size={11} /> {h.book}
                </div>
                <p className="rqa-hit-text">{h.text}</p>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
