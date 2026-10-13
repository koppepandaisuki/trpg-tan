import { describe, it, expect } from "vitest";
import {
  createScene,
  reduce,
  makeTokenPanel,
  panelAddEvent,
  panelMoveEvent,
  panelUpdateEvent,
  panelRemoveEvent,
  boardSetEvent,
  sceneAddEvent,
  resourceEvent,
  chatEvent,
  freeRollEvent,
  logClearEvent,
  projectForPlayers,
  diffScenes,
  applyPatch,
  mergeSnapshotLog,
  createSceneBroadcaster,
  createSceneMirror,
  type EventCtx,
  type NetMsg,
  type PlayEvent,
  type PlayScene,
  type RollEvent,
} from "../src/play/index.js";

/**
 * 卓の差分同期(sync.ts)のテスト。
 *   - 参加者向け投影が GM の秘密を通信に載せないこと
 *   - 差分を積み重ねた結果が、全量を送った場合と一致すること
 *   - GM 側の集約・全量/差分の切替、参加者側の再同期要求
 */

const NOW = "2026-01-01T00:00:00.000Z";
let seq = 0;
function ctx(): EventCtx {
  seq += 1;
  return { id: `e${seq}`, ts: NOW, rng: () => 0.5 };
}

function baseScene(): PlayScene {
  let s = createScene({ id: "t1", title: "卓", systemId: "coc7", now: NOW });
  s = reduce(s, panelAddEvent(ctx(), makeTokenPanel({ id: "a", name: "アリス", hp: 10 })));
  s = reduce(s, panelAddEvent(ctx(), makeTokenPanel({ id: "b", name: "ボブ", hp: 12 })));
  return s;
}

/** 投影の比較用: 参加者は meta を差分で受け取らないので比較から外す。 */
function comparable(s: PlayScene) {
  const { meta: _meta, ...rest } = s;
  return JSON.parse(JSON.stringify(rest));
}

describe("projectForPlayers", () => {
  it("秘匿駒と、その駒名での発言を送らない", () => {
    let s = baseScene();
    s = reduce(s, panelAddEvent(ctx(), { ...makeTokenPanel({ id: "x", name: "黒幕" }), hidden: true }));
    s = reduce(s, chatEvent(ctx(), "黒幕", "ふふふ"));
    s = reduce(s, chatEvent(ctx(), "アリス", "こんにちは"));
    const p = projectForPlayers(s);
    expect(p.panels.map((x) => x.id)).toEqual(["a", "b"]);
    expect(p.log.some((e) => e.actor === "黒幕")).toBe(false);
    expect(p.log.some((e) => e.kind === "chat" && e.text === "こんにちは")).toBe(true);
  });

  it("GM 用の情報(シナリオの秘密・シーンの GM メモ・定型文・BGM 一覧)を落とす", () => {
    const s: PlayScene = {
      ...baseScene(),
      textStock: "# 導入\n秘密の真相",
      tags: ["身内"],
      bgm: { tracks: [{ id: "t", name: "ボス戦", path: "x.mp3" }] } as PlayScene["bgm"],
      assets: [],
      scenario: {
        synopsis: "館の謎",
        players: "3〜4人",
        minutes: 180,
        gmNotes: "犯人は執事",
        handouts: [{ id: "h", label: "HO1", title: "探偵", secretText: "実は双子" }],
        npcs: [{ id: "n", name: "執事", secret: "犯人" }],
      },
    };
    s.scenes = s.scenes!.map((x) => ({ ...x, script: "読み上げ", gmNote: "罠あり", clues: ["鍵"] }));
    const p = projectForPlayers(s);
    const json = JSON.stringify(p);
    for (const secret of ["秘密の真相", "犯人", "実は双子", "罠あり", "鍵", "読み上げ", "ボス戦", "身内"]) {
      expect(json).not.toContain(secret);
    }
    expect(p.scenario).toEqual({ synopsis: "館の謎", players: "3〜4人", minutes: 180 });
    expect(p.scenes![0].name).toBe("シーン1");
  });

  it("シークレットダイスは見せる相手付きでも出目を抜く(中身は宛先にだけ個別に送る)", () => {
    let s = baseScene();
    const gmOnly: RollEvent = { ...freeRollEvent(ctx(), "GM", "1d100", "目星"), secret: true, visibleTo: [] };
    const shared: RollEvent = { ...freeRollEvent(ctx(), "GM", "1d100", "聞き耳"), secret: true, visibleTo: ["a"] };
    s = reduce(reduce(s, gmOnly), shared);
    const p = projectForPlayers(s);
    const [r1, r2] = p.log.filter((e): e is RollEvent => e.kind === "roll");
    expect(r1.redacted).toBe(true);
    expect(r1.dice).toEqual([]);
    expect(r1.label).toBe("シークレットダイス");
    expect(JSON.stringify(r1)).not.toContain("目星");
    expect(r2.redacted).toBe(true);
    expect(JSON.stringify(r2)).not.toContain("聞き耳");
    // 同じイベントは毎回同じ参照(差分で「変わった」と誤検出しない)。
    expect(projectForPlayers(s).log.find((e) => e.id === r1.id)).toBe(r1);
  });

  it("盤面系のイベントはログに載せず、件数も上限で切る", () => {
    let s = baseScene();
    for (let i = 0; i < 30; i++) s = reduce(s, panelMoveEvent(ctx(), "a", i / 30, 0.5));
    for (let i = 0; i < 10; i++) s = reduce(s, chatEvent(ctx(), "アリス", `発言${i}`));
    const p = projectForPlayers(s, { logLimit: 5 });
    expect(p.log).toHaveLength(5);
    expect(p.log.every((e) => e.kind === "chat")).toBe(true);
    expect((p.log[4] as { text: string }).text).toBe("発言9");
  });

  it("シーン一覧は入力が同じなら同じ参照を返す", () => {
    const s = baseScene();
    expect(projectForPlayers(s).scenes).toBe(projectForPlayers(s).scenes);
  });
});

describe("diffScenes / applyPatch", () => {
  it("変化が無ければ null", () => {
    const s = projectForPlayers(baseScene());
    expect(diffScenes(s, projectForPlayers(baseScene()))).toBeNull();
  });

  it("駒 1 つの移動は、その駒だけを送る", () => {
    const s0 = baseScene();
    const s1 = reduce(s0, panelMoveEvent(ctx(), "a", 0.3, 0.4));
    const patch = diffScenes(projectForPlayers(s0), projectForPlayers(s1))!;
    expect(patch.panels?.upsert?.map((p) => p.id)).toEqual(["a"]);
    expect(patch.set).toBeUndefined();
    expect(patch.log).toBeUndefined(); // 移動はログに載せない
    expect(JSON.stringify(patch).length).toBeLessThan(600);
  });

  it("いろいろな操作を差分で積み重ねると、全量と同じ卓になる", () => {
    let gm = baseScene();
    let sent = projectForPlayers(gm);
    let mirror = sent;
    const steps: ((s: PlayScene) => PlayScene)[] = [
      (s) => reduce(s, chatEvent(ctx(), "アリス", "やあ")),
      (s) => reduce(s, panelMoveEvent(ctx(), "b", 0.1, 0.9)),
      (s) => reduce(s, freeRollEvent(ctx(), "ボブ", "2d6")),
      (s) => reduce(s, resourceEvent(ctx(), "GM", s.panels[0], s.panels[0].resources[0], -3)),
      (s) => reduce(s, boardSetEvent(ctx(), { grid: false })),
      (s) => reduce(s, sceneAddEvent(ctx(), { id: "s2", name: "書斎" })),
      (s) => reduce(s, panelUpdateEvent(ctx(), "a", { hidden: true })),
      (s) => reduce(s, panelAddEvent(ctx(), makeTokenPanel({ id: "c", name: "キャロル" }))),
      (s) => ({ ...s, panels: [...s.panels].reverse() }),
      (s) => reduce(s, panelRemoveEvent(ctx(), "b")),
      (s) => ({ ...s, sharedMemos: [{ id: "m", name: "メモ", text: "合言葉" }] }),
      (s) => reduce(s, logClearEvent(ctx())),
      (s) => reduce(s, chatEvent(ctx(), "キャロル", "消えた?")),
    ];
    for (const step of steps) {
      gm = step(gm);
      const next = projectForPlayers(gm);
      const patch = diffScenes(sent, next);
      if (patch) mirror = applyPatch(mirror, patch);
      sent = next;
      expect(comparable(mirror)).toEqual(comparable(next));
    }
  });

  it("event で先に届いたチャットを、差分の追記で二重にしない", () => {
    const s0 = baseScene();
    const ev = chatEvent(ctx(), "アリス", "一度だけ");
    const s1 = reduce(s0, ev);
    const local = reduce(projectForPlayers(s0), ev); // event で先に反映済み
    const patch = diffScenes(projectForPlayers(s0), projectForPlayers(s1))!;
    const after = applyPatch(local, patch);
    expect(after.log.filter((e) => e.id === ev.id)).toHaveLength(1);
  });

  it("mergeSnapshotLog は重なる手前の古い履歴を残す", () => {
    const mk = (id: string): PlayEvent => chatEvent({ id, ts: NOW }, "A", id);
    const local = ["1", "2", "3", "4"].map(mk);
    const incoming = ["3", "4", "5"].map(mk);
    expect(mergeSnapshotLog(local, incoming).map((e) => e.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(mergeSnapshotLog(local, ["9"].map(mk)).map((e) => e.id)).toEqual(["9"]);
  });
});

describe("createSceneBroadcaster / createSceneMirror", () => {
  function wire() {
    const sent: NetMsg[] = [];
    const mirror = createSceneMirror({ resyncIntervalMs: 0 });
    let gate: Promise<void> = Promise.resolve();
    const b = createSceneBroadcaster({
      heartbeatMs: 0,
      epoch: "ep1",
      send: async (m) => {
        await gate;
        sent.push(m);
        mirror.receive(m);
      },
    });
    return {
      b,
      sent,
      mirror,
      hold() {
        let release!: () => void;
        gate = new Promise((r) => (release = r));
        return () => {
          release();
          gate = Promise.resolve();
        };
      },
    };
  }

  it("初回は全量、その後は差分を送り、参加者は GM の投影と一致する", async () => {
    const { b, sent, mirror } = wire();
    let gm = baseScene();
    b.update(gm);
    await b.flush();
    gm = reduce(gm, panelMoveEvent(ctx(), "a", 0.2, 0.2));
    b.update(gm);
    await b.flush();
    expect(sent.map((m) => m.type)).toEqual(["state", "patch"]);
    expect(comparable(mirror.scene!)).toEqual(comparable(projectForPlayers(gm)));
    b.stop();
  });

  it("送信中に来た変更は 1 本にまとめる", async () => {
    const { b, sent, hold } = wire();
    let gm = baseScene();
    b.update(gm);
    await b.flush();
    const release = hold();
    gm = reduce(gm, panelMoveEvent(ctx(), "a", 0.1, 0.1));
    b.update(gm); // これが送信中になる
    for (let i = 0; i < 20; i++) {
      gm = reduce(gm, panelMoveEvent(ctx(), "a", i / 20, 0.1));
      b.update(gm);
    }
    release();
    await b.flush();
    // 全量 1 + 差分 2(送信中の 1 本 + 待っていた 20 回分をまとめた 1 本)
    expect(sent.length).toBe(3);
    b.stop();
  });

  it("入室(hello)で全量を送り直し、旧版の参加者がいれば以後も全量", async () => {
    const { b, sent } = wire();
    let gm = baseScene();
    b.update(gm);
    await b.flush();
    b.join(2);
    await b.flush();
    expect(sent.at(-1)!.type).toBe("state");
    b.join(); // 旧版(proto 申告なし)
    await b.flush();
    gm = reduce(gm, panelMoveEvent(ctx(), "a", 0.5, 0.5));
    b.update(gm);
    await b.flush();
    expect(sent.at(-1)!.type).toBe("state");
    b.stop();
  });

  it("参加者は差分を取りこぼしたら再同期を求め、全量で追いつく", () => {
    const mirror = createSceneMirror({ resyncIntervalMs: 0 });
    const s = projectForPlayers(baseScene());
    expect(mirror.receive({ type: "state", rev: 1, epoch: "e", scene: s }).changed).toBe(true);
    // rev 2 を取りこぼして rev 3 が届いた
    const r = mirror.receive({ type: "patch", rev: 3, base: 2, epoch: "e", patch: {} });
    expect(r).toEqual({ changed: false, resync: true });
    // 心拍で GM の方が進んでいると分かった場合も再同期
    expect(mirror.receive({ type: "tick", rev: 3, epoch: "e" }).resync).toBe(true);
    expect(mirror.receive({ type: "state", rev: 3, epoch: "e", scene: s }).changed).toBe(true);
    expect(mirror.rev).toBe(3);
  });

  it("GM が開き直して rev が振り直しになっても(epoch が変われば)受け入れる", () => {
    const mirror = createSceneMirror();
    const s = projectForPlayers(baseScene());
    mirror.receive({ type: "state", rev: 50, epoch: "old", scene: s });
    expect(mirror.receive({ type: "state", rev: 1, epoch: "new", scene: s }).changed).toBe(true);
    expect(mirror.rev).toBe(1);
    // 古い世代の差分は捨てて再同期を求める
    expect(mirror.receive({ type: "patch", rev: 51, base: 50, epoch: "old", patch: {} }).resync).toBe(true);
  });

  it("再同期の要求は間隔をあける", () => {
    let t = 0;
    const mirror = createSceneMirror({ resyncIntervalMs: 1000, now: () => t });
    expect(mirror.receive({ type: "tick", rev: 1 }).resync).toBe(true);
    t = 500;
    expect(mirror.receive({ type: "tick", rev: 1 }).resync).toBe(false);
    t = 1600;
    expect(mirror.receive({ type: "tick", rev: 1 }).resync).toBe(true);
  });
});
