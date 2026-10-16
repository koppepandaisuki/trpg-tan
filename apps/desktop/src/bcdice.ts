import type GameSystemClass from "bcdice/lib/game_system";
import type Loader from "bcdice/lib/loader/loader";
import type { ExternalDiceResult } from "@trpg/core";

/**
 * BCDice(BSD-3-Clause)をデスクトップ / PWA で遅延読み込みする。Web 版
 * lib/play/bcdice.ts と同じ役割(GM の端末だけが読み込み、結果を配信する)。
 *
 * Vite の import.meta.glob で game_system/ 以下を 1 システム 1 チャンクにし、
 * 選んだものだけを読み込む。パッケージ付属の DynamicLoader は Node の require を
 * 使うため、glob で読む Loader を自前で用意する。
 *
 * 卓の diceBot は "bcdice:<ID>"(Web 版と共通)。
 *
 * 注意: bcdice は CommonJS で配布されている。本番ビルド(vite build)では Rollup が
 * ESM に変換するので動くが、開発サーバー(vite dev)は glob で読んだ node_modules の
 * CommonJS を変換しないため読み込めない(画面にその旨を出す)。動作確認はビルド版で。
 */

export const BCDICE_PREFIX = "bcdice:";

export interface BcdiceSystemInfo {
  id: string;
  name: string;
  sortKey: string;
}

const systemModules = import.meta.glob(
  "../node_modules/bcdice/lib/bcdice/game_system/*.js",
);
const i18nModules = import.meta.glob(
  "../node_modules/bcdice/lib/bcdice/i18n/*.json",
  { import: "default" },
);

let loaderPromise: Promise<Loader> | null = null;
const loaded = new Map<string, GameSystemClass>();
const loading = new Map<string, Promise<GameSystemClass>>();

function getLoader(): Promise<Loader> {
  loaderPromise ??= import("bcdice/lib/loader/loader").then((mod) => {
    const Base = (mod as unknown as { default: typeof Loader }).default;
    class GlobLoader extends Base {
      async dynamicImportI18n(baseClassName: string, locale: string) {
        const key = `../node_modules/bcdice/lib/bcdice/i18n/${baseClassName}.${locale}.json`;
        const load = i18nModules[key];
        if (!load) throw new Error(`BCDice i18n not found: ${key}`);
        return (await load()) as Record<string, unknown>;
      }
      async dynamicImport(className: string) {
        const key = `../node_modules/bcdice/lib/bcdice/game_system/${className}.js`;
        const load = systemModules[key];
        if (!load) throw new Error(`BCDice system not found: ${className}`);
        await load();
      }
    }
    return new GlobLoader();
  });
  return loaderPromise;
}

let listPromise: Promise<BcdiceSystemInfo[]> | null = null;

/** 日本語のシステム一覧(読み順)。一覧の JSON だけを後から読むので起動は重くならない。 */
export function listBcdiceSystems(): Promise<BcdiceSystemInfo[]> {
  listPromise ??= import("bcdice/lib/bcdice/game_system_list.json").then((m) => {
    const list = (m as unknown as { default: { gameSystems: (BcdiceSystemInfo & { locale: string })[] } })
      .default.gameSystems;
    return list
      .filter((g) => g.locale === "ja_jp")
      .map((g) => ({ id: g.id, name: g.name, sortKey: g.sortKey }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey, "ja"));
  });
  return listPromise;
}

export function loadBcdiceSystem(id: string): Promise<GameSystemClass> {
  const hit = loaded.get(id);
  if (hit) return Promise.resolve(hit);
  let p = loading.get(id);
  if (!p) {
    p = getLoader()
      .then((l) => l.dynamicLoad(id))
      .then((gs) => {
        loaded.set(id, gs);
        return gs;
      })
      .finally(() => loading.delete(id));
    loading.set(id, p);
  }
  return p;
}

export function bcdiceIdOf(bot: string | undefined | null): string | null {
  return bot && bot.startsWith(BCDICE_PREFIX) ? bot.slice(BCDICE_PREFIX.length) : null;
}

/** 読み込み済みのシステムで評価(同期)。未読み込み・非該当は null。 */
export function evalBcdice(id: string, command: string): ExternalDiceResult | null {
  const gs = loaded.get(id);
  if (!gs) return null;
  let r;
  try {
    r = gs.eval(command);
  } catch {
    return null;
  }
  if (!r) return null;
  return {
    command,
    text: r.text,
    rands: r.rands,
    success: r.success,
    failure: r.failure,
    critical: r.critical,
    fumble: r.fumble,
    secret: r.secret,
  };
}
