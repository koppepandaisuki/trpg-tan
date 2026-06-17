import type { PlayScene } from "@trpg/core";

/**
 * 画像(data URL / http URL)を最大幅 maxW に縮小した JPEG data URL にする。
 * ロビーのカード用サムネイルを localStorage に収める目的なので小さく圧縮する。
 * 失敗(読み込み不可 / CORS 汚染で toDataURL 不可)時は null。
 */
export async function downscaleImage(
  src: string,
  maxW = 360,
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, maxW / (img.width || maxW));
      const w = Math.max(1, Math.round((img.width || maxW) * scale));
      const h = Math.max(1, Math.round((img.height || maxW) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        resolve(null); // CORS 汚染など
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * 卓の一覧カード用サムネイルを作る。終了(保存)時のアクティブ盤面の
 * 前景 → 背景 の順で素材を選び、小さく縮小して返す。素材が無ければ undefined。
 */
export async function makePlayThumbnail(
  scene: PlayScene,
): Promise<string | undefined> {
  const board = scene.board;
  const src = board?.foreground || board?.image;
  if (!src) return undefined;
  const small = await downscaleImage(src, 360);
  return small ?? undefined;
}
