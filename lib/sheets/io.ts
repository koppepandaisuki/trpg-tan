import { CCSHEET_SCHEMA_VERSION } from "@trpg/core";
import type { AnySheet, SheetIO } from "@trpg/ui/io";
import { uploadPlayImage } from "@/lib/play/media";
import { insertSheet, updateSheet } from "./client";

/**
 * Web 版キャラシの保存・読込(@trpg/ui のエディタに注入する SheetIO)。
 *
 * デスクトップ(apps/desktop/src/sheet-io.ts)はローカルファイルに保存するが、
 * Web はクラウド(character_sheets)に保存する。ref = 行 id。
 *
 * 立ち絵: エディタは画像を data URL で持つ。そのまま jsonb に入れると 1 キャラ
 * 数 MB になり一覧も卓も重くなるので、保存時に play バケットへ上げて URL に
 * 置き換える(同じ画像は内容ハッシュで 1 回だけ)。一覧用のサムネは小さく縮めて
 * 別に持つ。
 */

const THUMB = 96;

/** data URL → 公開 URL(+ サムネ)。保存のたびに同じ画像を上げ直さないためのキャッシュ。 */
const portraitCache = new Map<string, { url: string; thumb: string | null }>();

/**
 * data URL をバイト列にする。fetch("data:...") は CSP の connect-src に
 * 引っかかるので使わず、自前でデコードする。
 */
function dataUrlToFile(dataUrl: string): File | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  if (!mime.startsWith("image/")) return null;
  const body = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i);
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
  return new File([bytes], `portrait.${ext}`, { type: mime });
}

/** 正方形に中央クロップして縮めたサムネ(一覧用・数 KB)。 */
function makeThumb(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = THUMB;
        canvas.height = THUMB;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - s) / 2;
        // 立ち絵は顔が上にあることが多いので、縦長なら上寄せで切り出す。
        const sy = img.naturalHeight > img.naturalWidth ? 0 : (img.naturalHeight - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, THUMB, THUMB);
        resolve(canvas.toDataURL("image/webp", 0.8));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * 保存直前に立ち絵を外に出す。
 * thumbnail: undefined = 列に触れない(画像が変わっていない) / null = 画像なし / string = 新サムネ
 */
async function externalizePortrait(
  sheet: AnySheet,
): Promise<{ sheet: AnySheet; thumbnail: string | null | undefined }> {
  const image = sheet.image ?? null;
  if (!image) return { sheet, thumbnail: null };
  if (!image.startsWith("data:")) return { sheet, thumbnail: undefined };

  let hit = portraitCache.get(image);
  if (!hit) {
    const file = dataUrlToFile(image);
    if (!file) return { sheet, thumbnail: undefined };
    const [url, thumb] = await Promise.all([
      uploadPlayImage(file, { register: false }),
      makeThumb(image),
    ]);
    hit = { url, thumb };
    portraitCache.set(image, hit);
  }
  return { sheet: { ...sheet, image: hit.url }, thumbnail: hit.thumb };
}

/** .ccsheet(JSON)ファイルを選んで読む。キャンセルは null。 */
export function pickSheetFile(): Promise<AnySheet | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ccsheet,application/json,.json";
    input.addEventListener("cancel", () => resolve(null));
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file
        .text()
        .then((text) => {
          const parsed = JSON.parse(text) as AnySheet;
          if (parsed?.schemaVersion !== CCSHEET_SCHEMA_VERSION) {
            throw new Error(
              `キャラシのファイルではないか、未対応のバージョンです(${String(parsed?.schemaVersion)})`,
            );
          }
          resolve(parsed);
        })
        .catch((e) => reject(e instanceof SyntaxError ? new Error("ファイルを読めませんでした(JSON ではありません)") : e));
    });
    input.click();
  });
}

export const cloudSheetIO: SheetIO = {
  target: "cloud",
  async save(sheet, ref) {
    const { sheet: out, thumbnail } = await externalizePortrait(sheet);
    if (ref) {
      await updateSheet(ref, out, thumbnail);
      return { ref };
    }
    return { ref: await insertSheet(out, thumbnail ?? out.image ?? null) };
  },
  /** Web の「別名で保存」= 新しい id のキャラとして複製する。 */
  async saveAs(sheet) {
    const sheetId = crypto.randomUUID();
    const { sheet: out, thumbnail } = await externalizePortrait({ ...sheet, id: sheetId });
    // 画像が変わっていない(URL のまま)複製は、その URL をサムネとして使う。
    return { ref: await insertSheet(out, thumbnail ?? out.image ?? null), sheetId };
  },
  /** デスクトップで作った .ccsheet を取り込む(未保存の新規として開く)。 */
  async load() {
    const sheet = await pickSheetFile();
    return sheet ? { sheet, ref: null } : null;
  },
};
