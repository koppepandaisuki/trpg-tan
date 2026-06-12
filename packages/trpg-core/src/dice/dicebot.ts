import { type RandomFn, defaultRandom } from "./random.js";

/**
 * ダイスボット(システム別のダイス処理)。
 *
 * ココフォリアの BCDice 切替に相当。卓ごとに 1 つ選び、チャットの
 * コマンドをまずボットが解釈する(非該当は汎用記法へフォールバック)。
 * 乱数はイベント生成時(GM 側)に消費されるので、ネットワーク同期でも
 * 全員の出目が一致する。
 *
 * 共通で使える汎用コマンド(全ボット): XdY+Z / XdY>=N / CC<=N / choice[]
 * 各ボットはそれに加えてシステム固有の判定を持つ。
 */

export interface DiceBotResult {
  /** 表示ラベル(正規化したコマンド)。 */
  label: string;
  /** ダイス演出用の記法(振った個数と面)。 */
  notation: string;
  dice: number[];
  total: number;
  success?: boolean;
  /** 成功度などの追記("スペシャル！" / "成功数2" 等)。 */
  detail?: string;
}

export interface DiceBot {
  id: string;
  name: string;
  /** 入力欄に出す代表コマンド例。 */
  help: string;
  /** 固有コマンドの解釈。非該当は null(汎用へフォールバック)。 */
  run(command: string, rng: RandomFn): DiceBotResult | null;
}

function roll(n: number, faces: number, rng: RandomFn): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(1 + Math.floor(rng() * faces));
  return out;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/* ===== 汎用 / CoC(固有処理なし。CC<= は共通コマンドとして既存処理) ===== */

const genericBot: DiceBot = {
  id: "generic",
  name: "汎用",
  help: "2d6+1 / 1d100<=70 / choice[A,B]",
  run: () => null,
};

const cocBot: DiceBot = {
  id: "coc",
  name: "クトゥルフ神話TRPG (CoC)",
  help: "CC<=70 目星（クリティカル/ファンブル自動判定）",
  run: () => null, // CC<= は共通コマンド側で処理(版はキャラ/卓から)
};

/* ===== ソード・ワールド2.5: 2d6+m>=t + 自動成功/自動失敗 ===== */

const sw25Bot: DiceBot = {
  id: "sw25",
  name: "ソード・ワールド2.5",
  help: "2d6+5>=10（出目66=自動成功 / 出目11=自動失敗）",
  run(command, rng) {
    const m = command.match(/^2d6\s*([+-]\d+)?\s*(?:>=\s*(\d+))?$/i);
    if (!m) return null;
    const mod = m[1] ? parseInt(m[1], 10) : 0;
    const target = m[2] ? parseInt(m[2], 10) : null;
    const dice = roll(2, 6, rng);
    const total = sum(dice) + mod;
    const isAutoSuccess = dice[0] === 6 && dice[1] === 6;
    const isAutoFail = dice[0] === 1 && dice[1] === 1;

    let success: boolean | undefined;
    let detail: string | undefined;
    if (isAutoSuccess) {
      success = true;
      detail = "自動成功（出目66）！";
    } else if (isAutoFail) {
      success = false;
      detail = "自動失敗（出目11）…";
    } else if (target !== null) {
      success = total >= target;
      detail = success ? "成功" : "失敗";
    }
    return {
      label: `2d6${mod ? (mod > 0 ? `+${mod}` : mod) : ""}${target !== null ? `>=${target}` : ""}`,
      notation: "2d6",
      dice,
      total,
      success,
      detail,
    };
  },
};

/* ===== シノビガミ: 2d6>=t + スペシャル(12) / ファンブル(2) ===== */

const shinobigamiBot: DiceBot = {
  id: "shinobigami",
  name: "シノビガミ",
  help: "2d6>=5（出目12=スペシャル / 出目2=ファンブル）",
  run(command, rng) {
    const m = command.match(/^2d6\s*(?:>=\s*(\d+))?$/i);
    if (!m) return null;
    const target = m[1] ? parseInt(m[1], 10) : null;
    const dice = roll(2, 6, rng);
    const total = sum(dice);

    let success: boolean | undefined;
    let detail: string | undefined;
    if (total === 12) {
      success = true;
      detail = "スペシャル！（生命力/変調が回復）";
    } else if (total === 2) {
      success = false;
      detail = "ファンブル…（ファンブル表へ）";
    } else if (target !== null) {
      success = total >= target;
      detail = success ? "成功" : "失敗";
    }
    return {
      label: `2d6${target !== null ? `>=${target}` : ""}`,
      notation: "2d6",
      dice,
      total,
      success,
      detail,
    };
  },
};

/* ===== ダブルクロス3rd: XDX@C+m(>=t)。クリティカル振り足し自動 ===== */

const dx3Bot: DiceBot = {
  id: "dx3",
  name: "ダブルクロス The 3rd",
  help: "5DX@10+3>=15（10以上で振り足し、達成値を自動計算）",
  run(command, rng) {
    const m = command.match(
      /^(\d+)dx\s*(?:@(\d+))?\s*([+-]\d+)?\s*(?:>=\s*(\d+))?$/i,
    );
    if (!m) return null;
    const n = Math.min(100, Math.max(1, parseInt(m[1], 10)));
    const crit = Math.max(2, m[2] ? parseInt(m[2], 10) : 10);
    const mod = m[3] ? parseInt(m[3], 10) : 0;
    const target = m[4] ? parseInt(m[4], 10) : null;

    const allDice: number[] = [];
    let count = n;
    let rounds = 0;
    let lastMax = 0;
    // クリティカル値以上の個数だけ振り足し(1 振り足し = 達成値 +10)。
    for (let guard = 0; guard < 100 && count > 0; guard++) {
      const ds = roll(count, 10, rng);
      allDice.push(...ds);
      const crits = ds.filter((d) => d >= crit).length;
      lastMax = Math.max(...ds);
      if (crits === 0) break;
      rounds += 1;
      count = crits;
    }
    // 全ダイスが 1(最初のラウンド)ならファンブル: 達成値 0。
    const firstRound = allDice.slice(0, n);
    const fumble = firstRound.every((d) => d === 1);
    const total = fumble ? 0 : rounds * 10 + lastMax + mod;

    let success: boolean | undefined;
    let detail = fumble
      ? "ファンブル…（達成値0）"
      : `達成値${total}${rounds > 0 ? `（クリティカル×${rounds}）` : ""}`;
    if (!fumble && target !== null) {
      success = total >= target;
      detail += success ? " → 成功" : " → 失敗";
    } else if (fumble) {
      success = false;
    }
    return {
      label: `${n}DX@${crit}${mod ? (mod > 0 ? `+${mod}` : mod) : ""}${target !== null ? `>=${target}` : ""}`,
      notation: `${allDice.length}d10`,
      dice: allDice,
      total,
      success,
      detail,
    };
  },
};

/* ===== エモクロア: XDM<=t。能力値以下の出目を成功数として数える ===== */

const emokloreBot: DiceBot = {
  id: "emoklore",
  name: "エモクロアTRPG",
  help: "3DM<=4（成功数を自動カウント。1=ダブル / 10=ファンブル）",
  run(command, rng) {
    const m = command.match(/^(\d+)dm\s*(?:<=\s*(\d+))?$/i);
    if (!m) return null;
    const n = Math.min(100, Math.max(1, parseInt(m[1], 10)));
    const target = m[2] ? parseInt(m[2], 10) : null;
    const dice = roll(n, 10, rng);

    if (target === null) {
      return {
        label: `${n}DM`,
        notation: `${n}d10`,
        dice,
        total: sum(dice),
      };
    }
    const crits = dice.filter((d) => d === 1).length;
    const fumbles = dice.filter((d) => d === 10).length;
    const base = dice.filter((d) => d <= target).length;
    // 1 はクリティカル(成功+1 上乗せ)、10 はファンブル(成功-1)。
    const successes = Math.max(0, base + crits - fumbles);
    const parts: string[] = [`成功数${successes}`];
    if (crits > 0) parts.push(`クリティカル×${crits}`);
    if (fumbles > 0) parts.push(`ファンブル×${fumbles}`);
    return {
      label: `${n}DM<=${target}`,
      notation: `${n}d10`,
      dice,
      total: successes,
      success: successes >= 1,
      detail: parts.join("／"),
    };
  },
};

/* ===== ネクロニカ: NC+m。1d10+m を 6/11 で判定 ===== */

const nechronicaBot: DiceBot = {
  id: "nechronica",
  name: "永い後日談のネクロニカ",
  help: "NC+1（6以上=成功 / 11以上=大成功 / 出目1=ファンブル）",
  run(command, rng) {
    const m = command.match(/^nc\s*([+-]\d+)?$/i);
    if (!m) return null;
    const mod = m[1] ? parseInt(m[1], 10) : 0;
    const dice = roll(1, 10, rng);
    const total = dice[0] + mod;

    let success: boolean;
    let detail: string;
    if (dice[0] === 1) {
      success = false;
      detail = "ファンブル…";
    } else if (total >= 11) {
      success = true;
      detail = "大成功！";
    } else if (total >= 6) {
      success = true;
      detail = "成功";
    } else {
      success = false;
      detail = "失敗";
    }
    return {
      label: `NC${mod ? (mod > 0 ? `+${mod}` : mod) : ""}`,
      notation: "1d10",
      dice,
      total,
      success,
      detail,
    };
  },
};

/* ===== パラノイア: 1d20<=t + クリティカル(1) / ファンブル(20) ===== */

const paranoiaBot: DiceBot = {
  id: "paranoia",
  name: "パラノイア",
  help: "1d20<=8（出目1=クリティカル / 出目20=ファンブル）",
  run(command, rng) {
    const m = command.match(/^1d20\s*<=\s*(\d+)$/i);
    if (!m) return null;
    const target = parseInt(m[1], 10);
    const dice = roll(1, 20, rng);
    const v = dice[0];

    let success: boolean;
    let detail: string;
    if (v === 1) {
      success = true;
      detail = "クリティカル！ コンピュータ様もお喜びです";
    } else if (v === 20) {
      success = false;
      detail = "ファンブル…それは反逆です";
    } else {
      success = v <= target;
      detail = success ? "成功" : "失敗";
    }
    return {
      label: `1d20<=${target}`,
      notation: "1d20",
      dice,
      total: v,
      success,
      detail,
    };
  },
};

/* ===== 登録 ===== */

export const DICE_BOTS: DiceBot[] = [
  genericBot,
  cocBot,
  sw25Bot,
  dx3Bot,
  shinobigamiBot,
  emokloreBot,
  nechronicaBot,
  paranoiaBot,
];

export function getDiceBot(id: string | undefined): DiceBot {
  return DICE_BOTS.find((b) => b.id === id) ?? genericBot;
}

/** ボット固有コマンドとして解釈・実行。非該当は null。 */
export function runDiceBot(
  botId: string | undefined,
  command: string,
  rng: RandomFn = defaultRandom,
): DiceBotResult | null {
  return getDiceBot(botId).run(command.trim(), rng);
}
