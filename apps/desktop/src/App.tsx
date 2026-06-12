import { useEffect, useState } from "react";
import {
  createScene,
  type CharacterSheet as Sheet,
  type PlayScene,
  type SystemDef,
  type GenericSheet,
} from "@trpg/core";
import { CharacterSheet } from "./CharacterSheet";
import { AuthControl } from "./AuthControl";
import { LibraryPage } from "./LibraryPage";
import { Viewer } from "./Viewer";
import { PlayTable } from "./PlayTable";
import { PlayClient } from "./PlayClient";
import { StorePanel } from "./StorePanel";
import { SystemBuilder } from "./SystemBuilder";
import { GenericSheetEditor } from "./GenericSheetEditor";
import { findSystem } from "./systems-store";
import { SoundSettings } from "./SoundSettings";
import { Toasts } from "./Toasts";
import { initDeepLinkAuth } from "./auth";
import type { RemoteLibraryItem } from "./library-remote";
import type { DownloadedEntry } from "./downloaded";
import {
  getLibrary,
  upsertEntry,
  removeEntry,
  buildEntry,
  buildGenericEntry,
  systemLabel,
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
import { readSheetFromPath, isGenericSheet, isTauri } from "./storage";
import brandLogo from "./assets/logo.png";

type Page = "store" | "library" | "play" | "characters" | "builder";
type Viewing = { item: RemoteLibraryItem; entry: DownloadedEntry };
type Session = { scene: PlayScene; path: string | null };

const PAGES: { key: Page; label: string }[] = [
  { key: "store", label: "ストア" },
  { key: "library", label: "ライブラリ" },
  { key: "play", label: "卓" },
  { key: "characters", label: "キャラクター" },
  { key: "builder", label: "ビルダー" },
];

/**
 * アプリのルート。Steam ライクなシェル:
 *  - 上部ナビ(ストア / ライブラリ / 卓 / キャラクター)+ 右にログイン
 *  - 各ページは全幅。起動直後はストアがフロント
 *  - 下部バー(卓の作成 / DL 管理 / 設定)
 *  - PLAY(卓・ネット参加)は全画面で被さり、☰ ドロワーで抜けられる
 */
export function App() {
  // Steam ライクに、起動直後はストアをフロントに出す。
  const [page, setPage] = useState<Page>("store");
  const [library, setLibrary] = useState<LibraryEntry[]>(() => getLibrary());
  const [active, setActive] = useState<{ sheet: Sheet | null; key: string }>(
    () => ({ sheet: null, key: "new-0" }),
  );
  // カスタムシステムの汎用シート編集(非 null のとき CoC エディタの代わりに表示)。
  const [activeGeneric, setActiveGeneric] = useState<{
    def: SystemDef | null;
    sheet: GenericSheet | null;
    key: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // アプリ内ビューア(購入物の閲覧)。null のとき非表示。
  const [viewing, setViewing] = useState<Viewing | null>(null);
  // PLAY(セッション卓)。開いている卓と保存済み索引。
  const [playIndex, setPlayIndex] = useState<PlayIndexEntry[]>(() =>
    getPlayIndex(),
  );
  const [session, setSession] = useState<Session | null>(null);
  // ネットワーク参加(参加コードで他の人の卓に入る)。
  const [joining, setJoining] = useState<{ code: string; name: string } | null>(
    null,
  );
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(
    () => localStorage.getItem("trpg.net.name.v1") ?? "",
  );
  // 効果音などの設定モーダル。
  const [showSettings, setShowSettings] = useState(false);
  // PLAY 中のドロワー(☰)。卓を抜けずにナビへアクセスする。
  const [drawerOpen, setDrawerOpen] = useState(false);
  // ロゴ / ストアタブのクリックでストアをホーム画面に巻き戻すシグナル。
  const [storeHomeSig, setStoreHomeSig] = useState(0);
  // テーマ(ライト / ダーク)。<html data-theme> で CSS 変数を切替。
  // PLAY(卓 / ネット参加)中は没入のため常にダーク(CCFOLIA/Steam 流)。
  const [theme, setTheme] = useState(
    () => localStorage.getItem("trpg.theme.v1") ?? "light",
  );
  useEffect(() => {
    try {
      localStorage.setItem("trpg.theme.v1", theme);
    } catch {
      // 保存失敗は無視
    }
  }, [theme]);

  // deep-link(paradice://auth/callback)の購読をアプリ起動時に 1 度だけ登録。
  useEffect(() => {
    if (isTauri()) void initDeepLinkAuth();
  }, []);

  // テーマ適用。PLAY 中はユーザー設定に関わらずダークへ。
  const inPlay = !!(session || joining);
  useEffect(() => {
    document.documentElement.dataset.theme = inPlay ? "dark" : theme;
  }, [theme, inPlay]);

  /** ページ遷移(セッション/参加を畳む)。ストアは常にホームから。 */
  function goTo(p: Page) {
    setSession(null);
    setJoining(null);
    setPage(p);
    if (p === "store") setStoreHomeSig((n) => n + 1);
    setDrawerOpen(false);
    setError(null);
  }

  function newSession() {
    const scene = createScene({
      id: crypto.randomUUID(),
      title: "新しい卓",
      systemId: "coc7",
      now: new Date().toISOString(),
    });
    setSession({ scene, path: null });
    setJoining(null);
    setDrawerOpen(false);
    setError(null);
  }

  /** 参加コードで他の人の卓に入る(参加者ビュー固定)。 */
  function joinByCode() {
    const code = joinCode.trim().toUpperCase();
    const name = joinName.trim();
    if (!code || !name) {
      setError("参加コードとあなたの名前を入力してください");
      return;
    }
    try {
      localStorage.setItem("trpg.net.name.v1", name);
    } catch {
      // 保存できなくても参加は続行
    }
    setSession(null);
    setJoining({ code, name });
    setDrawerOpen(false);
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
      setJoining(null);
      setDrawerOpen(false);
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
    setSession(null);
    setJoining(null);
    setPage("characters");
    setDrawerOpen(false);
    setActiveGeneric(null);
    setActive({ sheet: null, key: `new-${Date.now()}` });
    setError(null);
  }

  /** ビルダーから「このシステムでキャラ作成」。 */
  function newGenericCharacter(def: SystemDef) {
    setSession(null);
    setJoining(null);
    setPage("characters");
    setDrawerOpen(false);
    setActiveGeneric({ def, sheet: null, key: `gnew-${Date.now()}` });
    setError(null);
  }

  async function openEntry(entry: LibraryEntry) {
    if (!isTauri()) {
      setError("ライブラリから開くにはデスクトップアプリが必要です");
      return;
    }
    try {
      const sheet = await readSheetFromPath(entry.path);
      setSession(null);
      setJoining(null);
      setPage("characters");
      setDrawerOpen(false);
      if (isGenericSheet(sheet)) {
        // カスタムシステムのキャラ → 汎用エディタで開く。
        setActiveGeneric({
          def: findSystem(sheet.systemId),
          sheet,
          key: `${entry.id}-${Date.now()}`,
        });
      } else {
        setActiveGeneric(null);
        setActive({ sheet, key: `${entry.id}-${Date.now()}` });
      }
      setError(null);
    } catch (e) {
      setError(`開けませんでした(移動/削除された可能性): ${String(e)}`);
    }
  }

  function handleSaved(sheet: Sheet, path: string) {
    setLibrary((lib) => upsertEntry(lib, buildEntry(sheet, path)));
  }

  function handleGenericSaved(sheet: GenericSheet, path: string) {
    setLibrary((lib) => upsertEntry(lib, buildGenericEntry(sheet, path)));
  }

  function handleRemove(id: string) {
    setLibrary((lib) => removeEntry(lib, id));
  }

  /* ===== キャラ一覧(キャラクターページの左列 + ドロワーで再利用) ===== */
  const charList = (
    <ul className="lib-list">
      {library.map((e) => (
        <li
          key={e.id}
          className="lib-card"
          onClick={() => openEntry(e)}
          title={e.path}
        >
          <div className="lib-thumb">
            {e.thumbnail ? <img src={e.thumbnail} alt="" /> : <span>—</span>}
          </div>
          <div className="lib-meta">
            <span className="lib-name">{e.name}</span>
            <span className="lib-sys">{systemLabel(e)}</span>
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
  );

  /* ===== 卓一覧(卓ページ + ドロワーで再利用) ===== */
  const tableList = (
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
  );

  /* ===== PLAY 全画面(卓 / ネット参加) ===== */
  if (session || joining) {
    return (
      <div className="app-shell">
        {session ? (
          <PlayTable
            key={session.scene.id}
            initial={session.scene}
            path={session.path}
            onClose={() => setSession(null)}
            onPersist={handlePlayPersist}
            onMenu={() => setDrawerOpen(true)}
          />
        ) : (
          <PlayClient
            key={`${joining!.code}-${joining!.name}`}
            code={joining!.code}
            name={joining!.name}
            onClose={() => setJoining(null)}
          />
        )}

        {/* ☰ ドロワー: ナビ + 保存済みの卓(別卓への乗り換え) */}
        {drawerOpen && (
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
            <div className="drawer" onClick={(e) => e.stopPropagation()}>
              <aside className="sidebar">
                <div className="sidebar-head">
                  <strong>メニュー</strong>
                </div>
                <div className="drawer-nav">
                  {PAGES.map((p) => (
                    <button
                      key={p.key}
                      className="btn mini drawer-nav-btn"
                      onClick={() => goTo(p.key)}
                    >
                      {p.label} へ
                    </button>
                  ))}
                </div>
                <div className="sidebar-head" style={{ marginTop: 10 }}>
                  <strong>保存済みの卓</strong>
                  <button className="btn mini btn-primary" onClick={newSession}>
                    ＋ 新規
                  </button>
                </div>
                {playIndex.length === 0 ? (
                  <p className="muted" style={{ padding: "8px 4px" }}>
                    保存済みの卓はありません。
                  </p>
                ) : (
                  tableList
                )}
                <div className="auth-section">
                  <button
                    className="btn mini"
                    style={{ width: "100%", marginBottom: 8 }}
                    onClick={() => setShowSettings(true)}
                  >
                    ⚙ 設定
                  </button>
                  <AuthControl />
                </div>
              </aside>
              <button
                className="drawer-close"
                onClick={() => setDrawerOpen(false)}
                title="閉じる"
                aria-label="メニューを閉じる"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {viewing && (
          <Viewer
            item={viewing.item}
            entry={viewing.entry}
            onClose={() => setViewing(null)}
          />
        )}
        {showSettings && <SoundSettings onClose={() => setShowSettings(false)} />}
        <Toasts />
      </div>
    );
  }

  /* ===== 通常シェル(Steam 風: 上部ナビ + 全幅ページ + 下部バー) ===== */
  return (
    <div className="app-shell">
      {/* 上部ナビ */}
      <header className="topbar">
        <span
          className="topbar-brand"
          onClick={() => goTo("store")}
          title="ストアのトップへ"
        >
          <img src={brandLogo} alt="パラDa-iCE" className="topbar-logo" />
        </span>
        <nav className="topnav" role="tablist">
          {PAGES.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={page === p.key}
              className={`topnav-link ${page === p.key ? "active" : ""}`}
              onClick={() => goTo(p.key)}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <button
            className="btn mini"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "ライトテーマに切替" : "ダークテーマに切替"}
          >
            {theme === "dark" ? "☀" : "🌙"}
          </button>
          <button
            className="btn mini"
            onClick={() => setShowSettings(true)}
            title="設定"
          >
            ⚙
          </button>
          <AuthControl />
        </div>
      </header>

      {/* ページ本体 */}
      <main className="app-main">
        {page === "store" && (
          <StorePanel
            homeSignal={storeHomeSig}
            onGoLibrary={() => setPage("library")}
          />
        )}

        {page === "library" && (
          <LibraryPage onView={(item, entry) => setViewing({ item, entry })} />
        )}

        {page === "play" && (
          <div className="page">
            <div className="page-wrap">
              <h2 className="page-title">🎲 セッション卓</h2>
              <div className="tables-top">
                <button className="btn btn-primary tables-new" onClick={newSession}>
                  ＋ 新しい卓を作る（GM）
                </button>
                <div className="net-join">
                  <strong className="net-join-title">
                    🌐 ネットワークで参加
                  </strong>
                  <input
                    className="input"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="参加コード（例: ABC234）"
                    maxLength={6}
                  />
                  <input
                    className="input"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="あなたの名前"
                    onKeyDown={(e) => e.key === "Enter" && joinByCode()}
                  />
                  <button
                    className="btn mini btn-primary"
                    onClick={joinByCode}
                    disabled={!joinCode.trim() || !joinName.trim()}
                  >
                    参加する
                  </button>
                </div>
              </div>

              <h3 className="page-sub">保存済みの卓</h3>
              {playIndex.length === 0 ? (
                <p className="muted">
                  作った卓がここに並びます。「＋新しい卓を作る」で始めましょう。
                </p>
              ) : (
                tableList
              )}
              {error && (
                <p className="tag fail" style={{ marginTop: 8, display: "block" }}>
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        {page === "characters" && (
          <div className="chars-page">
            <aside className="chars-list">
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
                charList
              )}
              {error && (
                <p className="tag fail" style={{ marginTop: 8, display: "block" }}>
                  {error}
                </p>
              )}
            </aside>
            <section className="chars-editor">
              {activeGeneric ? (
                <GenericSheetEditor
                  key={activeGeneric.key}
                  def={activeGeneric.def}
                  initial={activeGeneric.sheet}
                  onSaved={handleGenericSaved}
                />
              ) : (
                <CharacterSheet
                  key={active.key}
                  initialSheet={active.sheet}
                  onSaved={handleSaved}
                />
              )}
            </section>
          </div>
        )}

        {page === "builder" && (
          <SystemBuilder onCreateCharacter={newGenericCharacter} />
        )}
      </main>

      {/* 下部バー(Steam 風) */}
      <footer className="bottombar">
        <button className="bottombar-btn" onClick={newSession}>
          ＋ 新しい卓
        </button>
        <button className="bottombar-btn" onClick={() => goTo("library")}>
          📚 ダウンロードの管理
        </button>
        <button
          className="bottombar-btn"
          onClick={() => setShowSettings(true)}
        >
          ⚙ 設定
        </button>
      </footer>

      {/* アプリ内ビューア(購入物の閲覧)。上に重ねる。*/}
      {viewing && (
        <Viewer
          item={viewing.item}
          entry={viewing.entry}
          onClose={() => setViewing(null)}
        />
      )}

      {showSettings && <SoundSettings onClose={() => setShowSettings(false)} />}
      <Toasts />
    </div>
  );
}
