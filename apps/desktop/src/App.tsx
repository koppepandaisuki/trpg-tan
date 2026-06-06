import { useEffect, useState } from "react";
import type { CharacterSheet as Sheet } from "@trpg/core";
import { CharacterSheet } from "./CharacterSheet";
import { AuthControl } from "./AuthControl";
import { LibraryPanel } from "./LibraryPanel";
import { initDeepLinkAuth } from "./auth";
import {
  getLibrary,
  upsertEntry,
  removeEntry,
  buildEntry,
  type LibraryEntry,
} from "./library";
import { readSheetFromPath, isTauri } from "./storage";

type SidebarTab = "characters" | "library";

/**
 * アプリのルート。左サイドバーは「キャラ / 購入」の 2 タブ。
 *  - キャラ: ローカルに保存した .ccsheet の一覧(Phase 1)
 *  - 購入:   ログイン中ユーザーの購入作品(Phase 2 / スライス2)
 * 右ペインはシート編集。将来ここにビルド / PLAY のルートを足す。
 */
export function App() {
  const [tab, setTab] = useState<SidebarTab>("characters");
  const [library, setLibrary] = useState<LibraryEntry[]>(() => getLibrary());
  const [active, setActive] = useState<{ sheet: Sheet | null; key: string }>(
    () => ({ sheet: null, key: "new-0" }),
  );
  const [error, setError] = useState<string | null>(null);

  // deep-link(paradice://auth/callback)の購読をアプリ起動時に 1 度だけ登録。
  useEffect(() => {
    if (isTauri()) void initDeepLinkAuth();
  }, []);

  function newCharacter() {
    setActive({ sheet: null, key: `new-${Date.now()}` });
    setError(null);
  }

  async function openEntry(entry: LibraryEntry) {
    if (!isTauri()) {
      setError("ライブラリから開くにはデスクトップアプリが必要です");
      return;
    }
    try {
      const sheet = await readSheetFromPath(entry.path);
      setActive({ sheet, key: `${entry.id}-${Date.now()}` });
      setError(null);
    } catch (e) {
      setError(`開けませんでした(移動/削除された可能性): ${String(e)}`);
    }
  }

  function handleSaved(sheet: Sheet, path: string) {
    setLibrary((lib) => upsertEntry(lib, buildEntry(sheet, path)));
  }

  function handleRemove(id: string) {
    setLibrary((lib) => removeEntry(lib, id));
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* タブ切替: キャラ / 購入 */}
        <div className="tabs" role="tablist">
          <button
            role="tab"
            className={`tab ${tab === "characters" ? "active" : ""}`}
            aria-selected={tab === "characters"}
            onClick={() => setTab("characters")}
          >
            キャラ
          </button>
          <button
            role="tab"
            className={`tab ${tab === "library" ? "active" : ""}`}
            aria-selected={tab === "library"}
            onClick={() => setTab("library")}
          >
            購入
          </button>
        </div>

        {tab === "characters" ? (
          <>
            <div className="sidebar-head">
              <strong>キャラクター</strong>
              <button className="btn mini btn-primary" onClick={newCharacter}>
                ＋ 新規
              </button>
            </div>

            {library.length === 0 ? (
              <p className="muted" style={{ padding: "8px 4px" }}>
                保存したキャラがここに並びます。
              </p>
            ) : (
              <ul className="lib-list">
                {library.map((e) => (
                  <li
                    key={e.id}
                    className="lib-card"
                    onClick={() => openEntry(e)}
                    title={e.path}
                  >
                    <div className="lib-thumb">
                      {e.thumbnail ? (
                        <img src={e.thumbnail} alt="" />
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div className="lib-meta">
                      <span className="lib-name">{e.name}</span>
                      <span className="lib-sys">
                        {e.systemId === "coc6" ? "CoC 6版" : "CoC 7版"}
                      </span>
                    </div>
                    <button
                      className="lib-del"
                      title="ライブラリから外す(ファイルは消えません)"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleRemove(e.id);
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p
                className="tag fail"
                style={{ marginTop: 8, display: "block" }}
              >
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="sidebar-head">
              <strong>購入した作品</strong>
            </div>
            <LibraryPanel />
          </>
        )}

        {/* ログイン状態(両タブ共通。購入タブの内容はログインで解放)*/}
        <div className="auth-section">
          <AuthControl />
        </div>
      </aside>

      <main className="main">
        <CharacterSheet
          key={active.key}
          initialSheet={active.sheet}
          onSaved={handleSaved}
        />
      </main>
    </div>
  );
}
