import { useCallback, useEffect, useMemo, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
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

/**
 * ライブラリ(Steam のライブラリ画面風)。
 *  - 左サイドバー: 持っている作品の一覧。ジャンル(種別)ごとに折りたたみ、
 *    (DL済み/総数) のカウント付き。検索で絞り込み
 *  - メイン: 「新着」「すぐ遊べる(DL済み)」シェルフ + 全作品グリッド。
 *    作品を選ぶと詳細(DL / 開く / 場所を開く)
 */

const GENRE_ORDER: RemoteProductType[] = [
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
}: {
  onView?: (item: RemoteLibraryItem, entry: DownloadedEntry) => void;
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
    } catch (e) {
      setDlError((er) => ({
        ...er,
        [it.productId]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy((b) => ({ ...b, [it.productId]: false }));
    }
  }

  async function handleReveal(productId: string) {
    const entry = downloaded[productId];
    if (!entry) return;
    try {
      await revealItemInDir(entry.path);
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
              className="btn btn-primary"
              onClick={() => onView?.(it, entry)}
            >
              ▶ 開く
            </button>
            <button className="btn" onClick={() => void handleReveal(it.productId)}>
              場所を開く
            </button>
            <button
              className="btn"
              disabled={busy[it.productId]}
              onClick={() => void handleDownload(it)}
              title="もう一度ダウンロードして上書き"
            >
              {busy[it.productId] ? "DL中…" : "再DL"}
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary"
            disabled={busy[it.productId]}
            onClick={() => void handleDownload(it)}
          >
            {busy[it.productId] ? "ダウンロード中…" : "⬇ ダウンロード"}
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
            className="btn mini"
            onClick={() => void load()}
            disabled={loading}
            title="購入情報を再取得"
          >
            {loading ? "…" : "⟳"}
          </button>
        </div>
        <button
          className={`libside-home ${selected ? "" : "active"}`}
          onClick={() => setSelectedId(null)}
        >
          🏠 ホーム
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
              <p className="muted" style={{ padding: 24 }}>
                読み込み中…
              </p>
            )}

            {items && items.length === 0 && (
              <div className="pclient-card" style={{ margin: "40px auto" }}>
                <p>まだ購入した作品はありません。</p>
                <p className="muted" style={{ fontSize: 12 }}>
                  ストアで購入すると、ここに並びます。
                </p>
              </div>
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
                        if (entry) onView?.(it, entry);
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
