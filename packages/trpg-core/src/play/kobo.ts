import { createScene } from "./reduce.js";
import { makeTokenPanel } from "./panel.js";
import type {
  Handout,
  MemoPage,
  PlayScene,
  ScenarioInfo,
  ScenarioNpc,
  SceneInfo,
} from "./types.js";

/**
 * 「TRPGシナリオ工房」(姉妹アプリ・Flutter)のバックアップ zip を卓にする。
 *
 * 工房の「バックアップ → 書き出し」で作った zip をそのまま読み込める(工房側の
 * 改修は不要)。形式は工房の lib/application/backup/backup_codec.dart:
 *
 *   manifest.json                     { format, version, scenarios: [{ dir, id, title }] }
 *   scenarios/<n>/scenario.json       { scenario, chapters, scenes, npcs, items }
 *
 * 卓への割り当て:
 *   - 章 → シーンの順に、工房のシーン 1 つ = 卓のシーン 1 つ(ワンクリックで切替)
 *     読み上げテキスト → script / 本文・KP メモ・判定・分岐 → gmNote / 判定 → clues
 *   - 読み上げテキストはテキストストックにも並べる(クリックでチャットへ流せる)
 *   - NPC → 秘匿状態の駒(登場したら GM が公開する)+ シナリオ情報の NPC 覚書
 *   - ハンドアウト → シナリオ情報の HO(秘密は GM 側だけ)+ 公開部分は共有メモ
 *   - 推奨技能・注意事項・ロスト率・あらすじ → シナリオ情報(公開情報)
 *   - アイテム → GM メモ
 *
 * zip の展開は呼び出し側(Web: fflate / デスクトップ: fflate)。ここは JSON だけを扱う
 * (@trpg/core をランタイム依存ゼロに保つため)。
 */

export const KOBO_BACKUP_FORMAT = "trpg-scenario-kobo-backup";
/** 読める工房バックアップの版の上限。 */
export const KOBO_BACKUP_MAX_VERSION = 1;

export class KoboImportError extends Error {}

export interface KoboScenarioRef {
  dir: string;
  id: string;
  title: string;
}

type Json = Record<string, unknown>;

function obj(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}
function arr(v: unknown): Json[] {
  return Array.isArray(v) ? v.map(obj) : [];
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** manifest.json を検証して、入っているシナリオの一覧を返す。 */
export function readKoboManifest(manifest: unknown): KoboScenarioRef[] {
  const m = obj(manifest);
  if (m.format !== KOBO_BACKUP_FORMAT) {
    throw new KoboImportError(
      "「TRPGシナリオ工房」のバックアップ(.zip)ではないようです。工房の「バックアップ」から書き出したファイルを選んでください。",
    );
  }
  if (num(m.version) > KOBO_BACKUP_MAX_VERSION) {
    throw new KoboImportError(
      "新しい版のシナリオ工房で作られたバックアップです。Re-dice を最新にしてから読み込んでください。",
    );
  }
  const list = arr(m.scenarios)
    .map((s) => ({ dir: str(s.dir), id: str(s.id), title: str(s.title) }))
    .filter((s) => /^scenarios\/[0-9]+$/.test(s.dir));
  if (list.length === 0) {
    throw new KoboImportError("バックアップにシナリオが入っていません。");
  }
  return list;
}

/** "6版" / "7版" / "新クトゥルフ" などから卓のシステムを推定する。 */
export function guessSystemId(systemName: string): string {
  const s = systemName.replace(/\s/g, "");
  if (/新クトゥルフ|7版|第7版|7th|coc7/i.test(s)) return "coc7";
  if (/クトゥルフ|cthulhu|coc/i.test(s)) return "coc6";
  return "";
}

/** "3〜4時間" "180分" "ボイセ4h" → 分。読めなければ undefined。 */
export function parseMinutes(playTime: string): number | undefined {
  const t = playTime.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  // "3〜4時間" は短い方(下限)を採る。
  const h = t.match(/(\d+(?:\.\d+)?)\s*(?:[〜~～\-－]\s*\d+(?:\.\d+)?\s*)?(?:時間|h|H)/);
  if (h) return Math.round(parseFloat(h[1]) * 60);
  const m = t.match(/(\d+)\s*分/);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

interface KoboScene {
  id: string;
  chapterId: string;
  title: string;
  readAloudText: string;
  body: string;
  kpNote: string;
  timeLabel: string;
  checks: { skill: string; difficulty: string; note: string }[];
  successSceneId: string | null;
  failureSceneId: string | null;
  isEnding: boolean;
  npcIds: string[];
  itemIds: string[];
  sortOrder: number;
}

/**
 * 工房のシナリオ 1 本(scenario.json)を卓にする。
 * @param id 新しい卓の id(呼び出し側で発行)
 */
export function koboScenarioToPlay(
  bundle: unknown,
  opts: { id: string; now: string },
): PlayScene {
  const b = obj(bundle);
  const sc = obj(b.scenario);
  const title = str(sc.title).trim() || "シナリオ工房の卓";
  const systemName = str(sc.systemName);

  const chapters = arr(b.chapters)
    .map((c) => ({ id: str(c.id), title: str(c.title), order: num(c.sortOrder) }))
    .sort((a, c) => a.order - c.order);
  const chapterIndex = new Map(chapters.map((c, i) => [c.id, i]));

  const scenes: KoboScene[] = arr(b.scenes)
    .map((e) => ({
      id: str(e.id),
      chapterId: str(e.chapterId),
      title: str(e.title),
      readAloudText: str(e.readAloudText),
      body: str(e.body),
      kpNote: str(e.kpNote),
      timeLabel: str(e.timeLabel),
      checks: arr(e.skillChecks).map((c) => ({
        skill: str(c.skill),
        difficulty: str(c.difficulty),
        note: str(c.note),
      })),
      successSceneId: str(e.successSceneId) || null,
      failureSceneId: str(e.failureSceneId) || null,
      isEnding: e.isEnding === true,
      npcIds: Array.isArray(e.npcIds) ? e.npcIds.map(str) : [],
      itemIds: Array.isArray(e.itemIds) ? e.itemIds.map(str) : [],
      sortOrder: num(e.sortOrder),
    }))
    .sort(
      (a, c) =>
        (chapterIndex.get(a.chapterId) ?? 1e9) - (chapterIndex.get(c.chapterId) ?? 1e9) ||
        a.sortOrder - c.sortOrder,
    );

  const npcs = arr(b.npcs)
    .map((n) => ({
      id: str(n.id),
      name: str(n.name).trim(),
      affiliation: str(n.affiliation),
      profile: str(n.profile),
      secretNote: str(n.secretNote),
      isSecret: n.isSecret === true,
      order: num(n.sortOrder),
    }))
    .filter((n) => n.name)
    .sort((a, c) => a.order - c.order);
  const items = arr(b.items)
    .map((i) => ({
      id: str(i.id),
      name: str(i.name).trim(),
      effect: str(i.effect),
      note: str(i.note),
      foundIn: str(i.foundInSceneId),
      order: num(i.sortOrder),
    }))
    .filter((i) => i.name)
    .sort((a, c) => a.order - c.order);

  const npcName = new Map(npcs.map((n) => [n.id, n.name]));
  const itemName = new Map(items.map((i) => [i.id, i.name]));

  // シーン名: 章が 2 つ以上あれば「章-番号」を前に付けて並びを分かりやすく。
  const multiChapter = chapters.length > 1;
  const perChapter = new Map<string, number>();
  const sceneLabel = new Map<string, string>();
  for (const s of scenes) {
    const ci = chapterIndex.get(s.chapterId) ?? 0;
    const k = (perChapter.get(s.chapterId) ?? 0) + 1;
    perChapter.set(s.chapterId, k);
    const base = s.title.trim() || `シーン${k}`;
    sceneLabel.set(s.id, multiChapter ? `${ci + 1}-${k} ${base}` : base);
  }

  const playScenes: SceneInfo[] = scenes.map((s, i) => {
    const gm: string[] = [];
    if (s.timeLabel) gm.push(`🕒 ${s.timeLabel}`);
    if (s.body.trim()) gm.push(s.body.trim());
    if (s.kpNote.trim()) gm.push(`【KPメモ】\n${s.kpNote.trim()}`);
    if (s.checks.length > 0) {
      gm.push(
        "【判定】\n" +
          s.checks
            .map(
              (c) =>
                `・${c.skill}${c.difficulty ? `(${c.difficulty})` : ""}${c.note ? `: ${c.note}` : ""}`,
            )
            .join("\n"),
      );
    }
    const branch: string[] = [];
    if (s.successSceneId) branch.push(`成功 → ${sceneLabel.get(s.successSceneId) ?? "?"}`);
    if (s.failureSceneId) branch.push(`失敗 → ${sceneLabel.get(s.failureSceneId) ?? "?"}`);
    if (branch.length > 0) gm.push(`【分岐】\n${branch.join("\n")}`);
    if (s.isEnding) gm.push("【エンディング】");
    const who = s.npcIds.map((id) => npcName.get(id)).filter(Boolean);
    if (who.length > 0) gm.push(`【登場NPC】${who.join("・")}`);
    const what = s.itemIds.map((id) => itemName.get(id)).filter(Boolean);
    if (what.length > 0) gm.push(`【アイテム】${what.join("・")}`);

    const info: SceneInfo = {
      id: `${opts.id}::k${i + 1}`,
      name: sceneLabel.get(s.id) ?? `シーン${i + 1}`,
      board: { image: null, grid: false },
    };
    if (s.readAloudText.trim()) info.script = s.readAloudText.trim();
    if (gm.length > 0) info.gmNote = gm.join("\n\n");
    const clues = s.checks
      .filter((c) => c.skill)
      .map((c) => `${c.skill}${c.difficulty ? `(${c.difficulty})` : ""}${c.note ? `: ${c.note}` : ""}`);
    if (clues.length > 0) info.clues = clues;
    return info;
  });

  // テキストストック: 章見出し + 読み上げテキスト(1 行 1 テキスト)。
  const stock: string[] = [];
  let lastChapter = "";
  for (const s of scenes) {
    if (multiChapter && s.chapterId !== lastChapter) {
      lastChapter = s.chapterId;
      const ch = chapters[chapterIndex.get(s.chapterId) ?? -1];
      if (ch?.title) stock.push(`# ${ch.title}`);
    }
    const lines = s.readAloudText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    stock.push(`# ${sceneLabel.get(s.id)}`);
    stock.push(...lines);
  }

  const handouts: Handout[] = arr(sc.handouts)
    .filter((h) => str(h.title).trim() || str(h.publicText).trim() || str(h.secretText).trim())
    .map((h, i) => {
      const raw = str(h.title).trim();
      const m = raw.match(/^(HO\s*[0-9０-９]+)\s*(.*)$/i);
      return {
        id: `ho${i + 1}`,
        label: m ? m[1].replace(/\s/g, "") : `HO${i + 1}`,
        title: m ? m[2] || raw : raw || `HO${i + 1}`,
        publicText: str(h.publicText),
        secretText: str(h.secretText),
      };
    });

  const scenarioNpcs: ScenarioNpc[] = npcs.map((n) => ({
    id: n.id,
    name: n.name,
    note: [n.affiliation, n.profile].filter((x) => x.trim()).join("\n"),
    secret: [n.isSecret ? "【秘匿NPC】" : "", n.secretNote].filter(Boolean).join("\n"),
  }));

  const pub: string[] = [];
  if (str(sc.summary).trim()) pub.push(str(sc.summary).trim());
  if (str(sc.genre).trim()) pub.push(`ジャンル: ${str(sc.genre).trim()}`);
  if (systemName.trim()) pub.push(`システム: ${systemName.trim()}`);
  if (str(sc.playTime).trim()) pub.push(`プレイ時間: ${str(sc.playTime).trim()}`);
  if (str(sc.recommendedSkills).trim())
    pub.push(`推奨技能: ${str(sc.recommendedSkills).trim()}`);
  if (str(sc.lossRate).trim()) pub.push(`ロスト率: ${str(sc.lossRate).trim()}`);
  if (str(sc.cautions).trim()) pub.push(`注意事項: ${str(sc.cautions).trim()}`);

  const gmNotes: string[] = [];
  if (items.length > 0) {
    gmNotes.push(
      "■ アイテム\n" +
        items
          .map((i) => {
            const at = i.foundIn ? sceneLabel.get(i.foundIn) : undefined;
            return `・${i.name}${at ? `(${at})` : ""}${i.effect ? `: ${i.effect}` : ""}${i.note ? ` ※${i.note}` : ""}`;
          })
          .join("\n"),
    );
  }

  const scenario: ScenarioInfo = {};
  if (pub.length > 0) scenario.synopsis = pub.join("\n");
  const players = str(sc.playerCount).trim();
  if (players) scenario.players = players;
  const minutes = parseMinutes(str(sc.playTime));
  if (minutes) scenario.minutes = minutes;
  if (gmNotes.length > 0) scenario.gmNotes = gmNotes.join("\n\n");
  if (handouts.length > 0) scenario.handouts = handouts;
  if (scenarioNpcs.length > 0) scenario.npcs = scenarioNpcs;

  const base = createScene({
    id: opts.id,
    title,
    systemId: guessSystemId(systemName),
    now: opts.now,
  });

  // 共有メモ: ハンドアウトの公開部分(参加者全員が見てよい導入)。
  const memos: MemoPage[] = [{ id: "main", name: "メモ", text: "" }];
  const hoPublic = handouts
    .filter((h) => h.publicText?.trim())
    .map((h) => `【${h.label} ${h.title}】\n${h.publicText!.trim()}`);
  if (hoPublic.length > 0) {
    memos.push({ id: "handouts", name: "ハンドアウト", text: hoPublic.join("\n\n") });
  }

  // NPC は秘匿の駒として用意(登場したら GM が「公開」する)。
  const panels = npcs.map((n, i) =>
    ({
      ...makeTokenPanel({ id: `${opts.id}::npc${i + 1}`, name: n.name }),
      hidden: true,
      note: [n.affiliation, n.profile].filter((x) => x.trim()).join("\n"),
    }),
  );

  const out: PlayScene = {
    ...base,
    panels,
    scenario,
    sharedMemos: memos,
    tags: ["シナリオ工房"],
  };
  if (playScenes.length > 0) {
    out.scenes = playScenes;
    out.activeSceneId = playScenes[0].id;
    out.board = playScenes[0].board;
  }
  if (stock.length > 0) out.textStock = stock.join("\n");
  return out;
}
