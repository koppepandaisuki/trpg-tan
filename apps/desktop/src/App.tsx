import { lazy, Suspense, useEffect, useState } from "react";
import {
  createScene,
  type CharacterSheet as Sheet,
  type PlayScene,
  type SystemDef,
  type GenericSheet,
} from "@trpg/core";
import {
  Moon,
  Sun,
  Settings,
  Plus,
  FolderDown,
  Dices,
  DoorOpen,
  BookOpen,
  Users,
  Play,
  KeyRound,
  LayoutGrid,
  List,
  Clock,
  ChevronRight,
  CalendarClock,
  ScrollText,
  Wrench,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AuthControl } from "./AuthControl";
import { AccountMenu } from "./AccountMenu";
import { AmbientBg } from "./AmbientBg";
import { Viewer } from "./Viewer";
import { StorePanel } from "./StorePanel";
import { findSystem } from "./systems-store";
import { Settings as SettingsScreen, type SettingsTab } from "./Settings";
import { Toasts, toast } from "./Toasts";
import { LoginGate } from "./LoginGate";
import { EmptyState } from "./EmptyState";
import { FriendsButton } from "./FriendsPanel";
import { initDeepLinkAuth } from "./auth";
import { initDeepLinkPurchase } from "./deep-link-purchase";
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
import { makePlayThumbnail, downscaleImage } from "./play-thumb";
import { NewCharacterMenu } from "./NewCharacterMenu";
import diceMark from "./assets/dice.png";

// 日程調整ツール(web)の作成ページ。ロビーから既定ブラウザで開く。匿名でも作れる
// (web 側がログイン任意)ため、ここはアプリの Bearer を介さず URL を開くだけ。
const SCHEDULE_WEB_BASE = (
  import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

// 重い画面は遅延読込にして初期バンドルを小さくし、起動を速くする。ストアは初期
// 表示なので即時読込のまま。PLAY 一式・ビルダー・ライブラリ・キャラシートは、その
// 画面を開いたときに別チャンクとして読み込まれる(Suspense でローダー表示)。
const PlayTable = lazy(() =>
  import("./PlayTable").then((m) => ({ default: m.PlayTable })),
);
const PlayClient = lazy(() =>
  import("./PlayClient").then((m) => ({ default: m.PlayClient })),
);
const SystemBuilder = lazy(() =>
  import("./SystemBuilder").then((m) => ({ default: m.SystemBuilder })),
);
const ScenarioBuilder = lazy(() =>
  import("./ScenarioBuilder").then((m) => ({ default: m.ScenarioBuilder })),
);
const LibraryPage = lazy(() =>
  import("./LibraryPage").then((m) => ({ default: m.LibraryPage })),
);
const CharacterSheet = lazy(() =>
  import("./CharacterSheet").then((m) => ({ default: m.CharacterSheet })),
);
const GenericSheetEditor = lazy(() =>
  import("./GenericSheetEditor").then((m) => ({ default: m.GenericSheetEditor })),
);

/** 遅延読込の待機中に出すローダー(画面切替の一瞬だけ)。 */
function ScreenLoading() {
  return (
    <div className="screen-loading" role="status" aria-label="読み込み中">
      <span className="screen-loading-ring" />
    </div>
  );
}

type Page = "store" | "library" | "play" | "characters" | "builder";
type Viewing = { item: RemoteLibraryItem; entry: DownloadedEntry };
type Session = { scene: PlayScene; path: string | null };

const PAGES: { key: Page; label: string }[] = [
  { key: "store", label: "ストア" },
  { key: "library", label: "ライブラリ" },
  { key: "play", label: "PLAY" },
  { key: "characters", label: "キャラクター" },
  { key: "builder", label: "ビルダー" },
];

/** 新しい卓を作る流れ(モックアップのステップ表示用・静的)。 */
const LOBBY_STEPS: { icon: typeof DoorOpen; label: string }[] = [
  { icon: DoorOpen, label: "ルーム作成" },
  { icon: BookOpen, label: "ルール選択" },
  { icon: Users, label: "招待・募集" },
  { icon: Play, label: "プレイ開始" },
];

/** 組み込みシステム id の表示名(なければ findSystem → id フォールバック)。 */
const BUILTIN_SYS_LABEL: Record<string, string> = {
  coc7: "クトゥルフ神話TRPG(第7版)",
  coc6: "クトゥルフ神話TRPG(第6版)",
  "": "汎用",
};
function tableSystemLabel(id: string): string {
  return BUILTIN_SYS_LABEL[id] ?? findSystem(id)?.name ?? id ?? "汎用";
}

/** ISO 日時を「たった今 / N分前 / N時間前 / 昨日 / N日前 / 日付」に。 */
function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d === 1) return "昨日";
  if (d < 7) return `${d}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

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
  // ビルダー(作成ハブ)のモード: システム作成 / シナリオ作成。
  const [builderMode, setBuilderMode] = useState<"system" | "scenario">(
    "scenario",
  );
  // PLAY 中にキャラシを卓の上へオーバーレイ表示する(卓は閉じない)。
  const [charOverlay, setCharOverlay] = useState(false);
  const [library, setLibrary] = useState<LibraryEntry[]>(() => getLibrary());
  const [active, setActive] = useState<{
    sheet: Sheet | null;
    key: string;
    path?: string | null;
  }>(() => ({ sheet: null, key: "new-0" }));
  // カスタムシステムの汎用シート編集(非 null のとき CoC エディタの代わりに表示)。
  const [activeGeneric, setActiveGeneric] = useState<{
    def: SystemDef | null;
    sheet: GenericSheet | null;
    key: string;
    path?: string | null;
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
  // PLAY を背面に退避中か(卓は閉じず=接続を保ったまま、アプリ内を移動できる)。
  const [playMinimized, setPlayMinimized] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(
    () => localStorage.getItem("trpg.net.name.v1") ?? "",
  );
  // セッション卓ロビーの保存済み卓の表示(グリッド / リスト)。
  const [lobbyView, setLobbyView] = useState<"grid" | "list">("grid");
  // 効果音などの設定モーダル。
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  function openSettings(tab: SettingsTab = "account") {
    setSettingsTab(tab);
    setShowSettings(true);
  }
  // PLAY 中のドロワー(☰)。卓を抜けずにナビへアクセスする。
  const [drawerOpen, setDrawerOpen] = useState(false);
  // ロゴ / ストアタブのクリックでストアをホーム画面に巻き戻すシグナル。
  const [storeHomeSig, setStoreHomeSig] = useState(0);
  // ライブラリ強制リフレッシュ(paradice://purchase/complete などで +1)。
  const [librarySig, setLibrarySig] = useState(0);
  // プラン再取得シグナル(paradice://subscription/complete などで +1)。
  const [planSig, setPlanSig] = useState(0);
  // テーマ(ライト / ダーク)。<html data-theme> で CSS 変数を切替。PLAY 中も従う。
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

  // paradice://purchase/complete|cancel を購読。決済完了でライブラリへ
  // 自動移動 + 強制リフレッシュ。webhook 反映に数秒の遅延があるため
  // 初回 fetch で出なくても再度ボタン押下で再取得できる。
  useEffect(() => {
    if (!isTauri()) return;
    void initDeepLinkPurchase({
      onComplete: () => {
        toast("✅ 購入が完了しました。ライブラリで開けます");
        setPage("library");
        setLibrarySig((n) => n + 1);
        // webhook 反映ラグを吸収して 4 秒後にもう一度。
        window.setTimeout(() => setLibrarySig((n) => n + 1), 4000);
      },
      onCancel: () => {
        toast("購入はキャンセルされました");
      },
      onSubscriptionComplete: ({ plan }) => {
        const label = plan === "pro" ? "Pro" : "プレイ";
        toast(`✅ ${label}プランが有効になりました`);
        setPlanSig((n) => n + 1);
        // webhook 反映ラグを吸収して 4 秒後にもう一度。
        window.setTimeout(() => setPlanSig((n) => n + 1), 4000);
      },
    });
  }, []);

  // テーマ適用。PLAY 中もユーザー設定(ライト / ダーク)に従う。
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  /** ページ遷移(セッション/参加を畳む)。ストアは常にホームから。 */
  function goTo(p: Page) {
    // PLAY 中は卓を閉じず背面へ退避(接続を保ったままアプリ内を移動)。
    if (session || joining) {
      setPlayMinimized(true);
    }
    setPage(p);
    if (p === "store") setStoreHomeSig((n) => n + 1);
    // PLAY を開くたびに卓一覧を最新化(ライブラリから取り込んだ卓も一覧に出す)。
    if (p === "play") setPlayIndex(getPlayIndex());
    setDrawerOpen(false);
    setError(null);
  }

  /** 退避中の PLAY を前面に戻す。 */
  function resumePlay() {
    setPlayMinimized(false);
    setDrawerOpen(false);
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
    setPlayMinimized(false);
    setDrawerOpen(false);
    setError(null);
  }

  /** シナリオ作成の「卓ごと編集」から、同じシナリオ(卓)を卓エディタで開く。 */
  function openSessionFromScene(scene: PlayScene, path: string | null) {
    setSession({ scene, path });
    setJoining(null);
    setPlayMinimized(false);
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
    setPlayMinimized(false);
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
      setPlayMinimized(false);
      setDrawerOpen(false);
      setError(null);
    } catch (e) {
      setError(`卓を開けませんでした(移動/削除の可能性): ${String(e)}`);
    }
  }

  /**
   * フルパッケージ(卓入り)をライブラリで開いたとき、取り込んだ卓(.play)を
   * そのまま PLAY 画面で開く。取り込み済みの卓は PLAY ロビーの「保存済みの卓」
   * 一覧にも出るので、あとから一覧で開き直せる。
   */
  async function openPackPlay(playPath: string) {
    setPlayIndex(getPlayIndex()); // 取り込んだ卓をロビー一覧へ反映
    if (!isTauri()) {
      setError("卓を開くにはデスクトップアプリが必要です");
      return;
    }
    try {
      const scene = await readPlayFromPath(playPath);
      setSession({ scene, path: playPath });
      setJoining(null);
      setPlayMinimized(false);
      setDrawerOpen(false);
      setPage("play");
      setError(null);
    } catch (e) {
      setError(`卓を開けませんでした: ${String(e)}`);
    }
  }

  async function handlePlayPersist(scene: PlayScene, path: string) {
    // 保存時にシステム名を解決して持たせる(全システムでカードに正しく表示するため)
    // と、前景/背景からサムネイルを生成してカードに出す。
    const systemLabel = tableSystemLabel(scene.systemId);
    const thumbnail = await makePlayThumbnail(scene);
    setPlayIndex((idx) =>
      upsertPlayIndex(
        idx,
        buildPlayIndexEntry(scene, path, { systemLabel, thumbnail }),
      ),
    );
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

  /** キャラクター保管所などから取り込んだシートをエディタで開く(未保存)。 */
  function openImportedSheet(sheet: Sheet) {
    setSession(null);
    setJoining(null);
    setPage("characters");
    setDrawerOpen(false);
    setActiveGeneric(null);
    setActive({ sheet, key: `import-${Date.now()}` });
    setError(null);
    toast(`📥 「${sheet.name}」を取り込みました。保存で確定します`);
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
          path: entry.path, // 上書き保存先
        });
      } else {
        setActiveGeneric(null);
        setActive({ sheet, key: `${entry.id}-${Date.now()}`, path: entry.path });
      }
      setError(null);
    } catch (e) {
      setError(`開けませんでした(移動/削除された可能性): ${String(e)}`);
    }
  }

  // 索引のサムネはポートレート原寸ではなく小さく縮小して載せる(localStorage の
  // 容量超過で索引ごと保存に失敗し、PLAY からキャラを開けなくなるのを防ぐ)。
  async function libThumb(image?: string | null): Promise<string | null> {
    if (!image) return null;
    return (await downscaleImage(image, 128)) ?? null;
  }

  async function handleSaved(sheet: Sheet, path: string) {
    const thumbnail = await libThumb(sheet.image);
    setLibrary((lib) =>
      upsertEntry(lib, { ...buildEntry(sheet, path), thumbnail }),
    );
  }

  async function handleGenericSaved(sheet: GenericSheet, path: string) {
    const thumbnail = await libThumb(sheet.image);
    setLibrary((lib) =>
      upsertEntry(lib, { ...buildGenericEntry(sheet, path), thumbnail }),
    );
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

  /* ===== キャラクター編集パネル(キャラページ + PLAY オーバーレイで再利用) ===== */
  const charactersPanel = (
    <div className="chars-page">
      <aside className="chars-list">
        <div className="sidebar-head">
          <strong>キャラクター</strong>
          <NewCharacterMenu
            onNewCoC={newCharacter}
            onNewGeneric={newGenericCharacter}
            onImported={openImportedSheet}
          />
        </div>
        {library.length === 0 ? (
          <p className="muted" style={{ padding: "8px 4px" }}>
            保存したキャラがここに並びます。「＋新規」からシステム（CoC・プリセット・自作）を選んで作成できます。
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
            initialPath={activeGeneric.path}
            onSaved={handleGenericSaved}
          />
        ) : (
          <CharacterSheet
            key={active.key}
            initialSheet={active.sheet}
            initialPath={active.path}
            onSaved={handleSaved}
          />
        )}
      </section>
    </div>
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

  /* ===== PLAY レイヤ(卓 / ネット参加)。卓を閉じるまでマウントし続け、退避中
     (playMinimized)は背面に隠す = 接続を保ったままアプリ内を移動できる。 ===== */
  const playLayer =
    session || joining ? (
      <div className={`play-layer${playMinimized ? " min" : ""}`}>
        <Suspense fallback={<ScreenLoading />}>
          {session ? (
            <PlayTable
              key={session.scene.id}
              initial={session.scene}
              path={session.path}
              onClose={() => {
                setSession(null);
                setCharOverlay(false);
                setPlayMinimized(false);
              }}
              onPersist={handlePlayPersist}
              onMenu={() => setDrawerOpen(true)}
              onCharacters={() => setCharOverlay(true)}
            />
          ) : (
            <PlayClient
              key={`${joining!.code}-${joining!.name}`}
              code={joining!.code}
              name={joining!.name}
              onClose={() => {
                setJoining(null);
                setCharOverlay(false);
                setPlayMinimized(false);
              }}
              onOpenCharacters={() => setCharOverlay(true)}
            />
          )}
        </Suspense>

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
                    onClick={() => openSettings("account")}
                  >
                    ⚙ 設定
                  </button>
                  <button
                    className="btn mini"
                    style={{ width: "100%", marginBottom: 8 }}
                    onClick={() => openSettings("report")}
                    title="不具合をコメントして、ログ・端末情報・PLAY の文脈つきで開発者へ送ります"
                  >
                    🐞 不具合報告
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

        {/* PLAY 中のキャラシ オーバーレイ(卓は閉じない) */}
        {charOverlay && (
          <div className="play-charoverlay" role="dialog" aria-modal="true">
            <div className="play-charoverlay-bar">
              <strong>キャラクター</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                卓は開いたままです
              </span>
              <span style={{ flex: 1 }} />
              <button
                className="btn mini btn-primary"
                onClick={() => setCharOverlay(false)}
              >
                卓に戻る
              </button>
            </div>
            <div className="play-charoverlay-body">
              <Suspense fallback={<ScreenLoading />}>{charactersPanel}</Suspense>
            </div>
          </div>
        )}
      </div>
    ) : null;

  /* ===== 通常シェル(Steam 風: 上部ナビ + 全幅ページ + 下部バー)。
     PLAY レイヤは常にこの上に重ね、退避中だけ隠す。 ===== */
  return (
    <div className="app-shell">
      {/* 背景の控えめな装飾(サイコロ・キラキラ)。PLAY レイヤが前面を覆うので
          卓の上には出ない。 */}
      <AmbientBg />
      {/* 上部ナビ */}
      <header className="topbar">
        <span
          className="topbar-brand"
          onClick={() => goTo("store")}
          title="ストアのトップへ"
        >
          <img src={diceMark} alt="" className="brand-dice" aria-hidden />
          <span className="brand-word" aria-label="パラDa-iCE">
            <span className="brand-para">パラ</span>
            <span className="brand-daice">Da-iCE</span>
          </span>
        </span>
        <nav className="topnav" role="tablist">
          {PAGES.map((p) => {
            const isPlay = p.key === "play";
            return (
              <button
                key={p.key}
                role="tab"
                aria-selected={page === p.key}
                className={`topnav-link ${isPlay ? "play" : ""} ${
                  page === p.key ? "active" : ""
                }`}
                onClick={() =>
                  // PLAY タブ: 退避中のセッションがあればそこへ戻す。
                  isPlay && (session || joining) ? resumePlay() : goTo(p.key)
                }
              >
                {p.label}
              </button>
            );
          })}
        </nav>
        <div className="topbar-right">
          <button
            className="btn mini ibtn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "ライトテーマに切替" : "ダークテーマに切替"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <AccountMenu onOpen={() => openSettings("account")} />
        </div>
      </header>

      {/* ページ本体(切替時にフェードイン)。 */}
      <main className="app-main">
        <Suspense fallback={<ScreenLoading />}>
        <div className="page-fade" key={page}>
        {page === "store" && (
          <StorePanel
            homeSignal={storeHomeSig}
            onGoLibrary={() => setPage("library")}
          />
        )}

        {page === "library" && (
          <LibraryPage
            onView={(item, entry) => setViewing({ item, entry })}
            onGoStore={() => goTo("store")}
            onOpenPlay={(playPath) => void openPackPlay(playPath)}
            refreshSignal={librarySig}
          />
        )}

        {page === "play" && (
          <div className="page lobby">
            <div className="page-wrap lobby-wrap">
              <header className="lobby-hero">
                <h2 className="lobby-title">
                  セッション卓
                  <span className="lobby-title-en">SESSION LOBBY</span>
                </h2>
                <p className="lobby-sub">
                  TRPG セッションの作成・参加・管理を行います
                </p>
                <button
                  className="btn mini"
                  style={{ marginTop: 12 }}
                  onClick={() =>
                    void openUrl(`${SCHEDULE_WEB_BASE}/schedule/new`)
                  }
                  title="ブラウザで日程調整ページを開きます（参加者はログイン不要で出欠を入れられます）"
                >
                  <CalendarClock size={15} /> 日程調整をつくる
                </button>
              </header>

              <div className="lobby-panels">
                {/* 新しい卓を作る */}
                <section className="lobby-panel lobby-create">
                  <div className="lobby-create-art" aria-hidden>
                    <Dices size={56} />
                  </div>
                  <div className="lobby-create-main">
                    <h3 className="lobby-panel-title">新しい卓を作る</h3>
                    <p className="lobby-panel-desc">
                      オリジナルのセッションを作成して、仲間を招待しよう
                    </p>
                    <div className="lobby-steps">
                      {LOBBY_STEPS.map((s) => (
                        <div className="lobby-step" key={s.label}>
                          <span className="lobby-step-ic">
                            <s.icon size={18} />
                          </span>
                          <span className="lobby-step-label">{s.label}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      className="btn btn-primary lobby-create-btn"
                      onClick={newSession}
                    >
                      <Plus size={16} /> 新しい卓を作る（GM）
                    </button>
                  </div>
                </section>

                {/* 参加コードで参加 */}
                <section className="lobby-panel lobby-join">
                  <h3 className="lobby-panel-title">
                    <KeyRound size={16} className="lobby-panel-title-ic" />
                    参加コードで参加
                    <span className="lobby-en">JOIN BY CODE</span>
                  </h3>
                  <p className="lobby-panel-desc">
                    参加コードを入力して、既存のセッションに参加できます
                  </p>
                  <div className="lobby-joinbox">
                    <label className="lobby-field">
                      <span className="lobby-field-label">
                        参加コード（例: ABC234）
                      </span>
                      <input
                        className="input lobby-code"
                        value={joinCode}
                        onChange={(e) =>
                          setJoinCode(e.target.value.toUpperCase())
                        }
                        placeholder="ABC234"
                        maxLength={6}
                      />
                    </label>
                    <label className="lobby-field">
                      <span className="lobby-field-label">あなたの名前</span>
                      <input
                        className="input"
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        placeholder="プレイヤー名"
                        onKeyDown={(e) => e.key === "Enter" && joinByCode()}
                      />
                    </label>
                    <button
                      className="btn btn-primary lobby-join-btn"
                      onClick={joinByCode}
                      disabled={!joinCode.trim() || !joinName.trim()}
                    >
                      参加する <ChevronRight size={16} />
                    </button>
                  </div>
                </section>
              </div>

              {/* 保存済みの卓 */}
              <section className="lobby-saved">
                <div className="lobby-saved-head">
                  <h3 className="lobby-saved-title">
                    保存済みの卓
                    <span className="lobby-en">SAVED TABLES</span>
                    <span className="lobby-count">{playIndex.length}</span>
                  </h3>
                  <div className="lobby-viewtoggle">
                    <button
                      className={`lobby-vbtn ${lobbyView === "grid" ? "on" : ""}`}
                      onClick={() => setLobbyView("grid")}
                      title="グリッド表示"
                      aria-pressed={lobbyView === "grid"}
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      className={`lobby-vbtn ${lobbyView === "list" ? "on" : ""}`}
                      onClick={() => setLobbyView("list")}
                      title="リスト表示"
                      aria-pressed={lobbyView === "list"}
                    >
                      <List size={15} />
                    </button>
                  </div>
                </div>

                {playIndex.length === 0 ? (
                  <EmptyState
                    title="まだ卓がありません"
                    hint="卓を作って、キャラを呼んで、ダイスを振りましょう。"
                    action={{ label: "＋ 新しい卓を作る", onClick: newSession }}
                  />
                ) : (
                  <div className={`lobby-grid ${lobbyView}`}>
                    {playIndex.map((e) => (
                      <div
                        key={e.id}
                        className="lobby-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => void openSession(e)}
                        onKeyDown={(ev) =>
                          ev.key === "Enter" && void openSession(e)
                        }
                        title={e.path}
                      >
                        <div className="lobby-card-cover">
                          <span className="lobby-card-badge">ローカル</span>
                          {e.thumbnail ? (
                            <img
                              className="lobby-card-thumb"
                              src={e.thumbnail}
                              alt=""
                            />
                          ) : (
                            <Dices className="lobby-card-art" size={40} />
                          )}
                          <button
                            className="lobby-card-del"
                            title="一覧から外す(ファイルは消えません)"
                            aria-label="一覧から外す"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              removeSessionEntry(e.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <div className="lobby-card-body">
                          <h4 className="lobby-card-title">{e.title}</h4>
                          <p className="lobby-card-sys">
                            {e.systemLabel ?? tableSystemLabel(e.systemId)}
                          </p>
                          {e.tags && e.tags.length > 0 && (
                            <div className="lobby-card-tags">
                              {e.tags.slice(0, 4).map((t) => (
                                <span key={t} className="lobby-card-tag">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="lobby-card-stats">
                            <span title="駒数">
                              <Users size={13} /> {e.panelCount} 駒
                            </span>
                            <span title="最終更新">
                              <Clock size={13} /> {relTime(e.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {error && (
                <p className="tag fail" style={{ marginTop: 8, display: "block" }}>
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        {page === "characters" && charactersPanel}

        {page === "builder" && (
          <div className="builder-hub">
            <div className="bhub-bar">
              <button
                className={`bhub-tab ${builderMode === "scenario" ? "on" : ""}`}
                onClick={() => setBuilderMode("scenario")}
              >
                <ScrollText size={16} /> シナリオを作る
              </button>
              <button
                className={`bhub-tab ${builderMode === "system" ? "on" : ""}`}
                onClick={() => setBuilderMode("system")}
              >
                <Wrench size={16} /> システムを作る
              </button>
            </div>
            <div className="bhub-content">
              {builderMode === "system" ? (
                <SystemBuilder onCreateCharacter={newGenericCharacter} />
              ) : (
                <ScenarioBuilder
                  index={playIndex}
                  onPersist={handlePlayPersist}
                  onRemove={removeSessionEntry}
                  onOpenTable={openSessionFromScene}
                />
              )}
            </div>
          </div>
        )}
        </div>
        </Suspense>
      </main>

      {/* 下部バー(Steam 風) */}
      <footer className="bottombar">
        <button className="bottombar-btn ibtn" onClick={newSession}>
          <Plus size={14} /> 新しい卓
        </button>
        <button className="bottombar-btn ibtn" onClick={() => goTo("library")}>
          <FolderDown size={14} /> ダウンロードの管理
        </button>
        <span className="bottombar-right">
          <button
            className="bottombar-btn ibtn"
            onClick={() => openSettings("account")}
          >
            <Settings size={14} /> 設定
          </button>
          <FriendsButton
            onTableInvite={(code) => {
              // 通知から「この卓に入る」を押されたら参加コード欄に流す。
              setJoinCode(code);
              goTo("play");
              toast(`参加コード ${code} を入力欄にセットしました`);
            }}
          />
        </span>
      </footer>

      {/* PLAY レイヤ(卓が開いている間は常にマウント。退避中は CSS で隠す)。 */}
      {playLayer}

      {/* 退避中の戻り口: いつでもセッションに戻れるフローティングボタン。 */}
      {(session || joining) && playMinimized && (
        <button
          className="play-resume-chip"
          onClick={resumePlay}
          title="進行中のセッションに戻る"
        >
          <Dices size={16} /> セッションに戻る
        </button>
      )}

      {/* アプリ内ビューア(購入物の閲覧)。上に重ねる。*/}
      {viewing && (
        <Viewer
          item={viewing.item}
          entry={viewing.entry}
          onClose={() => setViewing(null)}
        />
      )}

      {showSettings && (
        <SettingsScreen
          initialTab={settingsTab}
          theme={theme}
          onToggleTheme={() =>
            setTheme((t) => (t === "dark" ? "light" : "dark"))
          }
          onClose={() => setShowSettings(false)}
          planSig={planSig}
        />
      )}
      <Toasts />
      <LoginGate />
    </div>
  );
}
