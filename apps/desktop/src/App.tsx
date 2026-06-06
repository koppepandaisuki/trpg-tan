import { useEffect, useState } from "react";
import {
  createScene,
  type CharacterSheet as Sheet,
  type PlayScene,
} from "@trpg/core";
import { CharacterSheet } from "./CharacterSheet";
import { AuthControl } from "./AuthControl";
import { LibraryPanel } from "./LibraryPanel";
import { Viewer } from "./Viewer";
import { PlayTable } from "./PlayTable";
import { initDeepLinkAuth } from "./auth";
import type { RemoteLibraryItem } from "./library-remote";
import type { DownloadedEntry } from "./downloaded";
import {
  getLibrary,
  upsertEntry,
  removeEntry,
  buildEntry,
  type LibraryEntry,
} from "./library";
import {
  getPlayIndex,
  upsertPlayIndex,
  removePlayIndex,
  buildPlayIndexEntry,
  readPlayFromPath,
  type PlayIndexEntry,
} from "./play-storage";
import { readSheetFromPath, isTauri } from "./storage";

type SidebarTab = "characters" | "library" | "play";
type Viewing = { item: RemoteLibraryItem; entry: DownloadedEntry };
type Session = { scene: PlayScene; path: string | null };

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
  // アプリ内ビューア(購入物の閲覧)。null のとき非表示。
  const [viewing, setViewing] = useState<Viewing | null>(null);
  // PLAY(セッション卓)。開いている卓と保存済み索引。
  const [playIndex, setPlayIndex] = useState<PlayIndexEntry[]>(() =>
    getPlayIndex(),
  );
  const [session, setSession] = useState<Session | null>(null);

  // deep-link(paradice://auth/callback)の購読をアプリ起動時に 1 度だけ登録。
  useEffect(() => {
    if (isTauri()) void initDeepLinkAuth();
  }, []);

  function newSession() {
    const scene = createScene({
      id: crypto.randomUUID(),
      title: "新しい卓",
      systemId: "coc7",
      now: new Date().toISOString(),
    });
    setSession({ scene, path: null });
    setError(null);
  }

  async function openSession(entry: PlayIndexEntry) {
    if (!isTauri()) {
      setError("卓を開くにはデスクトップアプリが必要です");
      return;
    }
    try {
      const scene = await readPlayFromPath(entry.path);
      setSession({ scene, path: entry.path });
      setError(null);
    } catch (e) {
      setError(`卓を開けませんでした(移動/削除の可能性): ${String(e)}`);
    }
  }

  function handlePlayPersist(scene: PlayScene, path: string) {
    setPlayIndex((idx) => upsertPlayIndex(idx, buildPlayIndexEntry(scene, path)));
  }

  function removeSessionEntry(id: string) {
    setPlayIndex((idx) => removePlayIndex(idx, id));
  }

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
          <button
            role="tab"
            className={`tab ${tab === "play" ? "active" : ""}`}
            aria-selected={tab === "play"}
            onClick={() => setTab("play")}
          >
            卓
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
        ) : tab === "library" ? (
          <>
            <div className="sidebar-head">
              <strong>購入した作品</strong>
            </div>
            <LibraryPanel
              onView={(item, entry) => setViewing({ item, entry })}
            />
          </>
        ) : (
          <>
            <div className="sidebar-head">
              <strong>セッション卓</strong>
              <button className="btn mini btn-primary" onClick={newSession}>
                ＋ 新規
              </button>
            </div>

            {playIndex.length === 0 ? (
              <p className="muted" style={{ padding: "8px 4px" }}>
                作った卓がここに並びます。「＋新規」で始めましょう。
              </p>
            ) : (
              <ul className="lib-list">
                {playIndex.map((e) => (
                  <li
                    key={e.id}
                    className="lib-card"
                    onClick={() => void openSession(e)}
                    title={e.path}
                  >
                    <div className="lib-thumb">
                      <span>卓</span>
                    </div>
                    <div className="lib-meta">
                      <span className="lib-name">{e.title}</span>
                      <span className="lib-sys">{e.panelCount} 駒</span>
                    </div>
                    <button
                      className="lib-del"
                      title="一覧から外す(ファイルは消えません)"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        removeSessionEntry(e.id);
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
        )}

        {/* ログイン状態(全タブ共通。購入タブの内容はログインで解放)*/}
        <div className="auth-section">
          <AuthControl />
        </div>
      </aside>

      <main className="main">
        {session ? (
          <PlayTable
            key={session.scene.id}
            initial={session.scene}
            path={session.path}
            onClose={() => setSession(null)}
            onPersist={handlePlayPersist}
          />
        ) : (
          <CharacterSheet
            key={active.key}
            initialSheet={active.sheet}
            onSaved={handleSaved}
          />
        )}
      </main>

      {/* アプリ内ビューア(購入物の閲覧)。シートを保持したまま上に重ねる。*/}
      {viewing && (
        <Viewer
          item={viewing.item}
          entry={viewing.entry}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
