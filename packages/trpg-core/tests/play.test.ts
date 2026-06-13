import { describe, it, expect } from "vitest";
import type { RandomFn } from "../src/dice/random.js";
import { CCSHEET_SCHEMA_VERSION, type CharacterSheet } from "../src/character/types.js";
import {
  createScene,
  reduce,
  reduceAll,
  clampResource,
  panelFromSheet,
  makeTokenPanel,
  panelAddEvent,
  panelRemoveEvent,
  panelMoveEvent,
  panelUpdateEvent,
  boardSetEvent,
  sceneAddEvent,
  sceneSelectEvent,
  sceneRenameEvent,
  sceneRemoveEvent,
  resourceEvent,
  checkEvent,
  freeRollEvent,
  chatEvent,
  type EventCtx,
} from "../src/play/index.js";

/** 指定の出目を強制する rng 値([0,1))。die(v, sides) で v を出す。 */
function die(v: number, sides: number): number {
  return (v - 1) / sides + 1e-9;
}
/** 連続した [0,1) 値を順に返す rng。 */
function seqRng(values: number[]): RandomFn {
  let i = 0;
  return () => values[i++] ?? 0;
}

const NOW = "2026-01-01T00:00:00.000Z";

function ctx(id: string, rng?: RandomFn): EventCtx {
  return { id, ts: NOW, rng };
}

function sampleSheet(): CharacterSheet {
  return {
    schemaVersion: CCSHEET_SCHEMA_VERSION,
    id: "char-1",
    systemId: "coc7",
    name: "探索者A",
    image: null,
    characteristics: { STR: 50, CON: 60, SIZ: 60, DEX: 60, INT: 70, POW: 50, EDU: 80, APP: 55 },
    skills: { spot_hidden: 70 },
    occupationId: null,
    notes: "",
    meta: { createdAt: NOW, updatedAt: NOW },
  };
}

describe("createScene", () => {
  it("空のシーンを作る", () => {
    const s = createScene({ id: "s1", title: "卓", systemId: "coc7", now: NOW });
    expect(s.panels).toHaveLength(0);
    expect(s.log).toHaveLength(0);
    expect(s.title).toBe("卓");
    expect(s.schemaVersion).toBe(1);
  });
  it("タイトル空は既定名", () => {
    expect(createScene({ id: "s", title: "", now: NOW }).title).toBe("新しい卓");
  });
});

describe("panelFromSheet", () => {
  const panel = panelFromSheet({ id: "p1", sheet: sampleSheet() });

  it("7版は能力値そのままが判定目標値", () => {
    const str = panel.stats.find((s) => s.key === "STR");
    expect(str?.target).toBe(50);
    expect(str?.kind).toBe("characteristic");
  });

  it("技能はシート記録値が目標値", () => {
    const spot = panel.stats.find((s) => s.key === "spot_hidden");
    expect(spot?.value).toBe(70);
    expect(spot?.target).toBe(70);
    expect(spot?.kind).toBe("skill");
    expect(spot?.label).toBeTruthy();
  });

  it("HP/MP/SAN を派生値から初期化", () => {
    const hp = panel.resources.find((r) => r.key === "hp");
    const mp = panel.resources.find((r) => r.key === "mp");
    const san = panel.resources.find((r) => r.key === "san");
    expect(hp?.current).toBe(12); // floor((60+60)/10)
    expect(mp?.current).toBe(10); // floor(50/5)
    expect(san?.current).toBe(50); // POW
  });

  it("source は sheet、元シート id を保持", () => {
    expect(panel.source).toBe("sheet");
    expect(panel.sheetId).toBe("char-1");
  });
});

describe("6版は能力値×5 が目標値", () => {
  it("STR50 → 250 ではなく値×5(=実際は版定義のSTR)で確認", () => {
    const sheet = { ...sampleSheet(), systemId: "coc6", characteristics: { STR: 13 } };
    const panel = panelFromSheet({ id: "p", sheet });
    const str = panel.stats.find((s) => s.key === "STR");
    expect(str?.target).toBe(65); // 13 * 5
  });

  it("6版キャラの駒は edition='6' を持ち、判定が 6 版の段階で解決される", () => {
    const sheet = { ...sampleSheet(), systemId: "coc6", characteristics: { STR: 13 } };
    const panel = panelFromSheet({ id: "p6", sheet });
    expect(panel.edition).toBe("6");

    // 目標 65、出目 13(=65/5) は 6 版ではスペシャル(インペイル)。
    const seq = () => (13 - 1) / 100 + 1e-9; // rollDie(100) が 13 を返す
    const ev = checkEvent(
      { id: "e", ts: NOW, rng: seq },
      "探索者",
      "目星",
      65,
      panel.edition ?? "7",
    );
    expect(ev.check?.level).toBe("special");
    expect(ev.check?.isSuccess).toBe(true);
  });
});

describe("reduce", () => {
  it("panel-add で駒追加、重複は無視", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    const p = makeTokenPanel({ id: "t1", name: "敵", hp: 10 });
    s = reduce(s, panelAddEvent(ctx("e1"), p));
    expect(s.panels).toHaveLength(1);
    s = reduce(s, panelAddEvent(ctx("e2"), p)); // 同 id
    expect(s.panels).toHaveLength(1);
    expect(s.log).toHaveLength(2); // ログには両方残る
  });

  it("resource で現在値を更新", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    const p = makeTokenPanel({ id: "t1", name: "敵", hp: 10 });
    s = reduce(s, panelAddEvent(ctx("e1"), p));
    const res = s.panels[0].resources[0];
    s = reduce(s, resourceEvent(ctx("e2"), "GM", s.panels[0], res, -3));
    expect(s.panels[0].resources[0].current).toBe(7);
  });

  it("panel-remove で駒削除", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    s = reduce(s, panelAddEvent(ctx("e1"), makeTokenPanel({ id: "t1", name: "敵" })));
    s = reduce(s, panelRemoveEvent(ctx("e2"), "t1"));
    expect(s.panels).toHaveLength(0);
  });
});

describe("clampResource", () => {
  it("0..max にクランプ", () => {
    expect(clampResource(5, -10, 20)).toBe(0);
    expect(clampResource(15, 10, 20)).toBe(20);
    expect(clampResource(10, 3, 20)).toBe(13);
  });
});

describe("checkEvent(CoC 判定)", () => {
  it("出目を強制して成功度を確認(7版 target50, roll5 → extreme)", () => {
    const rng = seqRng([die(5, 100)]);
    const ev = checkEvent(ctx("e1", rng), "探索者A", "目星 判定", 50, "7");
    expect(ev.kind).toBe("roll");
    expect(ev.dice).toEqual([5]);
    expect(ev.total).toBe(5);
    expect(ev.check?.level).toBe("extreme");
    expect(ev.check?.isSuccess).toBe(true);
  });
});

describe("freeRollEvent(フリーダイス)", () => {
  it("2d6 を [3,4] に強制 → total 7", () => {
    const rng = seqRng([die(3, 6), die(4, 6)]);
    const ev = freeRollEvent(ctx("e1", rng), "GM", "2d6");
    expect(ev.dice).toEqual([3, 4]);
    expect(ev.total).toBe(7);
    expect(ev.notation).toBe("2d6");
  });
});

describe("盤面(board)", () => {
  it("createScene は board を初期化(grid on)", () => {
    const s = createScene({ id: "s", title: "卓", now: NOW });
    expect(s.board).toEqual({ image: null, grid: true });
  });

  it("panel-move で駒の正規化座標を設定(0..1 クランプ)", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    s = reduce(s, panelAddEvent(ctx("e1"), makeTokenPanel({ id: "t1", name: "敵" })));
    s = reduce(s, panelMoveEvent(ctx("e2"), "t1", 0.3, 1.4));
    expect(s.panels[0].pos).toEqual({ x: 0.3, y: 1 }); // y は 1 にクランプ
  });

  it("panel-update は名前/情報/秘匿を部分更新", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    s = reduce(s, panelAddEvent(ctx("e1"), makeTokenPanel({ id: "t1", name: "敵" })));
    s = reduce(s, panelUpdateEvent(ctx("e2"), "t1", { name: "ボス", hidden: true }));
    expect(s.panels[0].name).toBe("ボス");
    expect(s.panels[0].hidden).toBe(true);
    s = reduce(s, panelUpdateEvent(ctx("e3"), "t1", { note: "弱点は炎" }));
    expect(s.panels[0].note).toBe("弱点は炎");
    expect(s.panels[0].name).toBe("ボス"); // 据え置き
    // チャットパレットも panel-update で保存。
    s = reduce(s, panelUpdateEvent(ctx("e4"), "t1", { palette: "1d100<=70 目星" }));
    expect(s.panels[0].palette).toBe("1d100<=70 目星");
    // 速さ / レイヤー / シーン帰属も panel-update で更新できる。
    s = reduce(s, panelUpdateEvent(ctx("e5"), "t1", { speed: 12, layer: 3 }));
    expect(s.panels[0].speed).toBe(12);
    expect(s.panels[0].layer).toBe(3);
    s = reduce(s, panelUpdateEvent(ctx("e6"), "t1", { sceneId: "sc-1" }));
    expect(s.panels[0].sceneId).toBe("sc-1");
    s = reduce(s, panelUpdateEvent(ctx("e7"), "t1", { sceneId: null }));
    expect(s.panels[0].sceneId).toBeNull();
    s = reduce(s, panelUpdateEvent(ctx("e8"), "t1", { locked: true }));
    expect(s.panels[0].locked).toBe(true);
    // 差分: variants の登録と portrait の切替。
    s = reduce(
      s,
      panelUpdateEvent(ctx("e9"), "t1", {
        variants: [{ id: "v1", label: "笑顔", image: "data:v1" }],
      }),
    );
    expect(s.panels[0].variants).toHaveLength(1);
    s = reduce(s, panelUpdateEvent(ctx("e10"), "t1", { portrait: "data:v1" }));
    expect(s.panels[0].portrait).toBe("data:v1");
  });

  it("panelFromSheet は DEX から速さを初期化", () => {
    const panel = panelFromSheet({ id: "p-spd", sheet: sampleSheet() });
    expect(panel.speed).toBe(60); // sampleSheet の DEX
  });

  it("board-set は指定フィールドだけ反映", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    s = reduce(s, boardSetEvent(ctx("e1"), { grid: false }));
    expect(s.board).toEqual({ image: null, grid: false });
    s = reduce(s, boardSetEvent(ctx("e2"), { image: "data:img" }));
    expect(s.board).toEqual({ image: "data:img", grid: false });
  });

  it("board-set は active シーンの盤面にも反映", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    s = reduce(s, boardSetEvent(ctx("e1"), { image: "data:a", grid: false }));
    const active = s.scenes?.find((x) => x.id === s.activeSceneId);
    expect(active?.board).toEqual({ image: "data:a", grid: false });
  });
});

describe("シーン(scene)", () => {
  it("createScene は既定シーン1つを active で持つ", () => {
    const s = createScene({ id: "s", title: "卓", now: NOW });
    expect(s.scenes).toHaveLength(1);
    expect(s.activeSceneId).toBe(s.scenes?.[0].id);
    expect(s.scenes?.[0].name).toBe("シーン1");
    expect(s.scenes?.[0].board).toEqual({ image: null, grid: true });
  });

  it("scene-add で追加し、追加したシーンへ切替(盤面は空)", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    s = reduce(s, boardSetEvent(ctx("e1"), { image: "data:1" }));
    s = reduce(s, sceneAddEvent(ctx("e2"), { id: "sc2", name: "シーン2" }));
    expect(s.scenes).toHaveLength(2);
    expect(s.activeSceneId).toBe("sc2");
    expect(s.board).toEqual({ image: null, grid: true }); // 新シーンは空盤面
  });

  it("scene-select で盤面が切り替わる(各シーンの盤面は独立)", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    const firstId = s.activeSceneId!;
    s = reduce(s, boardSetEvent(ctx("e1"), { image: "data:first" }));
    s = reduce(s, sceneAddEvent(ctx("e2"), { id: "sc2", name: "シーン2" }));
    s = reduce(s, boardSetEvent(ctx("e3"), { image: "data:second" }));
    // 1つ目へ戻ると盤面も戻る
    s = reduce(s, sceneSelectEvent(ctx("e4"), firstId));
    expect(s.board).toEqual({ image: "data:first", grid: true });
    // 2つ目へ進むと別盤面
    s = reduce(s, sceneSelectEvent(ctx("e5"), "sc2"));
    expect(s.board).toEqual({ image: "data:second", grid: true });
  });

  it("scene-select は存在しない id を無視", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    const before = s.activeSceneId;
    s = reduce(s, sceneSelectEvent(ctx("e1"), "missing"));
    expect(s.activeSceneId).toBe(before);
  });

  it("scene-rename で名前を変更", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    const id = s.activeSceneId!;
    s = reduce(s, sceneRenameEvent(ctx("e1"), id, "導入"));
    expect(s.scenes?.[0].name).toBe("導入");
  });

  it("scene-remove は active を消すと先頭へ切替", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    const firstId = s.activeSceneId!;
    s = reduce(s, sceneAddEvent(ctx("e1"), { id: "sc2", name: "シーン2" }));
    // active = sc2。これを消すと残りの先頭(firstId)へ。
    s = reduce(s, sceneRemoveEvent(ctx("e2"), "sc2"));
    expect(s.scenes).toHaveLength(1);
    expect(s.activeSceneId).toBe(firstId);
  });

  it("scene-remove は最後の1つを消さない", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    const id = s.activeSceneId!;
    s = reduce(s, sceneRemoveEvent(ctx("e1"), id));
    expect(s.scenes).toHaveLength(1);
    expect(s.activeSceneId).toBe(id);
  });

  it("非 active を消しても active は維持", () => {
    let s = createScene({ id: "s", title: "卓", now: NOW });
    const firstId = s.activeSceneId!;
    s = reduce(s, sceneAddEvent(ctx("e1"), { id: "sc2", name: "シーン2" }));
    // active = sc2。firstId を消す。
    s = reduce(s, sceneRemoveEvent(ctx("e2"), firstId));
    expect(s.scenes).toHaveLength(1);
    expect(s.activeSceneId).toBe("sc2");
  });
});

describe("reduceAll(ログから再構成)", () => {
  it("イベント列を順に適用して同じ状態に", () => {
    const base = createScene({ id: "s", title: "卓", now: NOW });
    const p = makeTokenPanel({ id: "t1", name: "敵", hp: 10 });
    const events = [
      panelAddEvent(ctx("e1"), p),
      chatEvent(ctx("e2"), "GM", "戦闘開始"),
      resourceEvent(ctx("e3"), "GM", p, p.resources[0], -4),
    ];
    const s = reduceAll(base, events);
    expect(s.panels[0].resources[0].current).toBe(6);
    expect(s.log).toHaveLength(3);
  });
});
