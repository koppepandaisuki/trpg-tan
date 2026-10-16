import { SYNC_PROTOCOL, type NetMsg } from "./net.js";
import { reduce } from "./reduce.js";
import { publicEventFor } from "./secrets.js";
import { projectDecks } from "./deck.js";
import type {
  Panel,
  PlayEvent,
  PlayScene,
  ScenarioInfo,
  SceneInfo,
} from "./types.js";

/**
 * 卓の状態同期(GM → 参加者)。Web 版・デスクトップ版の両方がこれを使う。
 *
 * 旧方式は「変更のたびに卓全体(ログ込み)を送る」だったため、長時間の卓ほど
 * 1 回の同期が重くなり(数百 KB → 複数チャンク × ack 往復)、駒を動かしてから
 * 相手の画面に出るまでが秒単位で遅れていた。ここでは:
 *
 *   1. projectForPlayers … GM だけが知るべき情報(秘匿駒・GM メモ・シナリオの秘密・
 *      GM だけのシークレットダイスの出目)を **通信に載せない** 参加者向けの投影を作る。
 *   2. diffScenes / applyPatch … 前回送った投影との差分だけを送る(駒 1 つの移動なら
 *      数百バイト)。ログは「追記分」だけ。
 *   3. createSceneBroadcaster … GM 側。連続した変更を 1 本の送信に集約し、
 *      新規参加者・再同期要求には全量(state)を送る。旧版の参加者がいれば全量に戻す。
 *   4. createSceneMirror … 参加者側。state / patch / event を適用して GM と同じ
 *      状態を保つ。rev がずれたら再同期(hello の再送)を求める。
 */

/* ===== 1. 参加者向けの投影 ===== */

/** 参加者のログに載せるイベント(盤面の状態は state / patch が運ぶので表示用だけ)。 */
const DISPLAY_KINDS = new Set<PlayEvent["kind"]>([
  "chat",
  "roll",
  "system",
  "turn-set",
  "resource",
]);

/** 参加者へ送るログの件数(全量送信時。以後は追記分だけを送る)。 */
export const PLAYER_LOG_LIMIT = 200;

export interface ProjectOptions {
  logLimit?: number;
}

// 入力が同じ参照なら投影結果も同じ参照を返す(差分検出を参照比較で済ませるため)。
const sceneListCache = new WeakMap<SceneInfo[], SceneInfo[]>();
const sceneInfoCache = new WeakMap<SceneInfo, SceneInfo>();
const scenarioCache = new WeakMap<ScenarioInfo, ScenarioInfo>();
/** 投影したログが上限で切れているか(切れていなければ先頭の欠けは「削除」と分かる)。 */
const truncatedLogs = new WeakSet<PlayEvent[]>();

/**
 * 参加者へ送ってよい部分だけの卓。GM の手元の卓(scene)は変更しない。
 *
 * 落とすもの:
 *   - 秘匿駒(hidden)と、その駒名での発言・ダイス
 *   - シーンの GM メモ・手がかり・読み上げ台本(先のシーンのネタバレになる)
 *   - シナリオ情報のうち、あらすじ・人数・時間以外(GM メモ / HO の秘密 / NPC)
 *   - テキストストック(GM の定型文)、BGM/SE の一覧、素材庫、タグ
 *   - シークレットダイスの出目(印だけ送る。見せる相手には個別に暗号化して送る)
 *   - 個別チャット(宛先にだけ個別に暗号化して送る)
 */
export function projectForPlayers(
  scene: PlayScene,
  opts: ProjectOptions = {},
): PlayScene {
  const limit = opts.logLimit ?? PLAYER_LOG_LIMIT;
  const hidden = scene.panels.filter((p) => p.hidden);
  const panels =
    hidden.length === 0 ? scene.panels : scene.panels.filter((p) => !p.hidden);
  const hiddenNames = new Set(hidden.map((p) => p.name));

  // 末尾から必要な件数だけ拾う(長時間卓でも全履歴を毎回走査しない)。
  const log: PlayEvent[] = [];
  let i = scene.log.length - 1;
  for (; i >= 0 && log.length < limit; i--) {
    const ev = scene.log[i];
    if (!DISPLAY_KINDS.has(ev.kind)) continue;
    if (hiddenNames.has(ev.actor)) continue;
    // シークレットダイスは印だけ、個別チャットは載せない(中身は宛先にだけ
    // 暗号化して個別に送る。secrets.ts / seal.ts)。
    const pub = publicEventFor(ev);
    if (pub) log.push(pub);
  }
  log.reverse();
  if (i >= 0) truncatedLogs.add(log);

  const {
    textStock: _textStock,
    bgm: _bgm,
    se: _se,
    assets: _assets,
    tags: _tags,
    scenario,
    scenes,
    decks,
    log: _log,
    panels: _panels,
    ...rest
  } = scene;
  const out: PlayScene = { ...rest, panels, log };
  // 山札は枚数と場のカードだけ(並び順・手札・未公開カードは送らない)。
  if (decks && decks.length > 0) out.decks = projectDecksCached(decks);
  if (scenes) out.scenes = projectScenes(scenes);
  if (scenario) {
    const s = projectScenario(scenario);
    if (s) out.scenario = s;
  }
  return out;
}

const deckListCache = new WeakMap<object, ReturnType<typeof projectDecks>>();
function projectDecksCached(decks: NonNullable<PlayScene["decks"]>) {
  let out = deckListCache.get(decks);
  if (!out) {
    out = projectDecks(decks);
    deckListCache.set(decks, out);
  }
  return out;
}

function projectScenes(scenes: SceneInfo[]): SceneInfo[] {
  let out = sceneListCache.get(scenes);
  if (!out) {
    out = scenes.map((s) => {
      let p = sceneInfoCache.get(s);
      if (!p) {
        const { script: _script, gmNote: _gmNote, clues: _clues, ...pub } = s;
        p = pub;
        sceneInfoCache.set(s, p);
      }
      return p;
    });
    sceneListCache.set(scenes, out);
  }
  return out;
}

function projectScenario(s: ScenarioInfo): ScenarioInfo | undefined {
  if (!s.synopsis && !s.players && s.minutes == null) return undefined;
  let p = scenarioCache.get(s);
  if (!p) {
    p = {};
    if (s.synopsis) p.synopsis = s.synopsis;
    if (s.players) p.players = s.players;
    if (s.minutes != null) p.minutes = s.minutes;
    scenarioCache.set(s, p);
  }
  return p;
}

/* ===== 2. 差分 ===== */

/** 前回送った卓 → 今回の卓 の差分。undefined のフィールドは「変更なし」。 */
export interface ScenePatch {
  /** 置き換えるトップレベルのフィールド(panels / log / meta 以外)。 */
  set?: Record<string, unknown>;
  /** 消えたトップレベルのフィールド。 */
  unset?: string[];
  panels?: {
    /** 追加・変更された駒(丸ごと)。 */
    upsert?: Panel[];
    remove?: string[];
    /** 並び順が単純な追記で表せないときだけ、全 id の並び。 */
    order?: string[];
  };
  log?: {
    /** 末尾に追記するイベント。 */
    append?: PlayEvent[];
    /** ログを丸ごと置き換える(GM がログを消した等)。 */
    reset?: PlayEvent[];
  };
}

const NOT_DIFFED = new Set(["panels", "log", "meta"]);

function sameJson(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** 差分を作る。変化が無ければ null。 */
export function diffScenes(prev: PlayScene, next: PlayScene): ScenePatch | null {
  const patch: ScenePatch = {};
  const p = prev as unknown as Record<string, unknown>;
  const n = next as unknown as Record<string, unknown>;

  const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
  for (const k of keys) {
    if (NOT_DIFFED.has(k)) continue;
    if (p[k] === n[k]) continue;
    if (n[k] === undefined) {
      if (p[k] !== undefined) (patch.unset ??= []).push(k);
    } else if (!sameJson(p[k], n[k])) {
      (patch.set ??= {})[k] = n[k];
    }
  }

  if (prev.panels !== next.panels) {
    const before = new Map(prev.panels.map((x) => [x.id, x]));
    const nextIds = new Set(next.panels.map((x) => x.id));
    const upsert = next.panels.filter((x) => {
      const old = before.get(x.id);
      return !old || (old !== x && !sameJson(old, x));
    });
    const remove = prev.panels.filter((x) => !nextIds.has(x.id)).map((x) => x.id);
    // 「残った駒の元の並び + 新しい駒を末尾」で今回の並びになるなら order は不要。
    const naive = [
      ...prev.panels.filter((x) => nextIds.has(x.id)).map((x) => x.id),
      ...next.panels.filter((x) => !before.has(x.id)).map((x) => x.id),
    ];
    const ids = next.panels.map((x) => x.id);
    const reordered = naive.join("\n") !== ids.join("\n");
    if (upsert.length > 0 || remove.length > 0 || reordered) {
      patch.panels = {};
      if (upsert.length > 0) patch.panels.upsert = upsert;
      if (remove.length > 0) patch.panels.remove = remove;
      if (reordered) patch.panels.order = ids;
    }
  }

  const logPatch = diffLog(prev.log, next.log);
  if (logPatch) patch.log = logPatch;

  return Object.keys(patch).length > 0 ? patch : null;
}

function diffLog(
  prev: PlayEvent[],
  next: PlayEvent[],
): ScenePatch["log"] | null {
  if (prev === next) return null;
  if (next.length === 0) return prev.length === 0 ? null : { reset: [] };
  if (prev.length === 0) return { append: next };
  // 投影のログは「末尾 N 件の窓」なので、前回の最後の 1 件が今回のどこにあるかで
  // 追記分を決める(窓が滑って先頭が落ちても追記として扱える)。
  const lastId = prev[prev.length - 1].id;
  let idx = -1;
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].id === lastId) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return { reset: next };
  // 重なっている部分が前回の末尾と同じ並びか(駒を秘匿にしてその駒の発言が
  // 遡って消えた等、途中が変わったなら丸ごと置き換える)。
  const overlap = idx + 1;
  if (overlap > prev.length) return { reset: next };
  // 窓が切れていない(全件入っている)のに前回の先頭側が欠けた = 遡って消えた。
  if (overlap < prev.length && !truncatedLogs.has(next)) return { reset: next };
  for (let i = 0; i < overlap; i++) {
    if (next[i].id !== prev[prev.length - overlap + i].id) return { reset: next };
  }
  if (idx === next.length - 1) return null;
  return { append: next.slice(idx + 1) };
}

/** 参加者側で保持するログの上限(古いものから捨てる)。 */
export const MIRROR_LOG_CAP = 2000;

/** 差分を適用した新しい卓を返す(引数は変更しない)。 */
export function applyPatch(
  scene: PlayScene,
  patch: ScenePatch,
  logCap: number = MIRROR_LOG_CAP,
): PlayScene {
  const out = { ...scene } as unknown as Record<string, unknown>;
  if (patch.set) for (const [k, v] of Object.entries(patch.set)) out[k] = v;
  if (patch.unset) for (const k of patch.unset) delete out[k];

  if (patch.panels) {
    const { upsert = [], remove = [], order } = patch.panels;
    const removed = new Set(remove);
    const changed = new Map(upsert.map((x) => [x.id, x]));
    const panels: Panel[] = [];
    for (const x of scene.panels) {
      if (removed.has(x.id)) continue;
      const c = changed.get(x.id);
      panels.push(c ?? x);
      changed.delete(x.id);
    }
    for (const c of changed.values()) panels.push(c);
    if (order) {
      const rank = new Map(order.map((id, i) => [id, i]));
      panels.sort(
        (a, b) =>
          (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    }
    out.panels = panels;
  }

  if (patch.log) {
    if (patch.log.reset) out.log = capLog(patch.log.reset, logCap);
    else if (patch.log.append)
      out.log = appendUnique(scene.log, patch.log.append, logCap);
  }
  return out as unknown as PlayScene;
}

/** 既に持っている id(event で先に届いたチャット等)を除いて追記する。 */
function appendUnique(
  log: PlayEvent[],
  add: PlayEvent[],
  cap: number,
): PlayEvent[] {
  // 重複が起こり得るのは直近だけなので末尾の一部だけ見る。
  const recent = new Set(log.slice(-Math.max(64, add.length * 2)).map((e) => e.id));
  const fresh = add.filter((e) => !recent.has(e.id));
  if (fresh.length === 0) return log;
  return capLog([...log, ...fresh], cap);
}

function capLog(log: PlayEvent[], cap: number): PlayEvent[] {
  return log.length > cap ? log.slice(log.length - cap) : log;
}

/**
 * 全量(state)を受けたときのログの合流。手元に既にある古い履歴は残し、
 * 全量側の窓(末尾 N 件)と重なるところから先を差し替える(再同期でスクロール
 * バックが消えないように)。重ならなければ全量側で置き換える。
 */
export function mergeSnapshotLog(
  local: PlayEvent[],
  incoming: PlayEvent[],
  cap: number = MIRROR_LOG_CAP,
): PlayEvent[] {
  if (incoming.length === 0 || local.length === 0) return capLog(incoming, cap);
  const firstId = incoming[0].id;
  const at = local.findIndex((e) => e.id === firstId);
  if (at === -1) return capLog(incoming, cap);
  return capLog([...local.slice(0, at), ...incoming], cap);
}

/* ===== 3. GM 側: 集約して配信 ===== */

export interface SceneBroadcaster {
  /** GM の卓が変わるたびに呼ぶ。送信は集約され、送信中の変更は 1 本にまとまる。 */
  update(scene: PlayScene): void;
  /**
   * 参加者の入室 / 再同期要求(hello)。次の配信を全量(state)にする。
   * proto が 2 未満(旧版)なら以後は全量配信だけにする。
   */
  join(proto?: number): void;
  /** 送信中のものが送り終わるのを待つ。 */
  flush(): Promise<void>;
  /** 心拍を止める(卓を閉じるとき)。 */
  stop(): void;
  readonly rev: number;
  readonly epoch: string;
}

export interface BroadcasterParams {
  send: (msg: NetMsg) => Promise<void>;
  /** 参加者向けの投影。既定は projectForPlayers。 */
  project?: (scene: PlayScene) => PlayScene;
  /**
   * 送信前の加工(デスクトップ: 画像 data URL を "cas:" 参照に置き換え、画像は
   * before のメッセージで先に送る)。差分はこの加工後の卓同士で取る。
   */
  prepare?: (
    scene: PlayScene,
  ) => Promise<{ scene: PlayScene; before?: NetMsg[] }>;
  /** rev の心拍間隔(ms)。0 で無効。既定 8 秒。 */
  heartbeatMs?: number;
  /** GM の配信の世代 id(GM がページを開き直すと変わる)。 */
  epoch?: string;
}

export function createSceneBroadcaster(
  params: BroadcasterParams,
): SceneBroadcaster {
  const project = params.project ?? ((s: PlayScene) => projectForPlayers(s));
  const epoch = params.epoch ?? globalThis.crypto.randomUUID();
  let latest: PlayScene | null = null;
  let lastSent: PlayScene | null = null;
  let rev = 0;
  let needFull = true;
  let legacy = false;
  let dirty = false;
  let running: Promise<void> | null = null;

  async function loop() {
    do {
      dirty = false;
      if (!latest) break;
      try {
        const projected = project(latest);
        const prepared = params.prepare
          ? await params.prepare(projected)
          : { scene: projected };
        for (const m of prepared.before ?? []) await params.send(m);
        const next = prepared.scene;
        if (needFull || legacy || !lastSent) {
          needFull = false;
          rev += 1;
          await params.send({ type: "state", rev, epoch, scene: next });
          lastSent = next;
        } else {
          const patch = diffScenes(lastSent, next);
          if (patch) {
            const base = rev;
            rev += 1;
            await params.send({ type: "patch", rev, base, epoch, patch });
            lastSent = next;
          }
        }
      } catch {
        // 送り損ねた可能性があるので、次は全量で確実に揃える。
        needFull = true;
        break;
      }
    } while (dirty);
  }

  function kick() {
    if (running) {
      dirty = true;
      return;
    }
    running = loop().finally(() => {
      running = null;
    });
  }

  const hbMs = params.heartbeatMs ?? 8000;
  const timer =
    hbMs > 0
      ? setInterval(() => {
          if (rev === 0 || running) return;
          if (legacy) {
            // 旧版の参加者は tick を知らないので、全量を定期的に送り直して収束させる。
            needFull = true;
            kick();
          } else {
            void params.send({ type: "tick", rev, epoch }).catch(() => {});
          }
        }, hbMs)
      : null;

  return {
    update(scene) {
      latest = scene;
      kick();
    },
    join(proto) {
      if ((proto ?? 1) < SYNC_PROTOCOL) legacy = true;
      needFull = true;
      kick();
    },
    async flush() {
      while (running) await running;
    },
    stop() {
      if (timer) clearInterval(timer);
    },
    get rev() {
      return rev;
    },
    epoch,
  };
}

/* ===== 4. 参加者側: 受信して GM と同じ状態を保つ ===== */

export interface MirrorResult {
  /** 卓(scene)が変わった。 */
  changed: boolean;
  /** GM と rev がずれた。hello を送り直して全量をもらうこと。 */
  resync: boolean;
}

export interface SceneMirror {
  readonly scene: PlayScene | null;
  readonly rev: number;
  receive(msg: NetMsg): MirrorResult;
}

export function createSceneMirror(opts?: {
  logCap?: number;
  /** 再同期要求の最短間隔(ms)。既定 1500。 */
  resyncIntervalMs?: number;
  now?: () => number;
}): SceneMirror {
  const cap = opts?.logCap ?? MIRROR_LOG_CAP;
  const interval = opts?.resyncIntervalMs ?? 1500;
  const now = opts?.now ?? (() => Date.now());
  let scene: PlayScene | null = null;
  let rev = -1;
  let epoch: string | undefined;
  let lastResync = -Infinity;
  // 自分宛てに個別に届いた出来事(id → 中身)。全員向けの印(redacted)を置き換え、
  // 全員向けに無いもの(個別チャット)はログに足す。全量の受信でログが入れ替わっても保つ。
  const reveals = new Map<string, PlayEvent>();

  function withReveals(s: PlayScene): PlayScene {
    if (reveals.size === 0) return s;
    let changed = false;
    const present = new Set<string>();
    const log = s.log.map((e) => {
      present.add(e.id);
      const r = reveals.get(e.id);
      if (r && r !== e) {
        changed = true;
        return r;
      }
      return e;
    });
    const missing = [...reveals.values()].filter((e) => !present.has(e.id));
    if (missing.length === 0) return changed ? { ...s, log } : s;
    // 時刻順に差し込む(全員向けのログは時刻順)。
    const merged = [...log, ...missing].sort((a, b) =>
      a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0,
    );
    return { ...s, log: capLog(merged, cap) };
  }

  const none: MirrorResult = { changed: false, resync: false };
  function askResync(): MirrorResult {
    const t = now();
    if (t - lastResync < interval) return none;
    lastResync = t;
    return { changed: false, resync: true };
  }

  return {
    get scene() {
      return scene;
    },
    get rev() {
      return rev;
    },
    receive(msg) {
      switch (msg.type) {
        case "state": {
          const newEpoch = msg.epoch !== undefined && msg.epoch !== epoch;
          if (!newEpoch && scene && msg.rev <= rev) return none;
          epoch = msg.epoch;
          rev = msg.rev;
          scene = withReveals({
            ...msg.scene,
            log: scene ? mergeSnapshotLog(scene.log, msg.scene.log, cap) : msg.scene.log,
          });
          return { changed: true, resync: false };
        }
        case "patch": {
          if (!scene || (msg.epoch !== undefined && msg.epoch !== epoch)) {
            return askResync();
          }
          if (msg.rev <= rev) return none; // 重複・古いもの
          if (msg.base !== rev) return askResync();
          scene = withReveals(applyPatch(scene, msg.patch, cap));
          rev = msg.rev;
          return { changed: true, resync: false };
        }
        case "tick": {
          if (!scene || (msg.epoch !== undefined && msg.epoch !== epoch)) {
            return askResync();
          }
          return msg.rev > rev ? askResync() : none;
        }
        case "event": {
          if (!scene) return none;
          const id = msg.ev.id;
          if (scene.log.slice(-64).some((e) => e.id === id)) return none;
          const next = reduce(scene, msg.ev);
          scene = withReveals({ ...next, log: capLog(next.log, cap) });
          return { changed: true, resync: false };
        }
        case "reveal": {
          for (const ev of msg.evs) reveals.set(ev.id, ev);
          // 古いものから捨てる(長時間卓でも無制限に溜めない)。
          while (reveals.size > cap) reveals.delete(reveals.keys().next().value!);
          if (!scene) return none;
          scene = withReveals(scene);
          return { changed: true, resync: false };
        }
        case "memo": {
          if (!scene) return none;
          scene = { ...scene, sharedMemos: msg.memos };
          return { changed: true, resync: false };
        }
        default:
          return none;
      }
    },
  };
}
