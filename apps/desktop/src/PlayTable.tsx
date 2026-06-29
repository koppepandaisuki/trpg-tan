import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  reduce,
  panelFromSheet,
  panelFromGeneric,
  makeTokenPanel,
  checkEvent,
  freeRollEvent,
  compareRollEvent,
  diceBotRollEvent,
  chatEvent,
  parseDiceCommand,
  resourceEvent,
  panelAddEvent,
  panelRemoveEvent,
  panelMoveEvent,
  panelUpdateEvent,
  boardSetEvent,
  sceneAddEvent,
  sceneSelectEvent,
  sceneRenameEvent,
  sceneRemoveEvent,
  turnSetEvent,
  logClearEvent,
  buildPack,
  parseCcfoliaCharacter,
  panelVariables,
  substituteVars,
  type PlayScene,
  type PlayEvent,
  type RollEvent,
  type Panel,
  type PanelVariant,
  type PanelStat,
  type PanelResource,
  type BgmTrack,
  type SceneInfo,
  type CutIn,
  type MemoPage,
  type AssetItem,
  type AssetAction,
  type CoCEdition,
} from "@trpg/core";
import {
  Dices,
  Wrench,
  Radio,
  Share2,
  Menu,
  Image as ImageIcon,
  Users,
  BookOpen,
  ScrollText,
  Clapperboard,
  Music,
  MessageSquare,
  StickyNote,
  BookMarked,
  NotebookPen,
  ClipboardPaste,
} from "lucide-react";
import { ask, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { DiceMotion } from "./DiceMotion";
import { setDiagContext } from "./diag";
import { getMyAccount } from "./account-remote";
import { PlayBoard } from "./PlayBoard";
import { SceneBar } from "./SceneBar";
import { PlayPanel } from "./PlayPanel";
import { LogView } from "./LogView";
import { SoundPanel, mergeSounds } from "./SoundPanel";
import { BoardStatusBar } from "./BoardStatusBar";
import { PortraitLayer } from "./PortraitLayer";
import { TextStockPanel, TelopOverlay } from "./TextStock";
import { CutInPanel, CutInOverlay } from "./CutIn";
import { SideStack } from "./SideStack";
import { AssetsPanel } from "./AssetsPanel";
import { MemoPanel } from "./MemoPanel";
import { RulebookQA } from "./RulebookQA";
import { ScenarioViewer } from "./ScenarioViewer";
import { ScenarioBuilderPanel } from "./ScenarioBuilderPanel";
import { playSeFile } from "./SePanel";
import { uploadAudioPath, sanitizeForNet, splitSceneMedia } from "./play-media";
import { probeImageWidth } from "./play-thumb";
import {
  connectRoom,
  makeRoomCode,
  type NetIntent,
  type NetMsg,
  type Room,
} from "./net";
import { useLiveDrag } from "./use-live-drag";
import { getLibrary, systemLabel } from "./library";
import { readSheetFromPath, isGenericSheet } from "./storage";
import { toast } from "./Toasts";
import { savePlayAs, savePlayToPath } from "./play-storage";
import { FriendPickerModal } from "./FriendsPanel";
import { PlayPlanGate } from "./PlayPlanGate";
import { sendTableInvite } from "./friends-remote";
import { exportPackToFile } from "./pack";

/** イベント文脈(id/時刻)。乱数は @trpg/core 側の既定(Math.random)。 */
function newCtx() {
  return { id: crypto.randomUUID(), ts: new Date().toISOString() };
}

/**
 * セッション卓(ローカル最小卓 / Slice 1)。GM 権威のローカル状態を
 * イベントで前進させ、ログに残す。ネットワークは後続スライスで“被せる”。
 */
export function PlayTable({
  initial,
  path,
  onClose,
  onPersist,
  onMenu,
  onCharacters,
}: {
  initial: PlayScene;
  path: string | null;
  onClose: () => void;
  onPersist: (scene: PlayScene, path: string) => void;
  /** ☰ メニュー(キャラ/購入/卓のドロワー)を開く。 */
  onMenu?: () => void;
  /** キャラクター編集を卓の上にオーバーレイで開く(卓は閉じない)。 */
  onCharacters?: () => void;
}) {
  const [scene, setScene] = useState<PlayScene>(initial);
  const [savedPath, setSavedPath] = useState<string | null>(path);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ダイス・モーション(振った RollEvent をそのまま渡す)。
  const [motion, setMotion] = useState<RollEvent | null>(null);

  const [pickId, setPickId] = useState("");
  // チャット入力(発言者 + 本文)。技能/パレットのクリックでここに流し込む。
  const [compose, setCompose] = useState<{ speakerId: string; text: string }>({
    speakerId: "GM",
    text: "",
  });
  // シークレットダイス(出目を伏せる)+ 見せる相手(名前)。
  const [secret, setSecret] = useState(false);
  const [visibleTo, setVisibleTo] = useState<string[]>([]);
  // チャットのチャンネル("main" or パネル id=個別チャット)。
  const [channel, setChannel] = useState("main");
  // 発言の文字色(この端末で記憶。GM 自身の発言に付く)。
  const [chatColor, setChatColor] = useState(
    () => localStorage.getItem("trpg.chat.color.v1") || "#cdd3e1",
  );
  function changeChatColor(c: string) {
    setChatColor(c);
    try {
      localStorage.setItem("trpg.chat.color.v1", c);
    } catch {
      // 保存失敗は無視
    }
  }
  // 再生中のカットイン / テロップ(定型文の画面表示)。
  const [cutin, setCutin] = useState<CutIn | null>(null);
  const [telop, setTelop] = useState<string | null>(null);
  // onDone を毎レンダーで作り直すと CutInOverlay の useEffect が連続リセットされ
  // タイマーが永遠に延長されるため、useCallback で参照を安定させる。
  const clearCutin = useCallback(() => setCutin(null), []);
  const clearTelop = useCallback(() => setTelop(null), []);
  // BGM への外部再生指示(アセットのマクロから)。nonce 変化で SoundPanel が反応。
  const [bgmSignal, setBgmSignal] = useState<{
    id: string | null;
    nonce: number;
  } | null>(null);
  // 参加者ビュー(没入モード): 盤面フルスクリーン + 格納式ドロワー。
  const [playerMode, setPlayerMode] = useState(false);
  // 卓タグの追加入力。
  const [tagDraft, setTagDraft] = useState("");
  // 背景/前景の倍率変更を確定配信するタイマー(連続ホイールを 1 回にまとめる)。
  const scaleCommitRef = useRef<number | undefined>(undefined);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ネットワーク共有(GM がホスト)。room があれば全イベントを配信する。
  const [room, setRoom] = useState<Room | null>(null);
  // ライブドラッグ(参加者のドラッグを滑らかに表示 / GM のドラッグを配信)。
  const { sendDrag, overlay: overlayLive } = useLiveDrag(room);
  const [members, setMembers] = useState<string[]>([]);
  const [sharePop, setSharePop] = useState(false);
  // 無料(basic・非admin)が共有を押したとき出すプラン案内モーダル。
  const [planGateOpen, setPlanGateOpen] = useState(false);
  const [friendInviteOpen, setFriendInviteOpen] = useState(false);
  const [netBusy, setNetBusy] = useState(false);
  const roomRef = useRef<Room | null>(null);
  roomRef.current = room;
  // 受信処理は毎レンダー最新のクロージャに差し替える(古い scene を見ない)。
  const netMsgRef = useRef<(msg: NetMsg) => void>(() => {});
  // 最新の scene を常に参照できるように(集約スナップショット送信が読む)。
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  // スナップショット送信の集約状態。参加者の hello 再送で何度も呼ばれても、
  // 同時に 1 本だけ送り、送信中なら 1 本だけ予約する(連投によるメモリ膨張=
  // ホストの Out of Memory を防ぐ)。
  const snapRef = useRef({ sending: false, queued: false });
  // 既に media 送信済みの画像 key 集合。state(軽量)は毎回送るが、画像実体は初出の
  // ものだけ送る(駒移動のたびに巨大画像を再送しない)。新規参加者の hello でクリア
  // して全画像を再送する。
  const sentMediaRef = useRef<Set<string>>(new Set());
  // 参加者 selfId → 表示名。hello で記録し、intent の所有権チェックに使う。
  const memberNames = useRef<Map<string, string>>(new Map());
  // 現在配信中の BGM。途中入室した参加者は再生中の BGM メッセージを取りこぼす
  // ため、hello を受けたら同じ BGM を再配信して late-joiner にも鳴らす。
  const curBgmRef = useRef<{ path: string | null; loop: boolean }>({
    path: null,
    loop: false,
  });
  // 配信した状態スナップショットの版(単調増加)。参加者は rev が進んだときだけ
  // 置き換える。broadcast の順序逆転で古い state が新しいのを潰すのを防ぐ。
  const revRef = useRef(0);

  const characters = useMemo(() => getLibrary(), []);

  // 卓状態が変わるたびに、参加者へ権威スナップショット(state)を配信する。
  // sendSnapshotCoalesced は単一フライト(送信中の追加要求は 1 本だけ予約)なので、
  // 連続変更でも詰まらず最後の状態が必ず届く。rev を進めて順序逆転を防ぐ。
  // これにより、broadcast の取りこぼしがあっても次の state で必ず収束する。
  useEffect(() => {
    revRef.current += 1;
    if (roomRef.current) void sendSnapshotCoalesced();
    // sendSnapshotCoalesced は安定参照(関数宣言)。scene の変化だけで発火させる。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // idle heartbeat: 無操作で最後の state を取りこぼした参加者も、定期再送で収束する
  // (rev 据え置きなので最新の参加者には no-op、遅れている参加者だけ適用される)。
  useEffect(() => {
    if (!room) return;
    const h = window.setInterval(() => void sendSnapshotCoalesced(), 4000);
    return () => window.clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // 不具合報告に PLAY の文脈(役割・卓・参加人数)を載せる。マウント中だけ登録。
  useEffect(() => {
    setDiagContext(() => {
      const s = sceneRef.current;
      const r = roomRef.current;
      return [
        "role: ホスト(GM)",
        `play: ${s.id} / ${s.systemId}`,
        `title: ${s.title ?? ""}`,
        `panels: ${s.panels.length} / activeScene: ${s.activeSceneId ?? "-"}`,
        `net: ${r ? `共有中 code=${r.code} 参加=${memberNames.current.size}人` : "ローカル"}`,
      ].join("\n");
    });
    return () => setDiagContext(null);
  }, []);

  // 参加者ビューのキーボード操作: [ で左(キャラ)、] で右(チャット)を開閉。
  useEffect(() => {
    if (!playerMode) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT")
      ) {
        return;
      }
      if (e.key === "[") setLeftOpen((v) => !v);
      if (e.key === "]") setRightOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playerMode]);

  // 能力値/リソースを持つ“キャラ駒”だけサイドバーに出す(画像オブジェクトは盤面のみ)。
  // 速さ(行動順)の降順で、サイドバー / 盤面左上の両方が同じ順序に並ぶ。
  const cards = scene.panels
    .filter((p) => p.stats.length > 0 || p.resources.length > 0)
    .sort((a, b) => (b.speed ?? -Infinity) - (a.speed ?? -Infinity));
  // 参加者ビューでは秘匿キャラを出さない。
  const playerCards = cards.filter((p) => !p.hidden);

  function dispatch(event: PlayEvent) {
    setScene((s) => reduce(s, event));
    setDirty(true);
    // チャット/ダイスだけ即時配信(ログ即時表示＋ダイス演出)。秘匿(hidden)キャラの
    // 発言・ロールは参加者へ漏らさない。盤面・駒・リソース等の状態は、scene の変化を
    // 検知する effect が権威スナップショット(state)としてまとめて配信する
    // (取りこぼしても次の state で必ず収束する = 旧来の恒久ズレを根治)。
    const r = roomRef.current;
    if (r && (event.kind === "chat" || event.kind === "roll")) {
      const actorHidden = scene.panels.some(
        (p) => p.name === event.actor && p.hidden,
      );
      if (!actorHidden) void r.send({ type: "event", ev: event });
    }
  }

  const sceneEdition: CoCEdition = scene.systemId === "coc6" ? "6" : "7";

  // 卓のダイスボット(未設定は systemId から既定)。
  const diceBot =
    scene.diceBot ??
    (scene.systemId === "coc6" || scene.systemId === "coc7"
      ? "coc"
      : "generic");

  function setDiceBot(id: string) {
    setScene((s) => ({ ...s, diceBot: id }));
    setDirty(true);
  }
  /** 卓のシステム(保存カードの表示・判定版・既定ダイス)を変更。 */
  function setSystemId(id: string) {
    setScene((s) => (s.systemId === id ? s : { ...s, systemId: id }));
    setDirty(true);
  }

  function rollStat(panel: Panel, stat: PanelStat) {
    const edition = panel.edition ?? sceneEdition;
    const label = `${panel.name} / ${stat.label} 判定`;
    const ev = checkEvent(newCtx(), panel.name, label, stat.target, edition);
    dispatch(ev);
    setMotion(ev);
  }

  function changeResource(panel: Panel, resource: PanelResource, delta: number) {
    dispatch(resourceEvent(newCtx(), panel.name, panel, resource, delta));
  }

  function removePanel(panel: Panel) {
    dispatch(panelRemoveEvent(newCtx(), panel.id));
  }

  function movePanel(panelId: string, x: number, y: number) {
    dispatch(panelMoveEvent(newCtx(), panelId, x, y));
  }

  function setBoardImage(dataUrl: string | null) {
    dispatch(boardSetEvent(newCtx(), { image: dataUrl }));
  }

  function setForeground(dataUrl: string | null) {
    dispatch(boardSetEvent(newCtx(), { foreground: dataUrl }));
  }

  /** 前景がある時の背景ぼかしを on/off(既定は on)。 */
  function toggleBgBlur() {
    const on = scene.board?.bgBlur !== false;
    dispatch(boardSetEvent(newCtx(), { bgBlur: !on }));
  }

  /**
   * 駒(または前景)の重なりを 1 つ前/後ろへ。盤面に出ているモノ + 前景を 1 つの
   * スタックとして 0..N-1 の連番に振り直すので、何度押しても番号が膨らんで余白
   * (飛び番)ができることはない(上限 = モノの数)。
   * target: 駒 id / null=前景。dir: +1=前面へ / -1=背面へ。
   */
  function reorder(target: string | null, dir: 1 | -1) {
    const board = scene.board;
    const onBoard = scene.panels.filter(
      (p) => !p.sceneId || p.sceneId === scene.activeSceneId,
    );
    const items: { key: string; sort: number; isFg: boolean }[] = onBoard.map(
      (p) => ({ key: p.id, sort: p.layer ?? 0, isFg: false }),
    );
    if (board?.foreground) {
      // 同じ整数でも前景は駒より前(既定の見え方)に来るよう +0.5。
      items.push({ key: "__fg__", sort: (board.fgLayer ?? 0) + 0.5, isFg: true });
    }
    items.sort((a, b) => a.sort - b.sort);
    const i = items.findIndex((it) => it.key === (target ?? "__fg__"));
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= items.length) return; // もう端
    [items[i], items[j]] = [items[j], items[i]];
    // 0..N-1 へ振り直し(変わったものだけ更新)。
    items.forEach((it, idx) => {
      if (it.isFg) {
        if ((board?.fgLayer ?? 0) !== idx) {
          dispatch(boardSetEvent(newCtx(), { fgLayer: idx }));
        }
      } else {
        const p = onBoard.find((t) => t.id === it.key);
        if (p && (p.layer ?? 0) !== idx) updatePanel(p.id, { layer: idx });
      }
    });
  }

  /**
   * 背景・前景の表示倍率を Shift+ホイールで増減。ローカルは即時に滑らかへ反映し
   * (ログ・配信はしない)、止まってから確定値を 1 回だけ board-set で配信・ログ化
   * する(ホイール連投でログ/通信が膨らむのを防ぐ)。
   */
  function scaleArt(factor: number, target: "bg" | "fg") {
    setScene((s) => {
      const board = s.board ?? { image: null, grid: true };
      const cl = (v: number) => Math.max(0.2, Math.min(5, v));
      const nb = { ...board };
      if (target === "bg") nb.bgScale = cl((board.bgScale ?? 1) * factor);
      else nb.fgScale = cl((board.fgScale ?? 1) * factor);
      const scenes = s.scenes?.map((sc) =>
        sc.id === s.activeSceneId ? { ...sc, board: nb } : sc,
      );
      return { ...s, board: nb, scenes };
    });
    setDirty(true);
    if (scaleCommitRef.current) window.clearTimeout(scaleCommitRef.current);
    scaleCommitRef.current = window.setTimeout(() => {
      const b = sceneRef.current.board;
      if (b) {
        dispatch(
          boardSetEvent(newCtx(), {
            bgScale: b.bgScale ?? 1,
            fgScale: b.fgScale ?? 1,
          }),
        );
      }
    }, 200);
  }

  function toggleGrid() {
    dispatch(boardSetEvent(newCtx(), { grid: !(scene.board?.grid ?? true) }));
  }

  /** 卓のタグ(ロビーのカードに表示。ローカル整理用。配信不要)。 */
  function setTableTags(tags: string[]) {
    setScene((s) => ({ ...s, tags }));
    setDirty(true);
  }

  function addScene() {
    // 既存名と被らないよう連番(最大+1)で初期名を付ける。
    const used = new Set((scene.scenes ?? []).map((s) => s.name));
    let n = (scene.scenes?.length ?? 0) + 1;
    while (used.has(`シーン${n}`)) n += 1;
    const id = `${scene.id}::s-${crypto.randomUUID().slice(0, 8)}`;
    dispatch(sceneAddEvent(newCtx(), { id, name: `シーン${n}` }));
  }

  function selectScene(id: string) {
    if (id === scene.activeSceneId) return;
    dispatch(sceneSelectEvent(newCtx(), id));
    // シーンに BGM が紐付いていれば自動再生する(背景と BGM が 1 クリックで揃う)。
    // 紐付けが無いシーンは現在の BGM を継続(無音化しない)。SceneBar のクリックと
    // アセットのマクロ(scene アクション)の両方がここを通る。
    const target = scene.scenes?.find((s) => s.id === id);
    if (target?.bgmId) setBgmSignal({ id: target.bgmId, nonce: Date.now() });
  }

  function renameScene(id: string, name: string) {
    dispatch(sceneRenameEvent(newCtx(), id, name));
  }

  /** 次の手番へ(速さ順で巡回。一巡したらラウンド +1)。 */
  function nextTurn() {
    if (cards.length === 0) return;
    const cur = scene.turn?.activePanelId ?? null;
    const round = scene.turn?.round ?? 0;
    const i = cards.findIndex((p) => p.id === cur);
    const wrap = i >= 0 && i + 1 >= cards.length;
    const next = round === 0 || i < 0 ? cards[0] : cards[wrap ? 0 : i + 1];
    const nextRound = round === 0 ? 1 : wrap ? round + 1 : round;
    dispatch(
      turnSetEvent(
        newCtx(),
        nextRound,
        next.id,
        `⏱ ラウンド${nextRound} — ${next.name} の手番`,
      ),
    );
  }

  function resetTurn() {
    dispatch(turnSetEvent(newCtx(), 0, null, "⏱ ターン管理をリセット"));
  }

  async function removeScene(id: string) {
    const target = scene.scenes?.find((s) => s.id === id);
    if (!target) return;
    const ok = await ask(
      `シーン「${target.name}」を削除しますか？\nこのシーンの盤面（背景・グリッド）が失われます。`,
      { title: "シーンの削除", kind: "warning" },
    );
    if (ok) dispatch(sceneRemoveEvent(newCtx(), id));
  }

  // サウンド一覧(BGM/SE 統合)への追加。新規は bgm 側に貯める(SE も同じ庫)。
  function addBgmTracks(newTracks: BgmTrack[]) {
    setScene((s) => ({
      ...s,
      bgm: { tracks: [...(s.bgm?.tracks ?? []), ...newTracks] },
    }));
    setDirty(true);
  }

  // 一覧から外す。旧データで se 側にある曲も拾えるよう両リストから消す。
  function removeSound(id: string) {
    setScene((s) => ({
      ...s,
      bgm: { tracks: (s.bgm?.tracks ?? []).filter((t) => t.id !== id) },
      se: { tracks: (s.se?.tracks ?? []).filter((t) => t.id !== id) },
    }));
    setDirty(true);
  }

  /** 登録名で効果音を鳴らす(定型文の [SE:名前] 用)。BGM/SE 統合一覧から探す。 */
  function playSeByName(name?: string) {
    if (!name) return;
    const t = mergeSounds(scene.bgm?.tracks, scene.se?.tracks).find(
      (x) => x.name === name,
    );
    if (t) {
      void playSeFile(t.path); // GM ローカル再生
      void broadcastAudio("se", t.path); // 参加者へ配信
    }
  }

  function addImageObject(
    name: string,
    dataUrl: string,
    pos: { x: number; y: number },
    size: number,
  ) {
    const panel = {
      ...makeTokenPanel({ id: crypto.randomUUID(), name, portrait: dataUrl }),
      pos,
      size,
      // 画像オブジェクトは既定で「このシーン専用」(右クリックで引き継ぎに変更可)。
      ...(scene.activeSceneId ? { sceneId: scene.activeSceneId } : {}),
    };
    dispatch(panelAddEvent(newCtx(), panel));
  }

  function updatePanel(
    id: string,
    patch: {
      name?: string;
      note?: string;
      hidden?: boolean;
      size?: number;
      height?: number;
      palette?: string;
      speed?: number;
      sceneId?: string | null;
      layer?: number;
      locked?: boolean;
      portrait?: string | null;
      variants?: PanelVariant[];
      owner?: string | null;
    },
  ) {
    dispatch(panelUpdateEvent(newCtx(), id, patch));
  }

  /** 差分切替(ラベル一致)。見つかれば portrait を差し替えて true。 */
  function switchVariant(panelId: string, label: string): boolean {
    const p = scene.panels.find((x) => x.id === panelId);
    const v = p?.variants?.find((x) => x.label === label);
    if (!p || !v) return false;
    dispatch(panelUpdateEvent(newCtx(), panelId, { portrait: v.image }));
    return true;
  }

  /* ===== アセット(画像素材庫) / シーン BGM(GM ローカル編集) ===== */

  function addAssets(items: AssetItem[]) {
    setScene((s) => ({ ...s, assets: [...(s.assets ?? []), ...items] }));
    setDirty(true);
  }

  /** アセットの新規追加 / 既存更新(id 一致で差し替え)。 */
  function saveAsset(asset: AssetItem) {
    setScene((s) => {
      const list = s.assets ?? [];
      const exists = list.some((a) => a.id === asset.id);
      return {
        ...s,
        assets: exists
          ? list.map((a) => (a.id === asset.id ? asset : a))
          : [...list, asset],
      };
    });
    setDirty(true);
  }

  function removeAsset(id: string) {
    setScene((s) => ({
      ...s,
      assets: (s.assets ?? []).filter((a) => a.id !== id),
    }));
    setDirty(true);
  }

  /** 画像を盤面中央に配置(実寸プローブ、700px 上限)。 */
  async function placeImage(image: string, name: string) {
    const size = await probeImageWidth(image, 700);
    addImageObject(name, image, { x: 0.5, y: 0.5 }, size);
  }

  /**
   * アセット(マクロ)を実行。actions を上から順に適用して「ひとつの演出」にする。
   * actions が無い旧アセットは image を配置する単体素材として扱う(後方互換)。
   */
  async function runAsset(asset: AssetItem) {
    const actions: AssetAction[] =
      asset.actions && asset.actions.length > 0
        ? asset.actions
        : asset.image
          ? [{ kind: "place-image", image: asset.image, label: asset.name }]
          : [];
    for (const a of actions) {
      switch (a.kind) {
        case "scene":
          if (a.sceneId) selectScene(a.sceneId);
          break;
        case "board-bg":
          if (a.image) setBoardImage(a.image);
          break;
        case "place-image":
          // 同じ画像が既に盤面に出ていれば重複配置しない(アセットは再利用前提)。
          if (a.image && !scene.panels.some((p) => p.portrait === a.image)) {
            await placeImage(a.image, a.label || asset.name);
          }
          break;
        case "spawn-char":
          // 既に居るキャラは重複させず切り替える(アセット優先)。
          if (a.charId) await spawnCharacter(a.charId, { dedup: true });
          break;
        case "cutin": {
          const c = (scene.cutins ?? []).find((x) => x.id === a.cutinId);
          if (c) fireCutin(c);
          break;
        }
        case "telop":
          if (a.text) fireTelop(a.text);
          break;
        case "bgm":
          setBgmSignal({ id: a.bgmId ?? null, nonce: Date.now() });
          break;
        case "se":
          playSeByName(a.seName);
          break;
      }
    }
  }

  /** 現在のシーンに BGM を紐付け(null で解除)。切替時に自動再生される。 */
  function bindSceneBgm(trackId: string | null) {
    const activeId = scene.activeSceneId;
    if (!activeId) return;
    setScene((s) => ({
      ...s,
      scenes: (s.scenes ?? []).map((sc) =>
        sc.id === activeId
          ? { ...sc, bgmId: trackId ?? undefined }
          : sc,
      ),
    }));
    setDirty(true);
  }

  const sceneBgmId =
    (scene.scenes ?? []).find((sc) => sc.id === scene.activeSceneId)?.bgmId ??
    null;

  /* ===== PLAY 画面全体への画像ドロップ(盤面の外でも反映) ===== */

  function onTableDragOver(e: React.DragEvent) {
    if ((e.target as HTMLElement).closest(".board")) return; // 盤面は自前処理
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  }

  function onTableDrop(e: React.DragEvent) {
    if ((e.target as HTMLElement).closest(".board")) return; // 盤面側で位置付き配置
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/"),
    );
    if (!file) return;
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") return;
      const size = await probeImageWidth(reader.result, 700);
      addImageObject(
        file.name.replace(/\.[^.]+$/, ""),
        reader.result,
        { x: 0.5, y: 0.5 },
        size,
      );
    };
    reader.readAsDataURL(file);
  }

  /** 卓全体を .paradice として書き出す(シナリオ作成タブの導線)。 */
  async function exportScenarioPack() {
    try {
      const pack = buildPack({
        id: scene.id,
        name: scene.title || "無題のシナリオ",
        scenarios: [scene],
        now: new Date().toISOString(),
      });
      const path = await exportPackToFile(pack);
      if (path) toast(`📦 「${pack.name}」を書き出しました`);
    } catch (e) {
      toast(
        `書き出しに失敗: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /* ===== シナリオテキストストック / カットイン(GM ローカル編集) ===== */

  function setTextStock(text: string) {
    setScene((s) => ({ ...s, textStock: text }));
    setDirty(true);
  }

  const memoTimer = useRef<number | undefined>(undefined);
  function setSharedMemos(memos: MemoPage[]) {
    setScene((s) => ({ ...s, sharedMemos: memos }));
    setDirty(true);
    // 共有中はデバウンスして参加者へ(キーストローク毎に流さない)。
    if (roomRef.current) {
      window.clearTimeout(memoTimer.current);
      memoTimer.current = window.setTimeout(() => {
        roomRef.current?.send({ type: "memo", memos });
      }, 600);
    }
  }

  function addCutin(name: string, image: string) {
    setScene((s) => ({
      ...s,
      cutins: [...(s.cutins ?? []), { id: crypto.randomUUID(), name, image }],
    }));
    setDirty(true);
  }

  function removeCutin(id: string) {
    setScene((s) => ({
      ...s,
      cutins: (s.cutins ?? []).filter((c) => c.id !== id),
    }));
    setDirty(true);
  }

  /** カットインの帯背景色(null で既定に戻す)。 */
  function setCutinBg(id: string, bg: string | null) {
    setScene((s) => ({
      ...s,
      cutins: (s.cutins ?? []).map((c) =>
        c.id === id ? { ...c, bg: bg ?? undefined } : c,
      ),
    }));
    setDirty(true);
  }

  function setCutinSound(
    id: string,
    sound: { path: string; name: string } | null,
  ) {
    setScene((s) => ({
      ...s,
      cutins: (s.cutins ?? []).map((c) =>
        c.id === id
          ? {
              ...c,
              soundPath: sound?.path,
              soundName: sound?.name,
            }
          : c,
      ),
    }));
    setDirty(true);
  }

  /** チャット/ログ履歴を全消去(駒/盤面/シーンは残る)。参加者へも反映。 */
  async function clearLog() {
    const ok = await ask(
      "チャット/ログの履歴を全消去しますか？\n（駒・盤面・シーン・立ち絵の状態はそのまま残ります）",
      { title: "ログの消去", kind: "warning" },
    );
    if (ok) dispatch(logClearEvent(newCtx()));
  }

  /** チャットログをテキストファイルへ書き出す(リプレイ保存)。 */
  async function exportLog() {
    const nameOf = (id?: string) =>
      id ? (scene.panels.find((p) => p.id === id)?.name ?? id) : "メイン";
    const lines: string[] = [];
    for (const ev of scene.log) {
      const time = new Date(ev.ts).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (ev.kind === "chat") {
        lines.push(`[${time}][${nameOf(ev.channel)}] ${ev.actor}: ${ev.text}`);
      } else if (ev.kind === "roll") {
        const res = ev.detail
          ? ev.detail
          : ev.check
            ? `${ev.check.isSuccess ? "成功" : "失敗"}(${ev.check.level})`
            : ev.success !== undefined
              ? ev.success
                ? "成功"
                : "失敗"
              : "";
        lines.push(
          `[${time}][${nameOf(ev.channel)}] ${ev.actor}: 🎲 ${ev.label} [${ev.dice.join(",")}] = ${ev.total}${res ? ` ${res}` : ""}${ev.secret ? "（シークレット）" : ""}`,
        );
      } else if (ev.kind === "resource") {
        lines.push(
          `[${time}] ${ev.actor}: ${ev.label} ${ev.delta >= 0 ? "+" : ""}${ev.delta} → ${ev.current}`,
        );
      } else if (ev.kind === "system") {
        lines.push(`[${time}] ${ev.text}`);
      }
    }
    try {
      const p = await saveDialog({
        defaultPath: `${scene.title || "session"}-log.txt`,
        filters: [{ name: "テキスト", extensions: ["txt"] }],
      });
      if (p) await writeTextFile(p, lines.join("\n"));
    } catch (e) {
      setError(`ログを書き出せませんでした: ${String(e)}`);
    }
  }

  /** 新しい駒の初期配置(盤面のやや中央寄りにランダム)。 */
  function spawnPos(): { x: number; y: number } {
    return { x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.3 };
  }

  /**
   * 保存済みキャラ(ライブラリ)を盤面に登場させる。アセットからも呼ぶ。
   * opts.dedup: 既に同じキャラが卓に居れば重複させず、隠れていれば表示に戻す
   * (アセット実行時に二重登場しないようにする)。
   */
  async function spawnCharacter(charId: string, opts?: { dedup?: boolean }) {
    const entry = characters.find((c) => c.id === charId);
    if (!entry) return;
    setError(null);
    try {
      const sheet = await readSheetFromPath(entry.path);
      if (opts?.dedup) {
        const existing = scene.panels.find((p) => p.sheetId === sheet.id);
        if (existing) {
          // 既に登場済み: 重複させない。隠れていたら出し直す。
          if (existing.hidden) updatePanel(existing.id, { hidden: false });
          return;
        }
      }
      // カスタムシステムのキャラは汎用パネル(判定雛形 + パレット持ち)へ。
      const base = isGenericSheet(sheet)
        ? panelFromGeneric({ id: crypto.randomUUID(), sheet })
        : panelFromSheet({ id: crypto.randomUUID(), sheet });
      // ポートレートがあれば実寸(自然な幅)で配置。
      const size = base.portrait ? await probeImageWidth(base.portrait) : undefined;
      dispatch(
        panelAddEvent(newCtx(), {
          ...base,
          pos: spawnPos(),
          ...(size ? { size } : {}),
        }),
      );
      // 卓のシステムを「最初に登場したキャラ」のシステムに合わせる。これが
      // 保存カードの “卓名の下” の表示になる(従来は常に coc7 固定だった)。
      // 既にキャラ駒があるときは触らない(システム混在・手動運用を尊重)。
      const hadChar = scene.panels.some(
        (p) => p.stats.length > 0 || p.resources.length > 0,
      );
      if (!hadChar && sheet.systemId && sheet.systemId !== scene.systemId) {
        setSystemId(sheet.systemId);
      }
      // システム付きキャラを取り込んだら、卓のダイスボットも自動で合わせる
      // (手動で選んでいた場合は上書きしない)。
      if (isGenericSheet(sheet) && sheet.diceBot && !scene.diceBot) {
        setDiceBot(sheet.diceBot);
      }
    } catch (e) {
      setError(`キャラを読み込めませんでした: ${String(e)}`);
    }
  }

  async function addFromCharacter() {
    if (!pickId) return;
    await spawnCharacter(pickId);
    setPickId("");
  }

  /**
   * クリップボードのココフォリア駒データから駒を追加する。
   * 他サイト(キャラクター保管所など)の「ココフォリア出力」をコピーして貼り付け。
   */
  async function pasteCcfoliaPanel() {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      const panel = parseCcfoliaCharacter(text, () => crypto.randomUUID());
      if (!panel) {
        setError(
          "クリップボードにココフォリア形式のコマが見つかりません。対応サイトで「ココフォリア出力」をコピーしてからお試しください。",
        );
        return;
      }
      // ポートレートがあれば実寸幅で配置。
      const size = panel.portrait
        ? await probeImageWidth(panel.portrait).catch(() => undefined)
        : undefined;
      dispatch(
        panelAddEvent(newCtx(), {
          ...panel,
          pos: spawnPos(),
          ...(size ? { size } : {}),
          ...(scene.activeSceneId ? { sceneId: scene.activeSceneId } : {}),
        }),
      );
      toast(`🎭 「${panel.name}」をコマとして取り込みました`);
    } catch (e) {
      setError(`コマの貼り付けに失敗しました: ${String(e)}`);
    }
  }

  /** 発言者 id → 表示名 + 版(CoC 判定の閾値に使う)。 */
  function resolveSpeaker(speakerId: string): { name: string; edition: CoCEdition } {
    if (speakerId === "GM") return { name: "GM", edition: sceneEdition };
    const p = scene.panels.find((x) => x.id === speakerId);
    return { name: p?.name ?? "GM", edition: p?.edition ?? sceneEdition };
  }

  /**
   * チャット入力(発言 or ダイスコマンド)を解釈して適用。
   * opts はネット参加者の intent 用(本人の入力時の設定で上書きする)。
   */
  function handleSend(
    speakerId: string,
    raw: string,
    opts?: {
      channel?: string;
      secret?: boolean;
      visibleTo?: string[];
      /** 発言者名の上書き。参加者が「自分(入室名)」として喋るとき使う。 */
      as?: string;
      /** 発言の文字色(参加者は intent から、GM は自分の設定から)。 */
      color?: string;
    },
  ) {
    // 発言の文字色: 参加者の intent 指定を優先、無ければ GM 自身の設定色。
    const msgColor = opts?.color ?? chatColor;
    // as 指定時はキャラ駒ではなく入室名そのものとして発言する(地の声)。
    const { name, edition } = opts?.as
      ? { name: opts.as, edition: sceneEdition }
      : resolveSpeaker(speakerId);
    const chSel = opts?.channel ?? channel;
    const ch = chSel === "main" ? undefined : chSel;
    const isSecret = opts?.secret ?? secret;
    const viewers = opts?.visibleTo ?? visibleTo;

    // 差分切替(キャラ発言時のみ。自分=入室名の発言には差分が無い):
    //   「face ラベル」/「@ラベル」単独 → 切替のみ
    //   「発言 @ラベル」 → 切替してから残りを発言(CCFOLIA 風)
    if (speakerId !== "GM" && !opts?.as) {
      const only = raw.match(/^(?:face[:：]?\s*|@)(\S+)$/i);
      if (only) {
        if (!switchVariant(speakerId, only[1])) {
          setError(`差分「${only[1]}」が見つかりません（右クリックメニューで登録）`);
        }
        return;
      }
      const suffix = raw.match(/^([\s\S]*\S)\s+@(\S+)$/);
      if (suffix && switchVariant(speakerId, suffix[2])) {
        raw = suffix[1];
      }
    }

    // チャパレ変数置換({共鳴} [強度] 等 → このキャラのデータ値)。判定/
    // ダイス解釈の前段で行う。駒が見つからない発言(GM 等)は対象外。
    const speakerPanel = scene.panels.find((x) => x.id === speakerId);
    if (speakerPanel) {
      raw = substituteVars(raw, panelVariables(speakerPanel));
    }

    // システム固有コマンド(ダイスボット)を先に解釈。非該当は汎用へ。
    const botEv = diceBotRollEvent(newCtx(), name, raw, diceBot);
    if (botEv) {
      let ev: RollEvent = botEv;
      if (isSecret) ev = { ...ev, secret: true, visibleTo: [...viewers] };
      if (ch) ev = { ...ev, channel: ch };
      if (msgColor) ev = { ...ev, color: msgColor };
      dispatch(ev);
      setMotion(ev);
      setError(null);
      return;
    }

    const cmd = parseDiceCommand(raw);
    try {
      if (cmd.kind === "none") {
        dispatch({ ...chatEvent(newCtx(), name, raw, ch), color: msgColor });
        return;
      }
      let ev: RollEvent;
      if (cmd.kind === "notation") {
        ev = freeRollEvent(newCtx(), name, cmd.notation, cmd.label);
      } else if (cmd.kind === "coc") {
        ev = checkEvent(newCtx(), name, cmd.label, cmd.target, edition);
      } else if (cmd.kind === "choice") {
        // choice[a,b,c]: 1d{N} を振って選択肢を 1 つ選ぶ。
        const base = freeRollEvent(newCtx(), name, `1d${cmd.options.length}`);
        const picked = cmd.options[(base.dice[0] ?? 1) - 1];
        ev = { ...base, label: `choice → ${picked}` };
      } else {
        ev = compareRollEvent(
          newCtx(),
          name,
          cmd.notation,
          cmd.op,
          cmd.target,
          cmd.label,
        );
      }
      // シークレットダイス: 出目を伏せる(見せる相手はチェックで指定)。
      if (isSecret) {
        ev = { ...ev, secret: true, visibleTo: [...viewers] };
      }
      // 個別チャット内のロールはそのチャンネルに留める。
      if (ch) {
        ev = { ...ev, channel: ch };
      }
      if (msgColor) ev = { ...ev, color: msgColor };
      dispatch(ev);
      setMotion(ev);
      setError(null);
    } catch {
      setError(`コマンドを解釈できません: "${raw}"`);
    }
  }

  /* ===== ネットワーク共有(GM がホスト)===== */

  /** 参加者からの操作意図を GM 権限で検証し、正規イベント化する。 */
  /** 参加者(from=selfId)がそのパネルを操作してよいか(所有者一致)。 */
  function ownsPanel(from: string, panelId: string): boolean {
    const owner = scene.panels.find((x) => x.id === panelId)?.owner;
    return !!owner && owner === memberNames.current.get(from);
  }

  function applyIntent(intent: NetIntent, from: string) {
    if (intent.kind === "send") {
      // GM 発言は不可(参加者がなりすませない)。
      if (intent.speakerId === "GM") return;
      if (intent.speakerId === "self") {
        // キャラ未作成でも「自分(入室名)」として発言/ロールできる。
        // なりすまし防止のため、名前は hello で記録した表示名で上書きする。
        const myName = memberNames.current.get(from);
        if (!myName) return;
        handleSend("self", intent.raw, {
          channel: intent.channel,
          secret: intent.secret,
          visibleTo: intent.visibleTo,
          as: myName,
          color: intent.color,
        });
        return;
      }
      // それ以外は自分の所有キャラとしてのみ発言/ロールできる。
      if (!ownsPanel(from, intent.speakerId)) return;
      handleSend(intent.speakerId, intent.raw, {
        channel: intent.channel,
        secret: intent.secret,
        visibleTo: intent.visibleTo,
        color: intent.color,
      });
    } else if (intent.kind === "resource") {
      if (!ownsPanel(from, intent.panelId)) return;
      const p = scene.panels.find((x) => x.id === intent.panelId);
      const r = p?.resources.find((x) => x.key === intent.resourceKey);
      if (p && r) changeResource(p, r, intent.delta);
    } else if (intent.kind === "move") {
      if (!ownsPanel(from, intent.panelId)) return;
      movePanel(intent.panelId, intent.x, intent.y);
    } else if (intent.kind === "panel-update") {
      if (!ownsPanel(from, intent.panelId)) return;
      updatePanel(intent.panelId, intent.patch);
    } else if (intent.kind === "add-char") {
      // 参加者が自分のキャラを登場。owner を送信者の名前で刻む(なりすまし防止)。
      const owner = memberNames.current.get(from);
      if (!owner) return;
      dispatch(
        panelAddEvent(newCtx(), { ...intent.panel, owner, pos: spawnPos() }),
      );
    } else if (intent.kind === "remove-char") {
      // 参加者は自分が登場させた駒だけ片付けられる(所有者一致を検証)。
      if (!ownsPanel(from, intent.panelId)) return;
      dispatch(panelRemoveEvent(newCtx(), intent.panelId));
    } else if (intent.kind === "claim-char") {
      // 「自分の駒にする」(ココフォリア的)。なりすまし防止のため owner は hello
      // で記録した表示名で刻む。対象はキャラ駒(stats/resources あり)かつ非秘匿
      // のみ(参加者に見えていない駒は奪えない)。
      const claimer = memberNames.current.get(from);
      if (!claimer) return;
      const p = scene.panels.find((x) => x.id === intent.panelId);
      if (!p || p.hidden) return;
      const isChar = p.stats.length > 0 || p.resources.length > 0;
      if (!isChar) return;
      updatePanel(intent.panelId, { owner: claimer });
    } else if (intent.kind === "memo") {
      setSharedMemos(intent.memos);
    }
  }

  /**
   * 参加者へ現在の卓全体(スナップショット)を送る。集約版。
   * 参加者は hello を再送してくるため何度も呼ばれ得るが、同時に走るのは 1 本だけ。
   * 送信中に来た要求は queued にまとめ、完了後にもう 1 本だけ送る(途中で入室した
   * 人もカバーしつつ、連投でメモリが膨張してホストが落ちるのを防ぐ)。
   */
  async function sendSnapshotCoalesced() {
    // 参加者へ送る履歴の上限。盤面・駒・ターンは scene に復元済みで、古いログは
    // 状態復元に不要(表示用スクロールバックだけ)。長時間卓で log が肥大化すると
    // join のたびに全部を直列送信して遅くなるため、末尾 N 件に絞って join を一定化。
    // state は変更のたびに送るので、ログは末尾 N 件に絞って軽くする(スクロール
    // バック表示用。状態復元には不要)。
    const LOG_LIMIT = 120;
    const st = snapRef.current;
    if (st.sending) {
      st.queued = true;
      return;
    }
    st.sending = true;
    try {
      do {
        st.queued = false;
        const r = roomRef.current;
        if (!r) break;
        // 秘匿キャラは参加者へ送らない(閲覧制限): 駒本体も、その駒名の発言ログも除外。
        const s = sceneRef.current;
        const hiddenNames = new Set(
          s.panels.filter((p) => p.hidden).map((p) => p.name),
        );
        const forNet = {
          ...s,
          panels: s.panels.filter((p) => !p.hidden),
          // 先に末尾 N 件へ絞ってから秘匿フィルタ(全履歴を毎回走査しない)。
          // 長時間卓で log が数千件でも、1 回の同期は末尾 N 件分で一定。
          log: (s.log ?? [])
            .slice(-LOG_LIMIT)
            .filter((e) => {
              const actor = (e as { actor?: string }).actor;
              return !actor || !hiddenNames.has(actor);
            }),
        };
        // 画像(data URL)を分離: state は軽量(cas 参照)、画像実体は初出のものだけ送る。
        const { lite, media } = splitSceneMedia(forNet);
        // 画像は 1 枚ずつ送る。まとめて 1 通にすると数百チャンクの巨大メッセージになり、
        // 再入室時(全画像を再送)に取りこぼして「画像が出ない」原因になる。1 枚ずつなら
        // 1 枚の失敗が他に波及せず、sent に入れないので次のスナップショットで再送される。
        for (const [k, v] of Object.entries(media)) {
          if (sentMediaRef.current.has(k)) continue;
          try {
            await r.send({ type: "media", media: { [k]: v } });
            sentMediaRef.current.add(k);
          } catch {
            // 失敗した画像は sent に入れず、次回スナップショットで再送する。
          }
        }
        await r.send({ type: "state", rev: revRef.current, scene: lite });
      } while (st.queued);
    } finally {
      st.sending = false;
    }
  }

  // 受信ハンドラは毎レンダー最新化(古い scene を掴んだままにしない)。
  useEffect(() => {
    netMsgRef.current = (msg: NetMsg) => {
      if (msg.type === "hello") {
        // 参加者名を記録(intent の所有権判定に使う)。
        memberNames.current.set(msg.from, msg.name);
        // 新規参加者は画像を 1 枚も持っていないので、送信済みフラグを消して全画像を
        // media で再送させる(cas 参照だけ届いて画像が解決できないのを防ぐ)。
        sentMediaRef.current.clear();
        // 新規参加者へ現在の卓全体を送る(集約。hello 連投でも 1 本ずつ)。
        void sendSnapshotCoalesced();
        // 既に BGM を流しているなら再配信して、途中入室でも鳴るようにする
        // (broadcast で全員に届くが、参加者側は同じ曲なら鳴らし直さない)。
        if (curBgmRef.current.path) {
          void broadcastAudio("bgm", curBgmRef.current.path, curBgmRef.current.loop);
        }
      } else if (msg.type === "intent") {
        applyIntent(msg.intent, msg.from);
      }
    };
  });

  /** 共有を開始(すでに共有中ならポップオーバーの開閉だけ)。 */
  async function startShare() {
    if (roomRef.current) {
      setSharePop((v) => !v);
      return;
    }
    setNetBusy(true);
    setError(null);
    try {
      // マルチ卓のホスト(参加コード発行)は PLAY プラン以上が必要。無料(basic)は
      // 「参加のみ」。管理者(admin)はプラン不問で全機能可(ゲート免除・案内も出さない)。
      // basic のときはエラー文ではなくプラン案内モーダルを出す。
      const acct = await getMyAccount();
      if (!acct.isAdmin && acct.plan === "basic") {
        setPlanGateOpen(true);
        return;
      }
      // transform: 送信直前にメディアを Storage の URL へ逃がす(Realtime を軽く)。
      const r = await connectRoom(makeRoomCode(), "GM", {
        transform: sanitizeForNet,
      });
      r.onMessage((m) => netMsgRef.current(m));
      r.onPresence(setMembers);
      setRoom(r);
      setSharePop(true);
      toast(`🌐 共有を開始しました（コード ${r.code}）`);
    } catch (e) {
      setError(`共有を開始できませんでした: ${String(e)}`);
    } finally {
      setNetBusy(false);
    }
  }

  function stopShare() {
    roomRef.current?.send({ type: "closed" });
    roomRef.current?.close();
    setRoom(null);
    setMembers([]);
    setSharePop(false);
  }

  // 卓を閉じる/アンマウント時はルームも畳む。
  useEffect(() => {
    return () => {
      roomRef.current?.send({ type: "closed" });
      roomRef.current?.close();
    };
  }, []);

  /** カットイン/テロップは演出メッセージとして参加者にも飛ばす。 */
  /**
   * GM のローカル音源を参加者へ配信する。path をその場で data URL 化して送る。
   * channel "bgm"=ループ / "se"=単発。path=null は BGM 停止。
   */
  async function broadcastAudio(
    channel: "bgm" | "se",
    path: string | null,
    loop = false,
  ) {
    const r = roomRef.current;
    // late-joiner 再配信のため、BGM の現在値は接続前でも覚えておく。
    if (channel === "bgm") curBgmRef.current = { path, loop };
    if (!r) return;
    if (!path) {
      void r.send({ type: "audio", channel, src: null });
      return;
    }
    try {
      // Storage にアップして URL を配信(未ログイン等は base64 にフォールバック)。
      const src = await uploadAudioPath(path);
      void r.send({ type: "audio", channel, src, loop });
    } catch {
      // 読み込み失敗(ファイル移動など)は無視。GM のローカル再生には影響しない。
    }
  }

  function fireCutin(c: CutIn) {
    setCutin(c);
    // id だけ送る。参加者は自分の scene.cutins から画像を引く(data URL を丸ごと
    // 送ると巨大になり Realtime を詰まらせてカットインが届かなくなるため)。
    roomRef.current?.send({ type: "cutin", cutinId: c.id });
    if (c.soundPath) void broadcastAudio("se", c.soundPath);
  }
  function fireTelop(text: string) {
    setTelop(text);
    roomRef.current?.send({ type: "telop", text });
  }

  /* ===== チャット入力(CCFOLIA 風)===== */

  /** クリック: 入力欄にダイス式を流し込む(その駒として)。手で調整できる。 */
  function fill(speakerId: string, text: string) {
    setCompose({ speakerId, text });
    inputRef.current?.focus();
  }
  /** ダブルクリック: 即ロール(その駒として)。入力欄は空に戻す。 */
  function sendNow(speakerId: string, text: string) {
    handleSend(speakerId, text);
    setCompose((c) => ({ ...c, text: "" }));
  }
  /** 入力欄を送信(Enter / 送信ボタン)。 */
  function submitCompose() {
    const t = compose.text.trim();
    if (!t) return;
    handleSend(compose.speakerId, t);
    setCompose((c) => ({ ...c, text: "" }));
  }

  /** 卓を保存する。成功すれば true(handleClose が見て続行する)。 */
  async function save(): Promise<boolean> {
    setError(null);
    try {
      let p = savedPath;
      if (p) {
        await savePlayToPath(scene, p);
      } else {
        p = await savePlayAs(scene);
        if (!p) return false; // 名前付け保存ダイアログでキャンセル
        setSavedPath(p);
      }
      onPersist(scene, p);
      setDirty(false);
      toast("✓ 卓を保存しました");
      return true;
    } catch (e) {
      setError(`保存に失敗しました: ${String(e)}`);
      return false;
    }
  }

  /** 卓を閉じる(未保存があれば 2 段階 confirm で保存/破棄を選んでもらう)。 */
  async function handleClose() {
    if (!dirty) {
      onClose();
      return;
    }
    // 第 1 段: 保存して閉じるか
    const wantSave = window.confirm(
      "卓に保存されていない変更があります。\n\n[OK] 保存して閉じる\n[キャンセル] 保存しない",
    );
    if (wantSave) {
      const ok = await save();
      if (ok) onClose();
      // 失敗時(ダイアログキャンセル/書込失敗) は閉じない。
      return;
    }
    // 第 2 段: 破棄して閉じるか
    const wantDiscard = window.confirm(
      "保存していない変更を破棄して閉じますか？\n\n[OK] 破棄して閉じる\n[キャンセル] 戻る",
    );
    if (wantDiscard) onClose();
  }

  return (
    <div
      className="ptable"
      onDragOver={onTableDragOver}
      onDrop={onTableDrop}
    >
      <header className="ptable-head">
        {playerMode ? (
          <span className="ptable-title-ro">{scene.title || "卓"}</span>
        ) : (
          <input
            className="ptable-title input"
            value={scene.title}
            onChange={(e) => {
              setScene((s) => ({ ...s, title: e.target.value }));
              setDirty(true);
            }}
            placeholder="卓のタイトル"
          />
        )}
        <div className="ptable-tools">
          {!playerMode && (
            <>
              <select
                className="input ptable-pick"
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
              >
                <option value="">キャラを選択…</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}（{systemLabel(c)}）
                  </option>
                ))}
              </select>
              <button
                className="btn mini"
                onClick={() => void addFromCharacter()}
                disabled={!pickId}
              >
                ＋キャラ
              </button>
              <button
                className="btn mini ibtn"
                onClick={() => void pasteCcfoliaPanel()}
                title="他サイト（キャラクター保管所など）の「ココフォリア出力」をコピーしてから押すと、コマとして取り込めます"
              >
                <ClipboardPaste size={14} /> コマ貼付
              </button>
            </>
          )}
          <span className="ptable-spacer" />
          <button
            className={`btn mini ibtn ${playerMode ? "btn-primary" : ""}`}
            onClick={() => setPlayerMode((v) => !v)}
            title={
              playerMode
                ? "GM ビューに戻る"
                : "参加者ビュー（没入モード。GM ツールを隠し、[ ] でサイドバー開閉）"
            }
          >
            {playerMode ? <Wrench size={14} /> : <Dices size={14} />}
            {playerMode ? "GMビュー" : "プレイヤービュー"}
          </button>
          {!playerMode && (
            <>
              <button
                className={`play-share-btn ${room ? "live" : ""}`}
                onClick={() => void startShare()}
                disabled={netBusy}
                title={
                  room
                    ? `共有中（コード ${room.code}）— クリックで詳細`
                    : "みんなで卓を立てて招待（参加コードを発行）"
                }
              >
                {room ? <Radio size={15} /> : <Share2 size={15} />}
                {netBusy
                  ? "接続中…"
                  : room
                    ? `${room.code}・${Math.max(0, members.filter((n) => n !== "GM").length)}人`
                    : "みんなで遊ぶ"}
              </button>
              {onCharacters && (
                <button
                  className="btn mini ibtn"
                  onClick={onCharacters}
                  title="キャラクター（卓を開いたまま編集）"
                  aria-label="キャラクターを開く"
                >
                  <ScrollText size={15} />
                </button>
              )}
              {onMenu && (
                <button
                  className="btn mini ibtn"
                  onClick={onMenu}
                  title="メニュー（キャラ / 購入 / 卓）"
                  aria-label="メニューを開く"
                >
                  <Menu size={15} />
                </button>
              )}
              <button
                className="btn mini btn-primary"
                onClick={() => void save()}
              >
                {dirty ? "保存*" : "保存"}
              </button>
              <button className="btn mini" onClick={() => void handleClose()}>
                閉じる
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <p className="tag fail" style={{ margin: "6px 12px" }}>
          {error}
        </p>
      )}

      {/* 共有ポップオーバー(参加コード / 参加者 / フレンド招待 / 終了)。 */}
      {sharePop && room && (
        <div className="share-pop">
          <div className="share-row">
            <span className="share-label">参加コード</span>
            <code className="share-code">{room.code}</code>
            <button
              className="btn mini"
              onClick={() => {
                void navigator.clipboard.writeText(room.code);
                toast("📋 参加コードをコピーしました");
              }}
              title="コードをコピー"
            >
              コピー
            </button>
            <button
              className="btn mini btn-primary"
              onClick={() => setFriendInviteOpen(true)}
              title="フレンドに参加コードを通知"
            >
              フレンドを招待…
            </button>
          </div>
          <p className="share-note">
            参加者はアプリの「卓」タブ →「ネットワークで参加」にこのコードを
            入力します。ダイス・チャット・盤面が同期されます。
          </p>
          <div className="share-members">
            {members.filter((n) => n !== "GM").length === 0
              ? "参加者を待っています…"
              : `参加中: ${members.filter((n) => n !== "GM").join("・")}`}
          </div>
          <div className="share-row share-actions">
            <button className="btn mini" onClick={() => setSharePop(false)}>
              閉じる
            </button>
            <button className="btn mini share-stop" onClick={stopShare}>
              共有を終了
            </button>
          </div>
        </div>
      )}

      {/* 無料(basic・非admin)が共有を押したときのプラン案内。PLAY/Pro を選ぶと
          自動でホスト(共有)を再開する。 */}
      {planGateOpen && (
        <PlayPlanGate
          onClose={() => setPlanGateOpen(false)}
          onUnlocked={() => {
            setPlanGateOpen(false);
            void startShare();
          }}
        />
      )}

      <FriendPickerModal
        open={friendInviteOpen}
        title="フレンドに卓を招待"
        multi
        onClose={() => setFriendInviteOpen(false)}
        onSelect={async (ids) => {
          if (!room || ids.length === 0) return;
          try {
            await Promise.all(
              ids.map((id) =>
                sendTableInvite(id, room.code, scene.title || "卓"),
              ),
            );
            toast(`📨 ${ids.length} 人に招待を送信しました`);
          } catch (e) {
            toast(`招待の送信に失敗: ${String(e)}`);
          }
        }}
      />

      {!playerMode && (
      <div className="ptable-body2">
        {/* 左サイドバー(固定): ブロックはドラッグで並べ替え・高さ変更可 */}
        <aside className="pside">
          <SideStack
            storageKey={`trpg.play.stack-left.v1::${scene.id}`}
            sections={[
              {
                id: "table",
                title: "卓のタグ",
                icon: <BookMarked size={14} />,
                defaultOpen: false,
                body: (
                  <div className="ttags">
                    <p className="pside-empty muted" style={{ marginTop: 0 }}>
                      ロビーのカードに表示されます(配信はされません)。
                    </p>
                    <div className="ttags-chips">
                      {(scene.tags ?? []).map((t) => (
                        <span key={t} className="ttag">
                          {t}
                          <button
                            className="ttag-x"
                            aria-label={`${t} を削除`}
                            onClick={() =>
                              setTableTags(
                                (scene.tags ?? []).filter((x) => x !== t),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      className="input"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const t = tagDraft.trim();
                        if (t && !(scene.tags ?? []).includes(t)) {
                          setTableTags([...(scene.tags ?? []), t].slice(0, 8));
                        }
                        setTagDraft("");
                      }}
                      placeholder="タグを追加（Enter）例: 初心者歓迎"
                      maxLength={20}
                    />
                  </div>
                ),
              },
              {
                id: "assets",
                title: "アセット",
                icon: <ImageIcon size={14} />,
                defaultOpen: false,
                body: (
                  <AssetsPanel
                    assets={scene.assets ?? []}
                    scenes={scene.scenes ?? []}
                    cutins={scene.cutins ?? []}
                    bgmTracks={scene.bgm?.tracks ?? []}
                    seTracks={scene.se?.tracks ?? []}
                    characters={characters.map((c) => ({
                      id: c.id,
                      name: c.name,
                      thumbnail: c.thumbnail,
                    }))}
                    onAdd={addAssets}
                    onSave={saveAsset}
                    onRemove={removeAsset}
                    onRun={(a) => void runAsset(a)}
                  />
                ),
              },
              {
                id: "chars",
                title: "キャラクター",
                icon: <Users size={14} />,
                body: (
                  <div className="ss-chars">
                    {cards.length === 0 ? (
                      <p className="pside-empty muted">
                        「＋キャラ」で保存済みキャラを呼び出せます。盤面には
                        画像のドロップでマップやオブジェクトを置けます。
                      </p>
                    ) : (
                      cards.map((p) => (
                        <PlayPanel
                          key={p.id}
                          panel={p}
                          onResource={changeResource}
                          onRemove={removePanel}
                          onFill={(text) => fill(p.id, text)}
                          onSend={(text) => sendNow(p.id, text)}
                          onEditPalette={(text) =>
                            updatePanel(p.id, { palette: text })
                          }
                          onSpeed={(panel, speed) =>
                            updatePanel(panel.id, { speed })
                          }
                          onToggleHidden={(panel) =>
                            updatePanel(panel.id, { hidden: !panel.hidden })
                          }
                        />
                      ))
                    )}
                  </div>
                ),
              },
              {
                id: "stock",
                title: "テキスト",
                icon: <BookOpen size={14} />,
                defaultOpen: false,
                body: (
                  <TextStockPanel
                    stock={scene.textStock ?? ""}
                    onFill={(text) => fill("GM", text)}
                    onSend={(text, se) => {
                      playSeByName(se);
                      sendNow("GM", text);
                    }}
                    onTelop={(text, se) => {
                      playSeByName(se);
                      fireTelop(text);
                    }}
                    onEdit={setTextStock}
                  />
                ),
              },
              {
                id: "scenario",
                title: "シナリオ",
                icon: <ScrollText size={14} />,
                defaultOpen: false,
                body: <ScenarioViewer playId={scene.id} />,
              },
              {
                id: "scenario-build",
                title: "シナリオ作成",
                icon: <NotebookPen size={14} />,
                defaultOpen: false,
                body: (
                  <ScenarioBuilderPanel
                    scenario={scene.scenario}
                    onChange={(next) =>
                      setScene((s) => ({ ...s, scenario: next }))
                    }
                    scenes={scene.scenes ?? []}
                    onChangeScene={(sceneId, patch) =>
                      setScene((s) => ({
                        ...s,
                        scenes: (s.scenes ?? []).map((sc) =>
                          sc.id === sceneId ? { ...sc, ...patch } : sc,
                        ),
                      }))
                    }
                    onExportPack={exportScenarioPack}
                  />
                ),
              },
              {
                id: "cutin",
                title: "カットイン",
                icon: <Clapperboard size={14} />,
                defaultOpen: false,
                body: (
                  <CutInPanel
                    cutins={scene.cutins ?? []}
                    seTracks={scene.se?.tracks ?? []}
                    onAdd={addCutin}
                    onRemove={removeCutin}
                    onFire={fireCutin}
                    onSetSound={setCutinSound}
                    onSetBg={setCutinBg}
                  />
                ),
              },
              {
                id: "sound",
                title: "サウンド（BGM / SE）",
                icon: <Music size={14} />,
                defaultOpen: false,
                body: (
                  <SoundPanel
                    tracks={mergeSounds(scene.bgm?.tracks, scene.se?.tracks)}
                    onAddTracks={addBgmTracks}
                    onRemoveTrack={removeSound}
                    sceneBgmId={sceneBgmId}
                    onBindScene={bindSceneBgm}
                    playSignal={bgmSignal ?? undefined}
                    onPlayBgm={(track) =>
                      void broadcastAudio("bgm", track?.path ?? null, true)
                    }
                    onPlaySe={(track) => {
                      void playSeFile(track.path); // GM ローカル再生
                      void broadcastAudio("se", track.path); // 参加者へ配信
                    }}
                  />
                ),
              },
            ]}
          />
        </aside>

        {/* メイン: シーンバー + 盤面 */}
        <main className="pmain">
          <SceneBar
            scenes={scene.scenes ?? []}
            activeId={scene.activeSceneId}
            onSelect={selectScene}
            onAdd={addScene}
            onRename={renameScene}
            onRemove={(id) => void removeScene(id)}
          />
          <div className="pstage">
            <PlayBoard
              board={scene.board}
              panels={overlayLive(scene.panels)}
              activeSceneId={scene.activeSceneId}
              onMove={movePanel}
              onDragMove={sendDrag}
              onSetImage={setBoardImage}
              onSetForeground={setForeground}
              onScaleArt={scaleArt}
              onToggleBgBlur={toggleBgBlur}
              onReorder={reorder}
              onToggleGrid={toggleGrid}
              onAddImage={addImageObject}
              onUpdate={updatePanel}
              onRemove={(id) => dispatch(panelRemoveEvent(newCtx(), id))}
              onOpenCharacters={onCharacters}
              participants={members.filter((n) => n !== "GM")}
              onTransfer={(panelId, owner) => updatePanel(panelId, { owner })}
            />
            {/* 立ち絵(直近の発言キャラ)。表示はこの端末ローカルで切替可。 */}
            <PortraitLayer log={scene.log} panels={scene.panels} playId={scene.id} />
            {/* 盤面左上のステータス一覧(速さ順・サイドバーと同順)。 */}
            <BoardStatusBar
              cards={cards}
              turn={scene.turn}
              onNextTurn={nextTurn}
              onResetTurn={resetTurn}
            />
          </div>
        </main>

        {/* 右サイドバー(固定): チャット / メモ / ルールQ&A(並べ替え・高さ変更可) */}
        <aside className="psider">
          <SideStack
            storageKey={`trpg.play.stack-right.v1::${scene.id}`}
            sections={[
              {
                id: "chat",
                title: "チャット / ログ",
                icon: <MessageSquare size={14} />,
                defaultHeight: 480,
                body: (
                  <div className="pside-log">
                    <LogView
                      log={scene.log}
                      speakers={[
                        { id: "GM", name: "GM" },
                        // 発言者・秘匿対象・個別チャットはキャラ駒のみ。
                        ...cards.map((p) => ({ id: p.id, name: p.name })),
                      ]}
                      speakerId={compose.speakerId}
                      text={compose.text}
                      secret={secret}
                      visibleTo={visibleTo}
                      channel={channel}
                      onChannelChange={setChannel}
                      color={chatColor}
                      onColorChange={changeChatColor}
                      onSpeakerChange={(id) =>
                        setCompose((c) => ({ ...c, speakerId: id }))
                      }
                      onTextChange={(t) =>
                        setCompose((c) => ({ ...c, text: t }))
                      }
                      onSecretChange={setSecret}
                      onVisibleToChange={setVisibleTo}
                      onSubmit={submitCompose}
                      onQuickRoll={(expr) => handleSend(compose.speakerId, expr)}
                      onExport={() => void exportLog()}
                      onClearLog={() => void clearLog()}
                      diceBot={diceBot}
                      onDiceBotChange={setDiceBot}
                      inputRef={inputRef}
                    />
                  </div>
                ),
              },
              {
                id: "memo",
                title: "メモ",
                icon: <StickyNote size={14} />,
                defaultOpen: false,
                body: (
                  <MemoPanel
                    playId={scene.id}
                    sharedMemos={
                      scene.sharedMemos ?? [
                        { id: "main", name: "メモ", text: scene.sharedMemo ?? "" },
                      ]
                    }
                    onSharedMemosChange={setSharedMemos}
                  />
                ),
              },
              {
                id: "rulebook",
                title: "ルールブック Q&A",
                icon: <BookMarked size={14} />,
                defaultOpen: false,
                body: <RulebookQA playId={scene.id} />,
              },
            ]}
          />
        </aside>
      </div>
      )}

      {/* 参加者ビュー: 盤面フルスクリーン + 格納式ドロワー([ / ] でも開閉)。
          サイコロ・キャラ・チャット・メモ以外は表示しない(没入重視)。 */}
      {playerMode && (
        <div className="ptable-body2 pbody-player">
          <main className="pmain">
            <div className="pstage">
              <PlayBoard
                board={scene.board}
                panels={overlayLive(scene.panels)}
                activeSceneId={scene.activeSceneId}
                playerMode
                onMove={movePanel}
                onDragMove={sendDrag}
                onSetImage={setBoardImage}
                onToggleGrid={toggleGrid}
                onAddImage={addImageObject}
                onUpdate={updatePanel}
                onRemove={(id) => dispatch(panelRemoveEvent(newCtx(), id))}
              />
              <PortraitLayer log={scene.log} panels={scene.panels} playId={scene.id} />
              <BoardStatusBar cards={playerCards} turn={scene.turn} />
            </div>
          </main>

          {/* 左ドロワー: キャラクター */}
          <aside className={`pdrawer left ${leftOpen ? "open" : ""}`}>
            <div className="pdrawer-head ibtn"><Users size={14} /> キャラクター</div>
            <div className="pdrawer-body ss-chars">
              {playerCards.length === 0 ? (
                <p className="pside-empty muted">
                  表示できるキャラクターがいません。
                </p>
              ) : (
                playerCards.map((p) => (
                  <PlayPanel
                    key={p.id}
                    panel={p}
                    playerMode
                    onResource={changeResource}
                    onRemove={removePanel}
                    onFill={(text) => fill(p.id, text)}
                    onSend={(text) => sendNow(p.id, text)}
                    onEditPalette={(text) =>
                      updatePanel(p.id, { palette: text })
                    }
                    onSpeed={(panel, speed) =>
                      updatePanel(panel.id, { speed })
                    }
                  />
                ))
              )}
            </div>
            <button
              className="pdrawer-tab"
              onClick={() => setLeftOpen((v) => !v)}
              title="キャラクター（[ キーでも開閉）"
              aria-label="キャラクターを開閉"
            >
              {leftOpen ? "◀" : "▶"}
            </button>
          </aside>

          {/* 右ドロワー: チャット + メモ */}
          <aside className={`pdrawer right ${rightOpen ? "open" : ""}`}>
            <div className="pdrawer-body pdrawer-stack">
              <SideStack
                storageKey={`trpg.play.stack-player.v1::${scene.id}`}
                sections={[
                  {
                    id: "chat",
                    title: "チャット / ログ",
                    icon: <MessageSquare size={14} />,
                    defaultHeight: 460,
                    body: (
                      <div className="pside-log">
                        <LogView
                          log={scene.log}
                          speakers={[
                            { id: "GM", name: "GM" },
                            ...playerCards.map((p) => ({
                              id: p.id,
                              name: p.name,
                            })),
                          ]}
                          speakerId={compose.speakerId}
                          text={compose.text}
                          secret={secret}
                          visibleTo={visibleTo}
                          channel={channel}
                          onChannelChange={setChannel}
                      color={chatColor}
                      onColorChange={changeChatColor}
                          onSpeakerChange={(id) =>
                            setCompose((c) => ({ ...c, speakerId: id }))
                          }
                          onTextChange={(t) =>
                            setCompose((c) => ({ ...c, text: t }))
                          }
                          onSecretChange={setSecret}
                          onVisibleToChange={setVisibleTo}
                          onSubmit={submitCompose}
                          onQuickRoll={(expr) => handleSend(compose.speakerId, expr)}
                          maskSecret
                          diceBot={diceBot}
                          inputRef={inputRef}
                        />
                      </div>
                    ),
                  },
                  {
                    id: "memo",
                    title: "メモ",
                    icon: <StickyNote size={14} />,
                    defaultOpen: false,
                    body: (
                      <MemoPanel
                        playId={scene.id}
                        sharedMemos={
                          scene.sharedMemos ?? [
                            {
                              id: "main",
                              name: "メモ",
                              text: scene.sharedMemo ?? "",
                            },
                          ]
                        }
                        onSharedMemosChange={setSharedMemos}
                      />
                    ),
                  },
                ]}
              />
            </div>
            <button
              className="pdrawer-tab"
              onClick={() => setRightOpen((v) => !v)}
              title="チャット / メモ（] キーでも開閉）"
              aria-label="チャットとメモを開閉"
            >
              {rightOpen ? "▶" : "◀"}
            </button>
          </aside>
        </div>
      )}

      {motion && (
        <DiceMotion
          roll={motion}
          masked={playerMode && !!motion.secret}
          onClose={() => setMotion(null)}
        />
      )}
      {cutin && <CutInOverlay cutin={cutin} onDone={clearCutin} />}
      {telop && <TelopOverlay text={telop} onDone={clearTelop} />}
    </div>
  );
}
