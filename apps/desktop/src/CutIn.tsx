import { useEffect, useRef } from "react";
import type { CutIn } from "@trpg/core";

/**
 * カットイン演出。登録した画像をクリックで画面に走らせる(非ブロッキング)。
 * 画像は data URL で .play に保存し、卓と一緒に持ち運べる。
 */

const CUTIN_MS = 2400;

/** サイドバーの管理パネル(追加 / 一覧 / 発火 / 削除)。 */
export function CutInPanel({
  cutins,
  onAdd,
  onRemove,
  onFire,
}: {
  cutins: CutIn[];
  onAdd: (name: string, image: string) => void;
  onRemove: (id: string) => void;
  onFire: (cutin: CutIn) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onAdd(file.name.replace(/\.[^.]+$/, ""), reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="cutin-panel">
      {cutins.length === 0 ? (
        <p className="palette-empty muted">
          画像を追加して、クリックで画面に流します(決め台詞・登場演出など)。
        </p>
      ) : (
        <div className="cutin-list">
          {cutins.map((c) => (
            <div key={c.id} className="cutin-item">
              <button
                className="cutin-fire"
                onClick={() => onFire(c)}
                title={`「${c.name}」を再生`}
              >
                <img src={c.image} alt={c.name} />
                <span className="cutin-name">{c.name}</span>
              </button>
              <button
                className="cutin-del"
                onClick={() => onRemove(c.id)}
                title="削除"
                aria-label={`${c.name} を削除`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        className="btn mini"
        style={{ width: "100%" }}
        onClick={() => fileRef.current?.click()}
      >
        ＋ 画像を追加
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={pick}
      />
    </div>
  );
}

/** 画面を横切るカットイン本体。再生が終わると onDone。 */
export function CutInOverlay({
  cutin,
  onDone,
}: {
  cutin: CutIn;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, CUTIN_MS);
    return () => window.clearTimeout(t);
  }, [cutin, onDone]);

  return (
    <div className="cutin-overlay" aria-hidden>
      <div className="cutin-band" />
      <img className="cutin-image" src={cutin.image} alt="" />
    </div>
  );
}
