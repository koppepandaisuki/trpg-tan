import type { CoCEdition } from "../../dice/coc-check.js";

/**
 * CoC の派生値(HP/MP/SAN/ダメージボーナス/移動率…)を能力値から算出する。
 * 6 版 / 7 版で式が異なるため edition で分岐。数値ルール=ゲームの仕組みは
 * 著作権保護外のため転記してよい。
 *
 * 入力 chars は STR/CON/SIZ/DEX/INT/POW/EDU/APP のレコード。未設定は 0 扱い。
 * 戻り値は派生キー(SystemDefinition.derived[].key)→ 値。ダメージボーナス
 * (DB)はダイス記法 or 符号付き数値の文字列、その他は数値。
 */

export interface CoCDerived {
  [key: string]: number | string;
}

function n(chars: Record<string, number>, key: string): number {
  const v = chars[key];
  return Number.isFinite(v) ? v : 0;
}

/** 7 版のダメージボーナス / ビルド(STR+SIZ から)*/
export function coc7DamageBonus(strPlusSiz: number): {
  db: string;
  build: number;
} {
  const s = strPlusSiz;
  if (s <= 64) return { db: "-2", build: -2 };
  if (s <= 84) return { db: "-1", build: -1 };
  if (s <= 124) return { db: "0", build: 0 };
  if (s <= 164) return { db: "+1D4", build: 1 };
  if (s <= 204) return { db: "+1D6", build: 2 };
  // 205 以降は 80 ごとに +1D6 / build+1
  const steps = Math.floor((s - 205) / 80); // 0,1,2,...
  const dice = 2 + steps; // 205–284 → 2D6
  return { db: `+${dice}D6`, build: 3 + steps };
}

/** 6 版のダメージボーナス(STR+SIZ から)*/
export function coc6DamageBonus(strPlusSiz: number): string {
  const s = strPlusSiz;
  if (s <= 12) return "-1D6";
  if (s <= 16) return "-1D4";
  if (s <= 24) return "0";
  if (s <= 32) return "+1D4";
  if (s <= 40) return "+1D6";
  // 41 以降は 16 ごとに +1D6
  const steps = Math.floor((s - 41) / 16); // 41–56 → 0
  const dice = 2 + steps;
  return `+${dice}D6`;
}

/** 7 版の基本移動率(年齢補正前)*/
export function coc7BaseMov(str: number, dex: number, siz: number): number {
  if (str < siz && dex < siz) return 7;
  if (str > siz && dex > siz) return 9;
  return 8;
}

/** 年齢による移動率補正(40 代以降 10 歳ごとに -1、最大 -5)*/
export function movAgePenalty(age: number | undefined): number {
  if (!age || age < 40) return 0;
  return Math.min(5, Math.floor((age - 40) / 10) + 1);
}

export function computeCoCDerived(
  edition: CoCEdition,
  chars: Record<string, number>,
  opts: { age?: number } = {},
): CoCDerived {
  const STR = n(chars, "STR");
  const CON = n(chars, "CON");
  const SIZ = n(chars, "SIZ");
  const DEX = n(chars, "DEX");
  const INT = n(chars, "INT");
  const POW = n(chars, "POW");
  const EDU = n(chars, "EDU");

  if (edition === "7") {
    const { db, build } = coc7DamageBonus(STR + SIZ);
    const mov = Math.max(0, coc7BaseMov(STR, DEX, SIZ) - movAgePenalty(opts.age));
    return {
      HP: Math.floor((CON + SIZ) / 10),
      MP: Math.floor(POW / 5),
      SAN: POW, // 開始正気度(上限 99 はクトゥルフ神話技能で逓減)
      DB: db,
      BUILD: build,
      MOV: mov,
    };
  }

  // 6 版
  return {
    HP: Math.round((CON + SIZ) / 2),
    MP: POW,
    SAN: POW * 5,
    DB: coc6DamageBonus(STR + SIZ),
    IDEA: INT * 5,
    LUCK: POW * 5,
    KNOW: EDU * 5,
  };
}
