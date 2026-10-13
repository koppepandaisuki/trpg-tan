import { describe, it, expect } from "vitest";
import {
  readKoboManifest,
  koboScenarioToPlay,
  guessSystemId,
  parseMinutes,
  projectForPlayers,
  KoboImportError,
} from "../src/play/index.js";

/**
 * 「TRPGシナリオ工房」のバックアップ(backup_codec.dart の書き出し形式)を
 * 卓に変換するテスト。fixture は工房の _bundleToJson と同じ形。
 */

const manifest = {
  format: "trpg-scenario-kobo-backup",
  version: 1,
  app: "TRPGシナリオ工房",
  exportedAt: "2026-10-01T00:00:00.000",
  scenarios: [{ dir: "scenarios/0", id: "sc1", title: "白嶺の館", images: {} }],
};

const T = 1_700_000_000_000;
const bundle = {
  scenario: {
    id: "sc1",
    title: "白嶺の館",
    systemName: "クトゥルフ神話TRPG(6版)",
    genre: "クローズド",
    summary: "雪に閉ざされた館で、主人が消えた。",
    playerCount: "2〜3人",
    playTime: "ボイセ3〜4時間",
    recommendedSkills: "目星・図書館",
    cautions: "流血表現あり",
    lossRate: "低",
    handouts: [
      { title: "HO1 探偵", publicText: "依頼を受けた探偵。", secretText: "実は主人の息子" },
      { title: "", publicText: "", secretText: "" },
    ],
    tags: ["雪山"],
    createdAt: T,
    updatedAt: T,
  },
  chapters: [
    { id: "c2", title: "第二章 夜", summary: "", sortOrder: 1, createdAt: T, updatedAt: T },
    { id: "c1", title: "第一章 到着", summary: "", sortOrder: 0, createdAt: T, updatedAt: T },
  ],
  scenes: [
    {
      id: "s3", chapterId: "c2", title: "書斎", readAloudText: "古い本が並んでいる。",
      body: "日記がある", kpNote: "日記で真相の半分", timeLabel: "23:00",
      skillChecks: [{ skill: "図書館", difficulty: "-20", note: "日記を見つける" }],
      successSceneId: "s4", failureSceneId: null, isEnding: false,
      npcIds: ["n1"], itemIds: ["i1"], sortOrder: 0, createdAt: T, updatedAt: T,
    },
    {
      id: "s1", chapterId: "c1", title: "玄関", readAloudText: "重い扉が開く。\n\n執事が出迎えた。",
      body: "", kpNote: "", timeLabel: "", skillChecks: [], successSceneId: null,
      failureSceneId: null, isEnding: false, npcIds: ["n1"], itemIds: [], sortOrder: 0,
      createdAt: T, updatedAt: T,
    },
    {
      id: "s4", chapterId: "c2", title: "", readAloudText: "", body: "真相", kpNote: "",
      timeLabel: "", skillChecks: [], successSceneId: null, failureSceneId: null,
      isEnding: true, npcIds: [], itemIds: [], sortOrder: 1, createdAt: T, updatedAt: T,
    },
  ],
  npcs: [
    { id: "n1", name: "執事", affiliation: "白嶺家", profile: "物静か", secretNote: "犯人", isSecret: false, sortOrder: 0, createdAt: T, updatedAt: T },
  ],
  items: [
    { id: "i1", name: "日記", effect: "真相の手がかり", note: "", foundInSceneId: "s3", sortOrder: 0, createdAt: T, updatedAt: T },
  ],
};

describe("readKoboManifest", () => {
  it("シナリオの一覧を返す", () => {
    expect(readKoboManifest(manifest)).toEqual([{ dir: "scenarios/0", id: "sc1", title: "白嶺の館" }]);
  });
  it("工房のバックアップでなければ分かる言葉で断る", () => {
    expect(() => readKoboManifest({ format: "other" })).toThrow(KoboImportError);
    expect(() => readKoboManifest({ ...manifest, version: 99 })).toThrow(/最新/);
    expect(() => readKoboManifest({ ...manifest, scenarios: [] })).toThrow(/入っていません/);
  });
  it("おかしな dir(パス操作)は無視する", () => {
    expect(() =>
      readKoboManifest({ ...manifest, scenarios: [{ dir: "../etc", id: "x", title: "x" }] }),
    ).toThrow(KoboImportError);
  });
});

describe("koboScenarioToPlay", () => {
  const scene = koboScenarioToPlay(bundle, { id: "t1", now: "2026-10-14T00:00:00.000Z" });

  it("章 → シーンの順に卓のシーンを並べる", () => {
    expect(scene.scenes!.map((s) => s.name)).toEqual(["1-1 玄関", "2-1 書斎", "2-2 シーン2"]);
    expect(scene.activeSceneId).toBe(scene.scenes![0].id);
    expect(scene.systemId).toBe("coc6");
    expect(scene.title).toBe("白嶺の館");
  });

  it("読み上げ・GM メモ・判定・分岐をシーンに入れる", () => {
    const study = scene.scenes![1];
    expect(study.script).toBe("古い本が並んでいる。");
    expect(study.gmNote).toContain("日記で真相の半分");
    expect(study.gmNote).toContain("図書館(-20): 日記を見つける");
    expect(study.gmNote).toContain("成功 → 2-2 シーン2");
    expect(study.gmNote).toContain("【登場NPC】執事");
    expect(study.clues).toEqual(["図書館(-20): 日記を見つける"]);
    expect(scene.scenes![2].gmNote).toContain("【エンディング】");
  });

  it("読み上げテキストをテキストストックに並べる", () => {
    expect(scene.textStock!.split("\n")).toEqual([
      "# 第一章 到着",
      "# 1-1 玄関",
      "重い扉が開く。",
      "執事が出迎えた。",
      "# 第二章 夜",
      "# 2-1 書斎",
      "古い本が並んでいる。",
    ]);
  });

  it("NPC は秘匿の駒、HO の公開部分は共有メモ、秘密は GM 側だけ", () => {
    expect(scene.panels).toHaveLength(1);
    expect(scene.panels[0]).toMatchObject({ name: "執事", hidden: true });
    expect(scene.scenario!.handouts).toEqual([
      { id: "ho1", label: "HO1", title: "探偵", publicText: "依頼を受けた探偵。", secretText: "実は主人の息子" },
    ]);
    expect(scene.sharedMemos!.find((m) => m.id === "handouts")!.text).toContain("依頼を受けた探偵");
    expect(scene.scenario!.synopsis).toContain("推奨技能: 目星・図書館");
    expect(scene.scenario!.minutes).toBe(180);
    expect(scene.scenario!.gmNotes).toContain("日記(2-1 書斎): 真相の手がかり");

    // 参加者へ送る投影には秘密が載らない
    const json = JSON.stringify(projectForPlayers(scene));
    for (const secret of ["実は主人の息子", "犯人", "日記で真相の半分", "執事が出迎えた"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("壊れた入力でも落ちずに空の卓を作る", () => {
    const s = koboScenarioToPlay({}, { id: "t2", now: "2026-10-14T00:00:00.000Z" });
    expect(s.title).toBe("シナリオ工房の卓");
    expect(s.panels).toEqual([]);
  });
});

describe("guessSystemId / parseMinutes", () => {
  it("システム名から推定する", () => {
    expect(guessSystemId("新クトゥルフ神話TRPG")).toBe("coc7");
    expect(guessSystemId("CoC 7版")).toBe("coc7");
    expect(guessSystemId("クトゥルフ神話TRPG")).toBe("coc6");
    expect(guessSystemId("ソード・ワールド2.5")).toBe("");
  });
  it("プレイ時間を分にする", () => {
    expect(parseMinutes("3〜4時間")).toBe(180);
    expect(parseMinutes("ボイセ4h")).toBe(240);
    expect(parseMinutes("９０分")).toBe(90);
    expect(parseMinutes("短め")).toBeUndefined();
  });
});
