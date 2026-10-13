import { unzipSync, strFromU8 } from "fflate";
import {
  readKoboManifest,
  koboScenarioToPlay,
  KoboImportError,
  type KoboScenarioRef,
  type PlayScene,
} from "@trpg/core";

/**
 * 「TRPGシナリオ工房」のバックアップ zip を読む(デスクトップ / PWA)。
 * Web 版 lib/play/kobo-import.ts と同じ内容。
 *
 * zip の展開だけをここで行い、卓への変換は @trpg/core の koboScenarioToPlay
 * (デスクトップ版と共通)。画像(PDF レイアウト用の挿絵)は卓には取り込まない
 * ので、JSON だけを取り出して展開量を抑える。
 */

/** 工房のバックアップとして読める上限(画像込みの zip を想定して 200MB)。 */
const MAX_ZIP_BYTES = 200 * 1024 * 1024;

export interface KoboBackup {
  scenarios: KoboScenarioRef[];
  toPlay(ref: KoboScenarioRef): PlayScene;
}

export async function readKoboBackup(file: File): Promise<KoboBackup> {
  if (file.size > MAX_ZIP_BYTES) {
    throw new KoboImportError("ファイルが大きすぎます(200MB まで)。");
  }
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      // JSON だけ展開する(挿絵の画像は使わない)。
      filter: (f) => f.name === "manifest.json" || f.name.endsWith("/scenario.json"),
    });
  } catch {
    throw new KoboImportError(
      "zip として読めませんでした。工房の「バックアップ」から書き出したファイルを選んでください。",
    );
  }
  const json = (path: string): unknown => {
    const u8 = files[path];
    if (!u8) return undefined;
    try {
      return JSON.parse(strFromU8(u8));
    } catch {
      throw new KoboImportError("バックアップが壊れているため、読み込めませんでした。");
    }
  };
  const scenarios = readKoboManifest(json("manifest.json"));
  return {
    scenarios,
    toPlay(ref) {
      const bundle = json(`${ref.dir}/scenario.json`);
      if (!bundle) throw new KoboImportError("シナリオのデータが見つかりませんでした。");
      return koboScenarioToPlay(bundle, {
        id: crypto.randomUUID(),
        now: new Date().toISOString(),
      });
    },
  };
}
