import { useRef, useState } from "react";
import type { AssetItem } from "@trpg/core";

/** 盤面ドロップで使う dataTransfer の MIME(中身は {name, image} JSON)。 */
export const ASSET_MIME = "application/x-paradice-asset";

/**
 * アセット(画像素材庫)。卓に画像を登録しておき、
 *   - 盤面へドラッグ&ドロップ → その位置に配置
 *   - サムネをダブルクリック / ▶ → 盤面中央に配置
 * できる。実体は data URL で .play に保存(カットインと同じ方式)。
 */
export function AssetsPanel({
  assets,
  onAdd,
  onRemove,
  onPlace,
  onSetBackground,
}: {
  assets: AssetItem[];
  onAdd: (items: AssetItem[]) => void;
  onRemove: (id: string) => void;
  /** 盤面中央へ配置。 */
  onPlace: (asset: AssetItem) => void;
  /** 盤面の背景に設定。 */
  onSetBackground: (asset: AssetItem) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = useState(false);

  function addFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    let remaining = images.length;
    const out: AssetItem[] = [];
    if (remaining === 0) return;
    for (const f of images) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          out.push({
            id: crypto.randomUUID(),
            name: f.name.replace(/\.[^.]+$/, ""),
            image: reader.result,
          });
        }
        remaining -= 1;
        if (remaining === 0 && out.length > 0) onAdd(out);
      };
      reader.readAsDataURL(f);
    }
  }

  return (
    <div
      className={`assets ${dropActive ? "drop-active" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropActive(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      {assets.length === 0 ? (
        <p className="palette-empty muted">
          画像をここにドロップ、または「＋画像を追加」。登録した素材は
          盤面へドラッグして置けます。
        </p>
      ) : (
        <div className="assets-grid">
          {assets.map((a) => (
            <div
              key={a.id}
              className="asset-tile"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  ASSET_MIME,
                  JSON.stringify({ name: a.name, image: a.image }),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onDoubleClick={() => onPlace(a)}
              title={`${a.name} — 盤面へドラッグ / ダブルクリックで中央に配置`}
            >
              <img src={a.image} alt="" draggable={false} />
              <span className="asset-name">{a.name}</span>
              <div className="asset-acts">
                <button
                  className="asset-act"
                  onClick={() => onPlace(a)}
                  title="盤面中央に配置"
                >
                  ▶
                </button>
                <button
                  className="asset-act"
                  onClick={() => onSetBackground(a)}
                  title="背景に設定"
                >
                  🖼
                </button>
                <button
                  className="asset-act del"
                  onClick={() => onRemove(a.id)}
                  title="アセットから削除"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn mini btn-primary"
        style={{ width: "100%" }}
        onClick={() => fileRef.current?.click()}
      >
        ＋ 画像を追加
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
