// サブパスから読む(index 経由だとエディタ本体まで初期バンドルに入り、遅延読込が効かない)。
import { isGenericSheet, type AnySheet, type SheetIO, type SheetSources } from "@trpg/ui/io";
import {
  isTauri,
  loadSheetViaDialog,
  saveGenericSheet,
  saveSheet,
  saveSheetToPath,
} from "./storage";
import { getAllSystems } from "./systems-store";
import { importVampireBloodSheet } from "./vampire-import";
import { toast } from "./Toasts";

/**
 * デスクトップ版のキャラシ保存・読込(@trpg/ui のエディタに注入する)。
 *
 * 保存先はローカルの .ccsheet ファイル(ref = ファイルパス)。ブラウザ(PWA)では
 * storage.ts が localStorage に保存する(ref = browser://...)。Web 版は同じ
 * エディタにクラウド保存の実装を注入している(lib/sheets/io.ts)。
 */

async function saveNew(sheet: AnySheet): Promise<{ ref: string } | null> {
  const path = isGenericSheet(sheet)
    ? await saveGenericSheet(sheet)
    : await saveSheet(sheet);
  return path ? { ref: path } : null;
}

export const desktopSheetIO: SheetIO = {
  target: "file",
  async save(sheet, ref) {
    if (ref) {
      await saveSheetToPath(sheet, ref);
      return { ref };
    }
    return saveNew(sheet);
  },
  saveAs: saveNew,
  // ファイルを開くダイアログは Tauri のみ(ブラウザ版では「インポート」を出さない)。
  load: isTauri()
    ? async () => {
        const r = await loadSheetViaDialog();
        return r ? { sheet: r.sheet, ref: r.path } : null;
      }
    : undefined,
  notify: toast,
};

/** 選べるシステム = ビルダーの自作(localStorage) + プリセット。保管所は Tauri HTTP。 */
export const desktopSheetSources: SheetSources = {
  getSystems: getAllSystems,
  importVampireBlood: importVampireBloodSheet,
};
