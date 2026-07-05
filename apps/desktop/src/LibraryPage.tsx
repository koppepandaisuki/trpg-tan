import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Home,
  Play,
  Download,
  FolderOpen,
  RefreshCw,
  Package,
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { exists } from "@tauri-apps/plugin-fs";
import { importPackFromFile, importPackFromPath } from "./pack";
import { useAuth } from "./useAuth";
import { supabaseConfigured } from "./supabase";
import { isTauri } from "./storage";
import { downloadToLibrary } from "./download";
import {
  getDownloadedMap,
  markDownloaded,
  type DownloadedEntry,
} from "./downloaded";
import {
  fetchMyLibrary,
  type RemoteLibraryItem,
  type RemoteProductType,
  PRODUCT_TYPE_LABEL,
  FILE_FORMAT_LABEL,
  AVAILABILITY_LABEL,
} from "./library-remote";
import { toast } from "./Toasts";
import { SkelStrip } from "./Skeleton";
import { EmptyState } from "./EmptyState";

/**
 * ライブラリ(Steam のライブラリ画面風)。
 *  - 左サイドバー: 持っている作品の一覧。ジャンル(種別)ごとに折りたたみ、
 *    (DL済み/総数) のカウント付き。検索で絞り込み
 *  - メイン: 「新着」「すぐ遊べる(DL済み)」シェルフ + 全作品グリッド。
 *    作品を選ぶと詳細(DL / 開く / 場所を開く)
 */

const GENRE_ORDER: RemoteProductType[] = [
  "full_package",
  "scenario",
  "rulebook",
  "character_art",
  "map",
  "bgm_audio",
];

/** Steam 風の相対日付ラベル(新着シェルフ用)。 */
function relDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (days <= 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return "今週";
  if (days < 14) return "1週間前";
  return d.toLocaleDateString("ja-JP");
}

export function LibraryPage({
  onView,
  onGoStore,
  onOpenPlay,
  refreshSignal,
}: {
  onView?: (item: RemoteLibraryItem, entry: DownloadedEntry) => void;
  /** 空状態の「ストアを見る」(App がページ遷移)。 */
  onGoStore?: () => void;
  /**
   * フルパッケージ(卓入り)を開いたとき、取り込んだ卓(.play)をそのまま PLAY で
   * 開くための導線。引数は取り込んだ卓の絶対パス。
   */
  onOpenPlay?: (playPath: string) => void;
  /** 親から購入完了など外部イベントで再 fetch させたい時にインクリメント。 */
  refreshSignal?: number;
}) {
  const { session, ready } = useAuth();
  const [items, setItems] = useState<RemoteLibraryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [downloaded, setDownloaded] = useState<Record<string, DownloadedEntry>>(
    () => getDownloadedMap(),
  );
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dlError, setDlError] = useState<Record<string, string>>({});

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  /** .paradice パッケージを取り込む(システム/シナリオ/キャラをローカル展開)。 */
  async function handleImportPack() {
    setImporting(true);
    try {
      const res = await importPackFromFile();
      if (res) {
        const parts = [
          res.system ? "システム" : "",
          res.scenarios ? `シナリオ${res.scenarios}` : "",
          res.sheets ? `キャラ${res.sheets}` : "",
        ]
          .filter(Boolean)
          .join(" / ");
        toast(`📦 「${res.name}」を取り込みました（${parts || "メタのみ"}）`);
      }
    } catch (e) {
      toast(`取り込みに失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  const userId = session?.user.id ?? null;
  const canUseDownload = isTauri();

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchMyLibrary(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void load();
    else setItems(null);
  }, [userId, load]);

  // 外部(App)から refreshSignal が来たら fetch をやり直す。
  // 例: アプリ内決済後の redice://purchase/complete を受けた時など。
  useEffect(() => {
    if (refreshSignal !== undefined && userId) void load();
  }, [refreshSignal, userId, load]);

  async function handleDownload(it: RemoteLibraryItem) {
    setBusy((b) => ({ ...b, [it.productId]: true }));
    setDlError((e) => {
      const n = { ...e };
      delete n[it.productId];
      return n;
    });
    try {
      const res = await downloadToLibrary(it.productId);
      const entry: DownloadedEntry = {
        productId: it.productId,
        path: res.path,
        relativePath: res.relativePath,
        ext: res.ext,
        bytes: res.bytes,
        downloadedAt: new Date().toISOString(),
      };
      markDownloaded(entry);
      setDownloaded((d) => ({ ...d, [it.productId]: entry }));
      toast(`⬇ 「${it.title}」をダウンロードしました`);
    } catch (e) {
      setDlError((er) => ({
        ...er,
        [it.productId]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy((b) => ({ ...b, [it.productId]: false }));
    }
  }

  /** ダウンロード物がパッケージ(.paradice)か。 */
  const isPackEntry = (e: DownloadedEntry) =>
    e.ext?.toLowerCase() === "paradice" ||
    e.path.toLowerCase().endsWith(".paradice");

  /**
   * 記録された保存先にファイルが無ければ取り直して最新パスに更新する。
   * 旧バージョンで保存した古いパスや、ライブラリ場所の切替・ファイル移動で
   * パスがズレても「開く」が確実に動くようにする(DL は productId 固定で冪等)。
   */
  async function ensureLocalFile(
    it: RemoteLibraryItem,
    entry: DownloadedEntry,
  ): Promise<DownloadedEntry> {
    try {
      if (await exists(entry.path)) return entry;
    } catch {
      // exists 判定に失敗しても取り直しを試みる
    }
    const res = await downloadToLibrary(it.productId);
    const fresh: DownloadedEntry = {
      ...entry,
      path: res.path,
      relativePath: res.relativePath,
      ext: res.ext,
      bytes: res.bytes,
      downloadedAt: new Date().toISOString(),
    };
    markDownloaded(fresh);
    setDownloaded((d) => ({ ...d, [it.productId]: fresh }));
    return fresh;
  }

  /** 「開く」: パッケージなら取り込み(セットアップ無し)、その他は viewer へ。 */
  async function openItem(it: RemoteLibraryItem, entryArg: DownloadedEntry) {
    let entry: DownloadedEntry;
    try {
      entry = await ensureLocalFile(it, entryArg);
    } catch (e) {
      toast(
        `ファイルを開けませんでした(取り直しに失敗): ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }
    if (isPackEntry(entry)) {
      try {
        const res = await importPackFromPath(entry.path);
        // 卓(.play)が入っているフルパッケージは、取り込んだうえで最初の卓を
        // そのまま PLAY で開く(リクエスト: 開いたら PLAY 画面へ直行)。
        if (res.scenes.length > 0 && onOpenPlay) {
          toast(`▶ 「${res.name}」を開きます`);
          onOpenPlay(res.scenes[0].path);
          return;
        }
        const parts = [
          res.system ? "システム" : "",
          res.scenarios ? `シナリオ${res.scenarios}` : "",
          res.sheets ? `キャラ${res.sheets}` : "",
        ]
          .filter(Boolean)
          .join(" / ");
        toast(
          `📦 「${res.name}」を取り込みました（${parts || "メタのみ"}）。上部メニューの「PLAY / ビルダー」で使えます`,
        );
      } catch (e) {
        toast(`取り込みに失敗: ${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }
    onView?.(it, entry);
  }

  async function handleReveal(productId: string, it?: RemoteLibraryItem) {
    const entry = downloaded[productId];
    if (!entry) return;
    try {
      // パスが古い/ファイルが無ければ取り直してから表示する。
      const fresh = it ? await ensureLocalFile(it, entry) : entry;
      await revealItemInDir(fresh.path);
    } catch (e) {
      console.error("[library] reveal failed", e);
    }
  }

  // 検索でサイドバー / グリッドを絞り込み(タイトル / 作者名)。
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = items ?? [];
    if (!q) return list;
    return list.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.creator.displayName.toLowerCase().includes(q),
    );
  }, [items, q]);

  // ジャンル(種別)ごとにグループ化。
  const groups = useMemo(() => {
    const map = new Map<RemoteProductType, RemoteLibraryItem[]>();
    for (const it of filtered) {
      const list = map.get(it.productType) ?? [];
      list.push(it);
      map.set(it.productType, list);
    }
    return GENRE_ORDER.filter((g) => map.has(g)).map((g) => ({
      genre: g,
      items: map.get(g)!,
    }));
  }, [filtered]);

  const selected =
    (items ?? []).find((it) => it.purchaseId === selectedId) ?? null;

  function toggleGroup(g: string) {
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  }

  /* ===== 未ログイン / 未設定 ===== */
  if (!supabaseConfigured) {
    return (
      <div className="page">
        <p className="muted" style={{ padding: 24 }}>
          ログイン未設定のため購入ライブラリは使えません。
        </p>
      </div>
    );
  }
  if (!ready) return <div className="page" />;
  if (!session) {
    return (
      <div className="page libpage-login">
        <div className="pclient-card">
          <p>📚 ログインすると、購入した作品がここに並びます。</p>
          <p className="muted" style={{ fontSize: 12 }}>
            右上の「Google でログイン」から。
          </p>
        </div>
      </div>
    );
  }

  /* ===== 作品詳細(メイン右側) ===== */
  function renderActions(it: RemoteLibraryItem) {
    if (!canUseDownload || it.availability !== "available") return null;
    const entry = downloaded[it.productId];
    return (
      <div className="work-actions">
        {entry ? (
          <>
            <button
              className="btn btn-primary ibtn"
              onClick={() => void openItem(it, entry)}
            >
              {isPackEntry(entry) ? (
                <>
                  <Package size={15} /> 取り込んで使う
                </>
              ) : (
                <>
                  <Play size={15} /> 開く
                </>
              )}
            </button>
            <button
              className="btn ibtn"
              onClick={() => void handleReveal(it.productId, it)}
            >
              <FolderOpen size={15} /> 場所を開く
            </button>
            <button
              className="btn ibtn"
              disabled={busy[it.productId]}
              onClick={() => void handleDownload(it)}
              title="もう一度ダウンロードして上書き"
            >
              <RefreshCw size={14} /> {busy[it.productId] ? "DL中…" : "再DL"}
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary ibtn"
            disabled={busy[it.productId]}
            onClick={() => void handleDownload(it)}
          >
            <Download size={15} />{" "}
            {busy[it.productId] ? "ダウンロード中…" : "ダウンロード"}
          </button>
        )}
      </div>
    );
  }

  const recent = [...(items ?? [])].slice(0, 10); // fetchMyLibrary は paid_at 降順
  const ready2play = (items ?? []).filter((it) => downloaded[it.productId]);
  const dlCount = (list: RemoteLibraryItem[]) =>
    list.filter((it) => downloaded[it.productId]).length;

  return (
    <div className="libpage">
      {/* ===== 左サイドバー: 所持作品の一覧(ジャンル別) ===== */}
      <aside className="libside">
        <div className="libside-top">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 作品・作者を検索"
          />
          <button
            className="btn mini ibtn"
            onClick={() => void load()}
            disabled={loading}
            title="購入情報を再取得"
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
          </button>
          {canUseDownload && (
            <button
              className="btn mini ibtn"
              onClick={() => void handleImportPack()}
              disabled={importing}
              title="パッケージ(.paradice)を取り込む（システム/シナリオ/キャラを展開）"
            >
              <Package size={13} /> {importing ? "取込中…" : "取り込み"}
            </button>
          )}
        </div>
        <button
          className={`libside-home ibtn ${selected ? "" : "active"}`}
          onClick={() => setSelectedId(null)}
        >
          <Home size={14} /> ホーム
        </button>

        <div className="libside-list">
          {items && items.length === 0 && (
            <p className="muted" style={{ padding: "8px 6px", fontSize: 12 }}>
              まだ購入した作品はありません。ストアで探してみましょう。
            </p>
          )}
          {groups.map(({ genre, items: list }) => (
            <div key={genre} className="libgroup">
              <button
                className="libgroup-head"
                onClick={() => toggleGroup(genre)}
                aria-expanded={!collapsed.has(genre)}
              >
                <span className="libgroup-arrow">
                  {collapsed.has(genre) ? "▸" : "▾"}
                </span>
                {PRODUCT_TYPE_LABEL[genre] ?? genre}
                <span className="libgroup-count">
                  ({dlCount(list)}/{list.length})
                </span>
              </button>
              {!collapsed.has(genre) &&
                list.map((it) => (
                  <button
                    key={it.purchaseId}
                    className={`librow ${selectedId === it.purchaseId ? "active" : ""} ${
                      downloaded[it.productId] ? "dl" : ""
                    }`}
                    onClick={() => setSelectedId(it.purchaseId)}
                    title={it.title}
                  >
                    <span className="librow-thumb">
                      {it.coverUrl ? <img src={it.coverUrl} alt="" loading="lazy" /> : "◆"}
                    </span>
                    <span className="librow-name">{it.title}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </aside>

      {/* ===== メイン ===== */}
      <main className="libmain">
        {error && (
          <p className="tag fail" style={{ margin: "12px 16px" }}>
            {error}
          </p>
        )}

        {selected ? (
          /* --- 作品詳細 --- */
          <div className="libdetail">
            <div className="libdetail-cover">
              {selected.coverUrl ? (
                <img src={selected.coverUrl} alt={selected.title} />
              ) : (
                <span className="store-noimg">No Image</span>
              )}
            </div>
            <div className="libdetail-info">
              <h2 className="libdetail-title">{selected.title}</h2>
              <p className="libdetail-creator muted">
                {selected.creator.displayName || "（無名）"}
              </p>
              <div className="work-badges">
                <span className="work-badge">
                  {PRODUCT_TYPE_LABEL[selected.productType] ?? selected.productType}
                </span>
                <span className="work-badge">
                  {FILE_FORMAT_LABEL[selected.fileFormat] ?? selected.fileFormat}
                </span>
                {downloaded[selected.productId] && (
                  <span className="work-badge done">DL済み</span>
                )}
                {selected.availability !== "available" && (
                  <span className="work-badge warn">
                    {AVAILABILITY_LABEL[selected.availability]}
                  </span>
                )}
              </div>

              {renderActions(selected)}

              {dlError[selected.productId] && (
                <p className="tag fail" style={{ fontSize: 11 }}>
                  {dlError[selected.productId]}
                </p>
              )}

              <dl className="store-dl libdetail-meta">
                <dt>購入日</dt>
                <dd>{new Date(selected.paidAt).toLocaleDateString("ja-JP")}</dd>
                <dt>価格</dt>
                <dd>
                  {selected.amountJpy === 0
                    ? "無料"
                    : `¥${selected.amountJpy.toLocaleString("ja-JP")}`}
                </dd>
                {downloaded[selected.productId] && (
                  <>
                    <dt>保存先</dt>
                    <dd className="libdetail-path">
                      {downloaded[selected.productId].path}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </div>
        ) : (
          /* --- ホーム(シェルフ) --- */
          <div className="libhome">
            {loading && items === null && (
              <>
                <SkelStrip count={5} />
                <SkelStrip count={5} />
              </>
            )}

            {items && items.length === 0 && (
              <EmptyState
                title="まだ購入した作品はありません"
                hint="ストアで購入すると、ここに並んですぐ遊べます。"
                action={
                  onGoStore
                    ? { label: "ストアを見る", onClick: onGoStore }
                    : undefined
                }
              />
            )}

            {recent.length > 0 && (
              <section className="libshelf">
                <h3 className="libshelf-title">新着</h3>
                <div className="libshelf-row">
                  {recent.map((it) => (
                    <button
                      key={it.purchaseId}
                      className="libshelf-card"
                      onClick={() => setSelectedId(it.purchaseId)}
                      title={it.title}
                    >
                      <span className="libshelf-when muted">
                        {relDay(it.paidAt)}
                      </span>
                      <span className="libshelf-cover">
                        {it.coverUrl ? (
                          <img src={it.coverUrl} alt="" loading="lazy" />
                        ) : (
                          <span className="store-noimg">No Image</span>
                        )}
                        {downloaded[it.productId] && (
                          <span className="store-owned-chip">DL済み</span>
                        )}
                      </span>
                      <span className="libshelf-name">{it.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {ready2play.length > 0 && (
              <section className="libshelf">
                <h3 className="libshelf-title">すぐ遊べる（ダウンロード済み）</h3>
                <div className="libshelf-row">
                  {ready2play.map((it) => (
                    <button
                      key={it.purchaseId}
                      className="libshelf-card"
                      onClick={() => {
                        const entry = downloaded[it.productId];
                        if (entry) void openItem(it, entry);
                        else setSelectedId(it.purchaseId);
                      }}
                      title={`${it.title} を開く`}
                    >
                      <span className="libshelf-when muted">▶ 開く</span>
                      <span className="libshelf-cover">
                        {it.coverUrl ? (
                          <img src={it.coverUrl} alt="" loading="lazy" />
                        ) : (
                          <span className="store-noimg">No Image</span>
                        )}
                      </span>
                      <span className="libshelf-name">{it.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {filtered.length > 0 && (
              <section className="libshelf">
                <h3 className="libshelf-title">
                  すべての作品{q ? `（「${query.trim()}」で絞り込み）` : ""}
                </h3>
                <div className="libshelf-grid">
                  {filtered.map((it) => (
                    <button
                      key={it.purchaseId}
                      className="libshelf-card"
                      onClick={() => setSelectedId(it.purchaseId)}
                      title={it.title}
                    >
                      <span className="libshelf-cover">
                        {it.coverUrl ? (
                          <img src={it.coverUrl} alt="" loading="lazy" />
                        ) : (
                          <span className="store-noimg">No Image</span>
                        )}
                        {downloaded[it.productId] && (
                          <span className="store-owned-chip">DL済み</span>
                        )}
                      </span>
                      <span className="libshelf-name">{it.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
