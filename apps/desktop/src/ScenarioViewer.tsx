import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";

/**
 * シナリオ参照(GM 専用)。ローカルの txt / md を登録し、セッション中に
 * その場で読める小さなビューア。検索語を入れると該当段落だけに絞り込む。
 * 本文は端末の外へ送信しない(ルールブック Q&A と同じ方針)。
 */

interface DocRef {
  name: string;
  path: string;
}

const docsKey = (playId: string) => `trpg.play.scenarios.v1::${playId}`;

function loadDocs(playId: string): DocRef[] {
  try {
    const raw = localStorage.getItem(docsKey(playId));
    const list = raw ? (JSON.parse(raw) as DocRef[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function ScenarioViewer({ playId }: { playId: string }) {
  const [docs, setDocs] = useState<DocRef[]>(() => loadDocs(playId));
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDocs(loadDocs(playId));
    setActivePath(null);
    setContent("");
  }, [playId]);

  function persist(list: DocRef[]) {
    setDocs(list);
    try {
      localStorage.setItem(docsKey(playId), JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  async function addDocs() {
    setError(null);
    try {
      const sel = await open({
        multiple: true,
        filters: [{ name: "テキスト / Markdown", extensions: ["txt", "md", "markdown"] }],
      });
      if (!sel) return;
      const paths = Array.isArray(sel) ? sel : [sel];
      const added = paths
        .filter((p) => !docs.some((d) => d.path === p))
        .map((p) => ({ path: p, name: p.split(/[\\/]/).pop() ?? p }));
      if (added.length) persist([...docs, ...added]);
    } catch (e) {
      setError(`追加できませんでした: ${String(e)}`);
    }
  }

  async function openDoc(d: DocRef) {
    setError(null);
    try {
      setContent(await readTextFile(d.path));
      setActivePath(d.path);
    } catch (e) {
      setError(`読み込めませんでした(移動/削除の可能性): ${String(e)}`);
    }
  }

  // 検索語あり → 該当段落のみ / なし → 全文。
  const q = query.trim().toLowerCase();
  const shown = !content
    ? ""
    : !q
      ? content
      : content
          .split(/\r?\n\s*\r?\n/)
          .filter((para) => para.toLowerCase().includes(q))
          .join("\n\n— — —\n\n") || "(該当する段落がありません)";

  return (
    <div className="scen">
      {docs.length === 0 ? (
        <p className="palette-empty muted">
          シナリオ(txt / md)を登録すると、セッション中ここで参照できます。
        </p>
      ) : (
        <div className="scen-tabs">
          {docs.map((d) => (
            <span key={d.path} className="scen-tab-wrap">
              <button
                className={`plog-tab ${activePath === d.path ? "active" : ""}`}
                onClick={() => void openDoc(d)}
                title={d.path}
              >
                📜 {d.name}
              </button>
              <button
                className="rqa-book-del"
                onClick={() => {
                  persist(docs.filter((x) => x.path !== d.path));
                  if (activePath === d.path) {
                    setActivePath(null);
                    setContent("");
                  }
                }}
                title="登録を外す"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <button className="btn mini" style={{ width: "100%" }} onClick={() => void addDocs()}>
        ＋ シナリオを追加（txt / md）
      </button>

      {content && (
        <>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="本文内を検索（該当段落だけ表示）"
          />
          <pre className="scen-body">{shown}</pre>
        </>
      )}

      {error && (
        <p className="tag fail" style={{ fontSize: 11 }}>
          {error}
        </p>
      )}
    </div>
  );
}
