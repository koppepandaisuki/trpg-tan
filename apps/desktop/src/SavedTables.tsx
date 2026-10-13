import { Clock, Dices, Users } from "lucide-react";
import type { PlayIndexEntry } from "./play-storage";

/**
 * 保存済みの卓(ローカルの .play 索引)のカード一覧。
 *
 * PLAY ロビー(最近の卓)とライブラリ(すべての卓)で同じ見た目にするための
 * 共通部品。App.tsx のロビーから切り出した(CSS は styles.css の .lobby-*)。
 */
export function SavedTables({
  entries,
  view,
  onOpen,
  onRemove,
  systemLabelOf,
}: {
  entries: PlayIndexEntry[];
  view: "grid" | "list";
  onOpen: (e: PlayIndexEntry) => void;
  /** 一覧から外す(ファイルは消さない)。 */
  onRemove: (id: string) => void;
  /** systemLabel を持たない古い索引向けのフォールバック解決。 */
  systemLabelOf: (systemId: string) => string;
}) {
  return (
    <div className={`lobby-grid ${view}`}>
      {entries.map((e) => (
        <div
          key={e.id}
          className="lobby-card"
          role="button"
          tabIndex={0}
          onClick={() => onOpen(e)}
          onKeyDown={(ev) => ev.key === "Enter" && onOpen(e)}
          title={e.path}
        >
          <div className="lobby-card-cover">
            <span className="lobby-card-badge">ローカル</span>
            {e.thumbnail ? (
              <img className="lobby-card-thumb" src={e.thumbnail} alt="" />
            ) : (
              <Dices className="lobby-card-art" size={40} />
            )}
            <button
              className="lobby-card-del"
              title="一覧から外す(ファイルは消えません)"
              aria-label="一覧から外す"
              onClick={(ev) => {
                ev.stopPropagation();
                onRemove(e.id);
              }}
            >
              ×
            </button>
          </div>
          <div className="lobby-card-body">
            <h4 className="lobby-card-title">{e.title}</h4>
            <p className="lobby-card-sys">
              {e.systemLabel ?? systemLabelOf(e.systemId)}
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
  );
}

/** ISO 日時を「たった今 / N分前 / N時間前 / 昨日 / N日前 / 日付」に。 */
export function relTime(iso: string): string {
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
