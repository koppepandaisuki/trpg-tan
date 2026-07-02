import type { CharacterSheet } from "./types.js";
import { createEmptySheet } from "./types.js";
import { coc6 } from "../systems/coc/coc6.js";

/**
 * キャラクター保管所(charasheet.vampire-blood.net)の JSON からの取り込み。
 *
 * 取得: シート URL の .html を .js に変えると JSON が返る(公式仕様)。
 * 対応: クトゥルフ神話TRPG 6版(game="coc")。
 *
 * 主なキー(実シートで確認済み):
 *   pc_name / shuzoku / age / sex / pc_making_memo
 *   NA1..NA8 = STR, CON, POW, DEX, APP, SIZ, INT, EDU
 *   SAN_Left / SAN_Max
 *   技能は5カテゴリ: TBA(戦闘) TFA(探索) TAA(行動) TCA(交渉) TKA(知識)。
 *   各カテゴリに D(初期値)/P(合計) の並列配列。既定行のラベルは JSON に
 *   含まれず順序固定(下の DEFAULTS)。既定行の後ろに追加行が続き、その名前は
 *   T?AName 配列に入る。専門系(運転/製作/操縦/芸術/母国語)の分野は別キー。
 */

type Json = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** 保管所の既定技能行(順序固定)。specialty はその行の分野キー。 */
type DefRow = { label: string; specialtyKey?: string };
const DEFAULTS: Record<string, DefRow[]> = {
  TBA: [
    { label: "回避" },
    { label: "キック" },
    { label: "組み付き" },
    { label: "こぶし(パンチ)" },
    { label: "頭突き" },
    { label: "投擲" },
    { label: "マーシャルアーツ" },
    { label: "拳銃" },
    { label: "サブマシンガン" },
    { label: "ショットガン" },
    { label: "マシンガン" },
    { label: "ライフル" },
  ],
  TFA: [
    { label: "応急手当" },
    { label: "鍵開け" },
    { label: "隠す" },
    { label: "隠れる" },
    { label: "聞き耳" },
    { label: "忍び歩き" },
    { label: "写真術" },
    { label: "精神分析" },
    { label: "追跡" },
    { label: "登攀" },
    { label: "図書館" },
    { label: "目星" },
  ],
  TAA: [
    { label: "運転", specialtyKey: "unten_bunya" },
    { label: "機械修理" },
    { label: "重機械操作" },
    { label: "乗馬" },
    { label: "水泳" },
    { label: "製作", specialtyKey: "seisaku_bunya" },
    { label: "操縦", specialtyKey: "main_souju_norimono" },
    { label: "跳躍" },
    { label: "電気修理" },
    { label: "ナビゲート" },
    { label: "変装" },
  ],
  TCA: [
    { label: "言いくるめ" },
    { label: "信用" },
    { label: "説得" },
    { label: "値切り" },
    { label: "母国語", specialtyKey: "mylang_name" },
  ],
  TKA: [
    { label: "医学" },
    { label: "オカルト" },
    { label: "化学" },
    { label: "クトゥルフ神話" },
    { label: "芸術", specialtyKey: "geijutu_bunya" },
    { label: "経理" },
    { label: "考古学" },
    { label: "コンピューター" },
    { label: "心理学" },
    { label: "人類学" },
    { label: "生物学" },
    { label: "地質学" },
    { label: "電子工学" },
    { label: "天文学" },
    { label: "博物学" },
    { label: "物理学" },
    { label: "法律" },
    { label: "薬学" },
    { label: "歴史" },
  ],
};

/** ラベル正規化(全角括弧・空白差を吸収して照合)。 */
function normLabel(s: string): string {
  return s.replace(/（/g, "(").replace(/）/g, ")").replace(/\s+/g, "").trim();
}

/** 保管所ラベル → 当アプリの coc6 カタログの技能 key。 */
function catalogKeyByLabel(): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of coc6.skills) m.set(normLabel(s.label), s.key);
  return m;
}

/**
 * 保管所 JSON → CharacterSheet(coc6)。
 * 対応外のシート(クトゥルフ以外)は Error を投げる。
 */
export function sheetFromVampireBlood(
  json: Json,
  params: { id: string; now: string },
): CharacterSheet {
  const game = str(json.game);
  if (game !== "coc") {
    throw new Error(
      "このシートは対応していません(現在はクトゥルフ神話TRPG 6版のみ取り込めます)",
    );
  }

  const sheet = createEmptySheet({
    id: params.id,
    systemId: "coc6",
    now: params.now,
    name: str(json.pc_name) || "(名前未設定)",
  });

  // 能力値: NA1..NA8 = STR, CON, POW, DEX, APP, SIZ, INT, EDU(実シートで確認)。
  const order = ["STR", "CON", "POW", "DEX", "APP", "SIZ", "INT", "EDU"];
  order.forEach((key, i) => {
    const v = num(json[`NA${i + 1}`]);
    if (v > 0) sheet.characteristics[key] = v;
  });

  // 職業・メモ。SAN の現在値はシートに欄がないためメモへ(卓で参照できる)。
  const shuzoku = str(json.shuzoku).trim();
  if (shuzoku) sheet.occupationName = shuzoku;
  const memoBits: string[] = [];
  const age = str(json.age).trim();
  const sex = str(json.sex).trim();
  if (age) memoBits.push(`年齢: ${age}`);
  if (sex) memoBits.push(`性別: ${sex}`);
  const sanLeft = num(json.SAN_Left);
  const sanMax = num(json.SAN_Max);
  if (sanMax > 0) memoBits.push(`SAN ${sanLeft}/${sanMax}(取込時)`);
  sheet.notes = memoBits.join(" / ");
  const backstory = str(json.pc_making_memo).trim();
  if (backstory) sheet.backstory = backstory;

  // 技能: 初期値(D)と合計(P)が異なる行 = 振ってある技能だけ取り込む。
  const byLabel = catalogKeyByLabel();
  const custom: NonNullable<CharacterSheet["customSkills"]> = [];
  const specialties: Record<string, string> = {};

  for (const [prefix, defs] of Object.entries(DEFAULTS)) {
    const dArr = arr(json[`${prefix}D`]);
    const pArr = arr(json[`${prefix}P`]);
    const nameArr = arr(json[`${prefix}Name`]);
    for (let i = 0; i < pArr.length; i++) {
      const total = num(pArr[i]);
      const init = num(dArr[i]);
      if (total <= 0 || total === init) continue; // 未成長はスキップ
      const def = defs[i];
      const rawLabel = def
        ? def.label
        : str(nameArr[i - defs.length]).trim() || `技能${i + 1}`;
      const key = byLabel.get(normLabel(rawLabel));
      if (key) {
        sheet.skills[key] = total;
        if (def?.specialtyKey) {
          const spec = str(json[def.specialtyKey]).trim();
          if (spec) specialties[key] = spec;
        }
      } else {
        // カタログ外(保管所の自由記入など)はオリジナル技能として保持。
        const spec = def?.specialtyKey ? str(json[def.specialtyKey]).trim() : "";
        const label = spec ? `${rawLabel}(${spec})` : rawLabel;
        const ckey = `vb_${prefix.toLowerCase()}_${i}`;
        custom.push({ key: ckey, label, value: total });
        sheet.skills[ckey] = total;
      }
    }
  }
  if (custom.length > 0) sheet.customSkills = custom;
  if (Object.keys(specialties).length > 0) sheet.skillSpecialties = specialties;

  return sheet;
}

/**
 * 保管所のシート URL / ID から JSON 取得用 URL を作る。
 * 受理: 数字のみ / https://charasheet.vampire-blood.net/12345(.html|.js)。
 * 不正なら null。
 */
export function vampireBloodJsonUrl(input: string): string | null {
  const s = input.trim();
  if (/^\d+$/.test(s)) return `https://charasheet.vampire-blood.net/${s}.js`;
  const m = s.match(
    /^https?:\/\/charasheet\.vampire-blood\.net\/(\d+)(?:\.html|\.js)?(?:[?#].*)?$/i,
  );
  return m ? `https://charasheet.vampire-blood.net/${m[1]}.js` : null;
}
