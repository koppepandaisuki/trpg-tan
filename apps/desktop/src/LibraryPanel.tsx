import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabaseConfigured } from "./supabase";
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

  const userId = session?.user.id ?? null;

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
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
