import { describe, it, expect } from "vitest";
import {
  createScene,
  reduce,
  deckEvent,
  presetCards,
  createDeckOp,
  shuffleDeckOp,
  projectDecks,
  projectForPlayers,
  handOf,
  drawnBy,
  TO_TABLE,
  type PlayScene,
} from "../src/play/index.js";

/** カード・山札(deck.ts)。 */

const NOW = "2026-10-15T00:00:00.000Z";
let n = 0;
const ctx = () => ({ id: `e${++n}`, ts: NOW });
/** 決定的な乱数(線形合同法)。 */
function rngFrom(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function withDeck(custom = ""): PlayScene {
  const s = createScene({ id: "t", title: "卓", now: NOW });
  const cards = custom ? presetCards("custom", custom) : presetCards("trump");
  return reduce(s, deckEvent(ctx(), "GM", createDeckOp({ id: "d1", name: "山札", cards, rng: rngFrom(1) })));
}

describe("プリセット", () => {
  it("トランプ 52 / ジョーカー入り 54 / 大アルカナ 22 / 自作は 1 行 1 枚", () => {
    expect(presetCards("trump")).toHaveLength(52);
    expect(presetCards("trump-joker")).toHaveLength(54);
    expect(presetCards("tarot-major")).toHaveLength(22);
    expect(presetCards("custom", "鍵\n\n日記\n 地図 ").map((c) => c.label)).toEqual(["鍵", "日記", "地図"]);
  });
});

describe("山札の操作", () => {
  it("作ると混ざった山札になる(全カードが 1 枚ずつ)", () => {
    const d = withDeck().decks![0];
    expect(d.pile).toHaveLength(52);
    expect(new Set(d.pile).size).toBe(52);
    expect(d.pile).not.toEqual(presetCards("trump").map((c) => c.id));
  });

  it("引く(場 / 手札)・手札から場へ・場を流す・全部戻して混ぜる", () => {
    let s = withDeck();
    const top2 = s.decks![0].pile.slice(0, 2);
    s = reduce(s, deckEvent(ctx(), "GM", { op: "draw", deckId: "d1", count: 1, to: TO_TABLE }));
    expect(s.decks![0].table).toEqual([top2[0]]);
    s = reduce(s, deckEvent(ctx(), "GM", { op: "draw", deckId: "d1", count: 1, to: "PL1" }));
    expect(s.decks![0].hands.PL1).toEqual([top2[1]]);
    expect(s.decks![0].pile).toHaveLength(50);

    s = reduce(s, deckEvent(ctx(), "PL1", { op: "play", deckId: "d1", from: "PL1", cardId: top2[1] }));
    expect(s.decks![0].hands.PL1).toEqual([]);
    expect(s.decks![0].table).toEqual(top2);
    // 持っていないカードは出せない
    s = reduce(s, deckEvent(ctx(), "PL1", { op: "play", deckId: "d1", from: "PL1", cardId: "sA" }));
    expect(s.decks![0].table).toEqual(top2);

    s = reduce(s, deckEvent(ctx(), "GM", { op: "discard", deckId: "d1" }));
    expect(s.decks![0].table).toEqual([]);
    expect(s.decks![0].discard).toEqual(top2);

    s = reduce(s, deckEvent(ctx(), "GM", shuffleDeckOp(s.decks![0], true, rngFrom(7))));
    expect(s.decks![0].pile).toHaveLength(52);
    expect(s.decks![0].discard).toEqual([]);
  });

  it("drawnBy は今回引いたカードを返す / 山札より多くは引けない", () => {
    const s = withDeck("A\nB\nC");
    const op = { op: "draw" as const, deckId: "d1", count: 5, to: "PL1" };
    expect(drawnBy(s.decks![0], op)).toEqual(s.decks![0].pile);
    const after = reduce(s, deckEvent(ctx(), "GM", op));
    expect(after.decks![0].hands.PL1).toHaveLength(3);
    expect(handOf(after.decks!, "PL1")[0].cards.map((c) => c.label).sort()).toEqual(["A", "B", "C"]);
  });
});

describe("参加者へ送る形", () => {
  it("山札の並び・手札の中身・未公開のカードは送らず、枚数と場のカードだけ", () => {
    let s = withDeck("犯人は執事\n凶器は燭台\n動機は遺産");
    s = reduce(s, deckEvent(ctx(), "GM", { op: "draw", deckId: "d1", count: 1, to: TO_TABLE }));
    s = reduce(s, deckEvent(ctx(), "GM", { op: "draw", deckId: "d1", count: 1, to: "PL1" }));
    const shown = s.decks![0].table[0];
    const [p] = projectDecks(s.decks!);
    expect(p.pile).toEqual([]);
    expect(p.hands).toEqual({});
    expect(p.counts).toEqual({ pile: 1, discard: 0, hands: { PL1: 1 } });
    expect(p.cards.map((c) => c.id)).toEqual([shown]);

    const json = JSON.stringify(projectForPlayers(s));
    const hidden = s.decks![0].cards.filter((c) => c.id !== shown).map((c) => c.label);
    for (const h of hidden) expect(json).not.toContain(h);
    // 山札の操作そのものもログとしては送らない
    expect(projectForPlayers(s).log.some((e) => e.kind === "deck")).toBe(false);
  });
});
