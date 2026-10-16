import type GameSystemClass from "bcdice/lib/game_system";
import type Loader from "bcdice/lib/loader/loader";
import type { ExternalDiceResult } from "@trpg/core";

/**
 * BCDice(ココフォリア等でも使われている国内標準のダイスボット。BSD-3-Clause)を
 * ブラウザで遅延読み込みする。
 *
 *   - 読み込むのは GM の端末だけ(ダイスは GM が振って結果を配信する方式なので、
 *     参加者は BCDice を読み込まない)。
 *   - システムは使うものだけを個別に読み込む(全 336 システムを一度に読み込まない)。
 *     webpack が game_system/ 以下を 1 システム 1 チャンクに分ける。
 *   - パッケージの DynamicLoader は Node の require を使うため、ブラウザ向けに
 *     import() で読み込む Loader を自前で用意する。
 *
 * 卓の diceBot は "bcdice:<ID>"(例: "bcdice:SwordWorld2.5")で保存する。
 */

export const BCDICE_PREFIX = "bcdice:";

export interface BcdiceSystemInfo {
  id: string;
  name: string;
  sortKey: string;
}

let loaderPromise: Promise<Loader> | null = null;
const loaded = new Map<string, GameSystemClass>();
const loading = new Map<string, Promise<GameSystemClass>>();

function getLoader(): Promise<Loader> {
  loaderPromise ??= import("bcdice/lib/loader/loader").then((mod) => {
    const Base = (mod as unknown as { default: typeof Loader }).default;
    class BrowserLoader extends Base {
      async dynamicImportI18n(baseClassName: string, locale: string) {
        const m = (await import(
          /* webpackInclude: /\.json$/ */
          /* webpackChunkName: "bcdice-i18n-[request]" */
          `bcdice/lib/bcdice/i18n/${baseClassName}.${locale}.json`
        )) as { default?: Record<string, unknown> };
        return (m.default ?? m) as Record<string, unknown>;
      }
      async dynamicImport(className: string) {
        await import(
          /* webpackInclude: /\.js$/ */
          /* webpackChunkName: "bcdice-[request]" */
          `bcdice/lib/bcdice/game_system/${className}.js`
        );
      }
    }
    return new BrowserLoader();
  });
  return loaderPromise;
}

/** 日本語のシステム一覧(読み順)。 */
export async function listBcdiceSystems(): Promise<BcdiceSystemInfo[]> {
  const loader = await getLoader();
  return loader
    .listAvailableGameSystems()
    .filter((g) => g.locale === "ja_jp")
    .map((g) => ({ id: g.id, name: g.name, sortKey: g.sortKey }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey, "ja"));
}

/** システムを読み込む(読み込み済みならすぐ返る)。 */
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

/** 卓の diceBot 値が BCDice なら、そのシステム ID。 */
export function bcdiceIdOf(bot: string | undefined | null): string | null {
  return bot && bot.startsWith(BCDICE_PREFIX) ? bot.slice(BCDICE_PREFIX.length) : null;
}

/**
 * 読み込み済みのシステムでコマンドを評価する(同期)。未読み込み・非該当は null
 * (呼び出し側は汎用のダイス解釈へ進む)。
 */
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

/** そのシステムのヘルプ(コマンド一覧)。未読み込みなら空。 */
export function bcdiceHelp(id: string): string {
  return loaded.get(id)?.HELP_MESSAGE ?? "";
}
