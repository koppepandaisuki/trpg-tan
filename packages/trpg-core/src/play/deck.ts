import type { RandomFn } from "../dice/random.js";

/**
 * カード・山札(トランプ・タロット・自作のカード)。
 *
 * 秘密の扱い:
 *   - 山札の並び順・捨て札・各人の手札は GM の手元(PlayScene.decks)だけが持つ。
 *   - 参加者へは projectDecks で「枚数」と「場に表向きで出たカード」だけを送る
 *     (自作カードの中身が、引かれる前に通信で見えないように)。
 *   - 手札の中身は、その人宛ての暗号文(seal.ts)で本人にだけ届ける。
 *
 * 状態の変更はすべて DeckEvent(op)にして reduce に通す。シャッフルの結果は
 * イベント生成時に確定させて op に刻む(ダイスと同じく、乱数は GM 側だけで消費)。
 */

export interface DeckCard {
  id: string;
  /** 表に書かれた名前("♠A" / "0 愚者" / 自作カードの文)。 */
  label: string;
  /** 表の画像(任意)。 */
  image?: string | null;
}

export interface Deck {
  id: string;
  name: string;
  cards: DeckCard[];
  /** 山札(先頭が一番上)。 */
  pile: string[];
  discard: string[];
  /** 場に表向きで出ているカード。 */
  table: string[];
  /** 手札(参加者の入室名 / "GM" → カード id)。 */
  hands: Record<string, string[]>;
  /** 参加者が自分で 1 枚ずつ引けるか。 */
  selfDraw?: boolean;
  /** 参加者へ送るときの枚数(projectDecks が付ける。GM の手元では未設定)。 */
  counts?: { pile: number; discard: number; hands: Record<string, number> };
}

export type DeckOp =
  | { op: "create"; deck: Deck }
  | { op: "remove"; deckId: string }
  /** 山札を混ぜる。gather なら捨て札・場・手札も全部戻してから混ぜる。結果の並びを刻む。 */
  | { op: "shuffle"; deckId: string; gather: boolean; pile: string[] }
  /** 山札の上から引く。to: "table" = 場に表向き / それ以外 = その人の手札。 */
  | { op: "draw"; deckId: string; count: number; to: string }
  /** 手札から場に出す。 */
  | { op: "play"; deckId: string; from: string; cardId: string }
  /** 場のカード(cardIds 未指定なら全部)を捨て札へ。 */
  | { op: "discard"; deckId: string; cardIds?: string[] }
  | { op: "selfDraw"; deckId: string; allow: boolean };

/** 手札の宛先ではなく「場」を表す to。 */
export const TO_TABLE = "table";

/* ===== プリセット ===== */

const SUITS = [
  ["♠", "s"],
  ["♥", "h"],
  ["♦", "d"],
  ["♣", "c"],
] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const TAROT_MAJOR = [
  "0 愚者",
  "I 魔術師",
  "II 女教皇",
  "III 女帝",
  "IV 皇帝",
  "V 教皇",
  "VI 恋人",
  "VII 戦車",
  "VIII 力",
  "IX 隠者",
  "X 運命の輪",
  "XI 正義",
  "XII 吊るされた男",
  "XIII 死神",
  "XIV 節制",
  "XV 悪魔",
  "XVI 塔",
  "XVII 星",
  "XVIII 月",
  "XIX 太陽",
  "XX 審判",
  "XXI 世界",
];

export type DeckPreset = "trump" | "trump-joker" | "tarot-major" | "custom";

export const DECK_PRESETS: { id: DeckPreset; name: string }[] = [
  { id: "trump", name: "トランプ(52 枚)" },
  { id: "trump-joker", name: "トランプ(ジョーカー 2 枚入り)" },
  { id: "tarot-major", name: "タロット(大アルカナ 22 枚)" },
  { id: "custom", name: "自作(1 行 1 枚)" },
];

/** プリセット / 自作テキストからカードの一覧を作る。 */
export function presetCards(preset: DeckPreset, customText = ""): DeckCard[] {
  if (preset === "trump" || preset === "trump-joker") {
    const cards: DeckCard[] = [];
    for (const [mark, key] of SUITS) {
      for (const r of RANKS) cards.push({ id: `${key}${r}`, label: `${mark}${r}` });
    }
    if (preset === "trump-joker") {
      cards.push({ id: "joker1", label: "JOKER" }, { id: "joker2", label: "JOKER" });
    }
    return cards;
  }
  if (preset === "tarot-major") {
    return TAROT_MAJOR.map((label, i) => ({ id: `t${i}`, label }));
  }
  return customText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 500)
    .map((label, i) => ({ id: `c${i + 1}`, label: label.slice(0, 200) }));
}

/* ===== op を作る(乱数はここで消費) ===== */

export function shuffled<T>(xs: T[], rng: RandomFn): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 新しい山札(混ぜた状態で作る)。 */
export function createDeckOp(params: {
  id: string;
  name: string;
  cards: DeckCard[];
  selfDraw?: boolean;
  rng: RandomFn;
}): DeckOp {
  return {
    op: "create",
    deck: {
      id: params.id,
      name: params.name.trim() || "山札",
      cards: params.cards,
      pile: shuffled(
        params.cards.map((c) => c.id),
        params.rng,
      ),
      discard: [],
      table: [],
      hands: {},
      ...(params.selfDraw ? { selfDraw: true } : {}),
    },
  };
}

/** 混ぜる(gather なら全部戻してから)。 */
export function shuffleDeckOp(deck: Deck, gather: boolean, rng: RandomFn): DeckOp {
  const ids = gather ? deck.cards.map((c) => c.id) : deck.pile;
  return { op: "shuffle", deckId: deck.id, gather, pile: shuffled(ids, rng) };
}

/* ===== 適用(純粋) ===== */

export function applyDeckOp(decks: Deck[], op: DeckOp): Deck[] {
  if (op.op === "create") {
    if (decks.some((d) => d.id === op.deck.id)) return decks;
    return [...decks, op.deck];
  }
  if (op.op === "remove") return decks.filter((d) => d.id !== op.deckId);
  return decks.map((d) => (d.id === op.deckId ? applyToDeck(d, op) : d));
}

function applyToDeck(d: Deck, op: Exclude<DeckOp, { op: "create" } | { op: "remove" }>): Deck {
  switch (op.op) {
    case "shuffle": {
      if (op.gather) return { ...d, pile: op.pile, discard: [], table: [], hands: {} };
      return { ...d, pile: op.pile };
    }
    case "draw": {
      const n = Math.max(0, Math.min(op.count, d.pile.length));
      const drawn = d.pile.slice(0, n);
      const pile = d.pile.slice(n);
      if (op.to === TO_TABLE) return { ...d, pile, table: [...d.table, ...drawn] };
      return {
        ...d,
        pile,
        hands: { ...d.hands, [op.to]: [...(d.hands[op.to] ?? []), ...drawn] },
      };
    }
    case "play": {
      const hand = d.hands[op.from] ?? [];
      if (!hand.includes(op.cardId)) return d;
      return {
        ...d,
        hands: { ...d.hands, [op.from]: hand.filter((c) => c !== op.cardId) },
        table: [...d.table, op.cardId],
      };
    }
    case "discard": {
      const ids = op.cardIds ?? d.table;
      return {
        ...d,
        table: d.table.filter((c) => !ids.includes(c)),
        discard: [...d.discard, ...d.table.filter((c) => ids.includes(c))],
      };
    }
    case "selfDraw":
      return { ...d, selfDraw: op.allow };
    default:
      return d;
  }
}

/** 今回の op で引いたカード(draw の結果を知るため、適用前の山札から計算)。 */
export function drawnBy(before: Deck | undefined, op: DeckOp): string[] {
  if (!before || op.op !== "draw") return [];
  return before.pile.slice(0, Math.max(0, Math.min(op.count, before.pile.length)));
}

/* ===== 参加者へ送る形 ===== */

const projCache = new WeakMap<Deck, Deck>();

/** 枚数と場のカードだけにする(山札の並び・捨て札・手札の中身・未公開のカードは送らない)。 */
export function projectDecks(decks: Deck[]): Deck[] {
  return decks.map((d) => {
    let p = projCache.get(d);
    if (!p) {
      const onTable = new Set(d.table);
      const hands: Record<string, number> = {};
      for (const [k, v] of Object.entries(d.hands)) if (v.length > 0) hands[k] = v.length;
      p = {
        id: d.id,
        name: d.name,
        cards: d.cards.filter((c) => onTable.has(c.id)),
        pile: [],
        discard: [],
        table: d.table,
        hands: {},
        ...(d.selfDraw ? { selfDraw: true } : {}),
        counts: { pile: d.pile.length, discard: d.discard.length, hands },
      };
      projCache.set(d, p);
    }
    return p;
  });
}

/** その人の手札(GM 側で、本人へ暗号化して送る中身)。 */
export function handOf(decks: Deck[], name: string): { deckId: string; cards: DeckCard[] }[] {
  return decks
    .map((d) => ({
      deckId: d.id,
      cards: (d.hands[name] ?? [])
        .map((id) => d.cards.find((c) => c.id === id))
        .filter((c): c is DeckCard => !!c),
    }))
    .filter((h) => h.cards.length > 0);
}

export function cardLabel(d: Deck | undefined, id: string): string {
  return d?.cards.find((c) => c.id === id)?.label ?? "?";
}
