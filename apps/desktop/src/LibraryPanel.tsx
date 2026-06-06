import { useCallback, useEffect, useState } from "react";
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
  PRODUCT_TYPE_LABEL,
  FILE_FORMAT_LABEL,
  AVAILABILITY_LABEL,
} from "./library-remote";

/**
 * 「購入した作品」タブの中身。ログイン中のユーザーの paid 購入を
 * supabase-js(RLS)で取得し、カバー付きカードで一覧する。
 *
 * ダウンロード/閲覧はスライス3・4で追加。ここでは表示と更新のみ。
 */
export function LibraryPanel() {
  const { session, ready } = useAuth();
  const [items, setItems] = useState<RemoteLibraryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ダウンロード関連の状態。
  const [downloaded, setDownloaded] = useState<Record<string, DownloadedEntry>>(
    () => getDownloadedMap(),
  );
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dlError, setDlError] = useState<Record<string, string>>({});

  const userId = session?.user.id ?? null;
  const canUseDownload = isTauri();

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

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyLibrary(userId);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ログイン/ログアウトに追従。ログイン時に自動取得。
  useEffect(() => {
    if (userId) void load();
    else setItems(null);
  }, [userId, load]);

  if (!supabaseConfigured) {
    return (
      <p className="muted lib-note">
        ログイン未設定のため購入ライブラリは使えません。
      </p>
    );
  }
  if (!ready) return <p className="muted lib-note">…</p>;

  if (!session) {
    return (
      <div className="lib-empty">
        <p className="muted">
          ログインすると、購入した作品がここに表示されます。
        </p>
        <p className="muted" style={{ fontSize: 11 }}>
          左下の「Google でログイン」から。
        </p>
      </div>
    );
  }

  return (
    <div className="lib-remote">
      <div className="lib-remote-head">
        <span className="muted" style={{ fontSize: 11 }}>
          {items ? `${items.length} 件` : ""}
        </span>
        <button
          className="btn mini"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "更新中…" : "更新"}
        </button>
      </div>

      {error && <p className="tag fail lib-note">{error}</p>}

      {loading && items === null && (
        <p className="muted lib-note">読み込み中…</p>
      )}

      {items && items.length === 0 && (
        <p className="muted lib-note">
          まだ購入した作品はありません。ストアで購入するとここに並びます。
        </p>
      )}

      {items && items.length > 0 && (
        <ul className="lib-list">
          {items.map((it) => (
            <li
              key={it.purchaseId}
              className="lib-card work-card"
              title={it.title}
            >
              <div className="lib-thumb">
                {it.coverUrl ? (
                  <img src={it.coverUrl} alt="" loading="lazy" />
                ) : (
                  <span>◆</span>
                )}
              </div>
              <div className="lib-meta">
                <span className="lib-name">{it.title}</span>
                <span className="lib-sys">
                  {PRODUCT_TYPE_LABEL[it.productType] ?? it.productType}
                  {it.creator.displayName ? ` · ${it.creator.displayName}` : ""}
                </span>
                <span className="work-badges">
                  <span className="work-badge">
                    {FILE_FORMAT_LABEL[it.fileFormat] ?? it.fileFormat}
                  </span>
                  {it.availability !== "available" && (
                    <span className="work-badge warn">
                      {AVAILABILITY_LABEL[it.availability]}
                    </span>
                  )}
                  {downloaded[it.productId] && (
                    <span className="work-badge done">DL済み</span>
                  )}
                </span>

                {canUseDownload && it.availability === "available" && (
                  <div className="work-actions">
                    {downloaded[it.productId] ? (
                      <>
                        <button
                          className="btn mini"
                          onClick={() => void handleReveal(it.productId)}
                        >
                          場所を開く
                        </button>
                        <button
                          className="btn mini"
                          disabled={busy[it.productId]}
                          onClick={() => void handleDownload(it)}
                          title="もう一度ダウンロードして上書き"
                        >
                          {busy[it.productId] ? "DL中…" : "再DL"}
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn mini btn-primary"
                        disabled={busy[it.productId]}
                        onClick={() => void handleDownload(it)}
                      >
                        {busy[it.productId]
                          ? "ダウンロード中…"
                          : "ダウンロード"}
                      </button>
                    )}
                  </div>
                )}

                {dlError[it.productId] && (
                  <span
                    className="tag fail"
                    style={{ fontSize: 10, marginTop: 4 }}
                  >
                    {dlError[it.productId]}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
