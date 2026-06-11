import { useEffect, useMemo, useRef, useState } from "react";
import {
  reduce,
  panelFromSheet,
  makeTokenPanel,
  checkEvent,
  freeRollEvent,
  compareRollEvent,
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
  type PlayScene,
  type PlayEvent,
  type RollEvent,
  type Panel,
  type PanelStat,
  type PanelResource,
  type BgmTrack,
  type SceneInfo,
  type CutIn,
  type CoCEdition,
} from "@trpg/core";
import { ask, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { DiceMotion } from "./DiceMotion";
import { PlayBoard } from "./PlayBoard";
import { SceneBar } from "./SceneBar";
import { PlayPanel } from "./PlayPanel";
import { LogView } from "./LogView";
import { BgmPlayer } from "./BgmPanel";
import { BoardStatusBar } from "./BoardStatusBar";
import { TextStockPanel, TelopOverlay } from "./TextStock";
import { CutInPanel, CutInOverlay } from "./CutIn";
import { SideStack } from "./SideStack";
import { MemoPanel } from "./MemoPanel";
import { RulebookQA } from "./RulebookQA";
import { SePanel, playSeFile } from "./SePanel";
import { getLibrary } from "./library";
import { readSheetFromPath } from "./storage";
import { savePlayAs, savePlayToPath } from "./play-storage";

/** イベント文脈(id/時刻)。乱数は @trpg/core 側の既定(Math.random)。 */
function newCtx() {
  return { id: crypto.randomUUID(), ts: new Date().toISOString() };
}

/** data URL 画像の実寸(幅)を読む。cap で上限クランプ。読めなければ既定。 */
function probeImageWidth(dataUrl: string, cap = 600): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(Math.min(img.naturalWidth || 140, cap));
    img.onerror = () => resolve(140);
    img.src = dataUrl;
  });
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
}: {
  initial: PlayScene;
  path: string | null;
  onClose: () => void;
  onPersist: (scene: PlayScene, path: string) => void;
  /** ☰ メニュー(キャラ/購入/卓のドロワー)を開く。 */
  onMenu?: () => void;
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
  // 再生中のカットイン / テロップ(定型文の画面表示)。
  const [cutin, setCutin] = useState<CutIn | null>(null);
  const [telop, setTelop] = useState<string | null>(null);
  // 参加者ビュー(没入モード): 盤面フルスクリーン + 格納式ドロワー。
  const [playerMode, setPlayerMode] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const characters = useMemo(() => getLibrary(), []);

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
  }

  const sceneEdition: CoCEdition = scene.systemId === "coc6" ? "6" : "7";

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

  function toggleGrid() {
    dispatch(boardSetEvent(newCtx(), { grid: !(scene.board?.grid ?? true) }));
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
  }

  function renameScene(id: string, name: string) {
    dispatch(sceneRenameEvent(newCtx(), id, name));
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

  function addBgmTracks(newTracks: BgmTrack[]) {
    setScene((s) => ({
      ...s,
      bgm: { tracks: [...(s.bgm?.tracks ?? []), ...newTracks] },
    }));
    setDirty(true);
  }

  function removeBgmTrack(id: string) {
    setScene((s) => ({
      ...s,
      bgm: { tracks: (s.bgm?.tracks ?? []).filter((t) => t.id !== id) },
    }));
    setDirty(true);
  }

  function addSeTracks(newTracks: BgmTrack[]) {
    setScene((s) => ({
      ...s,
      se: { tracks: [...(s.se?.tracks ?? []), ...newTracks] },
    }));
    setDirty(true);
  }

  function removeSeTrack(id: string) {
    setScene((s) => ({
      ...s,
      se: { tracks: (s.se?.tracks ?? []).filter((t) => t.id !== id) },
    }));
    setDirty(true);
  }

  /** SE パネルの登録名で効果音を鳴らす(定型文の [SE:名前] 用)。 */
  function playSeByName(name?: string) {
    if (!name) return;
    const t = (scene.se?.tracks ?? []).find((x) => x.name === name);
    if (t) void playSeFile(t.path);
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
      palette?: string;
      speed?: number;
      sceneId?: string | null;
      layer?: number;
      locked?: boolean;
    },
  ) {
    dispatch(panelUpdateEvent(newCtx(), id, patch));
  }

  /* ===== シナリオテキストストック / カットイン(GM ローカル編集) ===== */

  function setTextStock(text: string) {
    setScene((s) => ({ ...s, textStock: text }));
    setDirty(true);
  }

  function setSharedMemo(text: string) {
    setScene((s) => ({ ...s, sharedMemo: text }));
    setDirty(true);
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
        const res = ev.check
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

  async function addFromCharacter() {
    const entry = characters.find((c) => c.id === pickId);
    if (!entry) return;
    setError(null);
    try {
      const sheet = await readSheetFromPath(entry.path);
      const base = panelFromSheet({ id: crypto.randomUUID(), sheet });
      // ポートレートがあれば実寸(自然な幅)で配置。
      const size = base.portrait ? await probeImageWidth(base.portrait) : undefined;
      dispatch(
        panelAddEvent(newCtx(), {
          ...base,
          pos: spawnPos(),
          ...(size ? { size } : {}),
        }),
      );
      setPickId("");
    } catch (e) {
      setError(`キャラを読み込めませんでした: ${String(e)}`);
    }
  }

  /** 発言者 id → 表示名 + 版(CoC 判定の閾値に使う)。 */
  function resolveSpeaker(speakerId: string): { name: string; edition: CoCEdition } {
    if (speakerId === "GM") return { name: "GM", edition: sceneEdition };
    const p = scene.panels.find((x) => x.id === speakerId);
    return { name: p?.name ?? "GM", edition: p?.edition ?? sceneEdition };
  }

  /** チャット入力(発言 or ダイスコマンド)を解釈して適用。 */
  function handleSend(speakerId: string, raw: string) {
    const { name, edition } = resolveSpeaker(speakerId);
    const ch = channel === "main" ? undefined : channel;
    const cmd = parseDiceCommand(raw);
    try {
      if (cmd.kind === "none") {
        dispatch(chatEvent(newCtx(), name, raw, ch));
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
      if (secret) {
        ev = { ...ev, secret: true, visibleTo: [...visibleTo] };
      }
      // 個別チャット内のロールはそのチャンネルに留める。
      if (ch) {
        ev = { ...ev, channel: ch };
      }
      dispatch(ev);
      setMotion(ev);
      setError(null);
    } catch {
      setError(`コマンドを解釈できません: "${raw}"`);
    }
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

  async function save() {
    setError(null);
    try {
      let p = savedPath;
      if (p) {
        await savePlayToPath(scene, p);
      } else {
        p = await savePlayAs(scene);
        if (!p) return; // キャンセル
        setSavedPath(p);
      }
      onPersist(scene, p);
      setDirty(false);
    } catch (e) {
      setError(`保存に失敗しました: ${String(e)}`);
    }
  }

  return (
    <div className="ptable">
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
                    {c.name}（{c.systemId === "coc6" ? "6版" : "7版"}）
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
            </>
          )}
          <span className="ptable-spacer" />
          <button
            className={`btn mini ${playerMode ? "btn-primary" : ""}`}
            onClick={() => setPlayerMode((v) => !v)}
            title={
              playerMode
                ? "GM ビューに戻る"
                : "参加者ビュー（没入モード。GM ツールを隠し、[ ] でサイドバー開閉）"
            }
          >
            {playerMode ? "🛠 GMビュー" : "🎲 プレイヤービュー"}
          </button>
          {!playerMode && (
            <>
              {onMenu && (
                <button
                  className="btn mini"
                  onClick={onMenu}
                  title="メニュー（キャラ / 購入 / 卓）"
                  aria-label="メニューを開く"
                >
                  ☰
                </button>
              )}
              <button
                className="btn mini btn-primary"
                onClick={() => void save()}
              >
                {dirty ? "保存*" : "保存"}
              </button>
              <button className="btn mini" onClick={onClose}>
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

      {!playerMode && (
      <div className="ptable-body2">
        {/* 左サイドバー(固定): ブロックはドラッグで並べ替え・高さ変更可 */}
        <aside className="pside">
          <SideStack
            storageKey={`trpg.play.stack-left.v1::${scene.id}`}
            sections={[
              {
                id: "chars",
                title: "キャラクター",
                icon: "🎭",
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
                        />
                      ))
                    )}
                  </div>
                ),
              },
              {
                id: "stock",
                title: "テキスト",
                icon: "📖",
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
                      setTelop(text);
                    }}
                    onEdit={setTextStock}
                  />
                ),
              },
              {
                id: "cutin",
                title: "カットイン",
                icon: "🎬",
                defaultOpen: false,
                body: (
                  <CutInPanel
                    cutins={scene.cutins ?? []}
                    seTracks={scene.se?.tracks ?? []}
                    onAdd={addCutin}
                    onRemove={removeCutin}
                    onFire={setCutin}
                    onSetSound={setCutinSound}
                  />
                ),
              },
              {
                id: "bgm",
                title: "BGM",
                icon: "♪",
                defaultOpen: false,
                body: (
                  <BgmPlayer
                    tracks={scene.bgm?.tracks ?? []}
                    onAddTracks={addBgmTracks}
                    onRemoveTrack={removeBgmTrack}
                  />
                ),
              },
              {
                id: "se",
                title: "SE（効果音）",
                icon: "🔔",
                defaultOpen: false,
                body: (
                  <SePanel
                    tracks={scene.se?.tracks ?? []}
                    onAdd={addSeTracks}
                    onRemove={removeSeTrack}
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
              panels={scene.panels}
              activeSceneId={scene.activeSceneId}
              onMove={movePanel}
              onSetImage={setBoardImage}
              onToggleGrid={toggleGrid}
              onAddImage={addImageObject}
              onUpdate={updatePanel}
              onRemove={(id) => dispatch(panelRemoveEvent(newCtx(), id))}
            />
            {/* 盤面左上のステータス一覧(速さ順・サイドバーと同順)。 */}
            <BoardStatusBar cards={cards} />
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
                icon: "💬",
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
                      onSpeakerChange={(id) =>
                        setCompose((c) => ({ ...c, speakerId: id }))
                      }
                      onTextChange={(t) =>
                        setCompose((c) => ({ ...c, text: t }))
                      }
                      onSecretChange={setSecret}
                      onVisibleToChange={setVisibleTo}
                      onSubmit={submitCompose}
                      onExport={() => void exportLog()}
                      inputRef={inputRef}
                    />
                  </div>
                ),
              },
              {
                id: "memo",
                title: "メモ",
                icon: "📝",
                defaultOpen: false,
                body: (
                  <MemoPanel
                    playId={scene.id}
                    shared={scene.sharedMemo ?? ""}
                    onSharedChange={setSharedMemo}
                  />
                ),
              },
              {
                id: "rulebook",
                title: "ルールブック Q&A",
                icon: "📕",
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
                panels={scene.panels}
                activeSceneId={scene.activeSceneId}
                playerMode
                onMove={movePanel}
                onSetImage={setBoardImage}
                onToggleGrid={toggleGrid}
                onAddImage={addImageObject}
                onUpdate={updatePanel}
                onRemove={(id) => dispatch(panelRemoveEvent(newCtx(), id))}
              />
              <BoardStatusBar cards={playerCards} />
            </div>
          </main>

          {/* 左ドロワー: キャラクター */}
          <aside className={`pdrawer left ${leftOpen ? "open" : ""}`}>
            <div className="pdrawer-head">🎭 キャラクター</div>
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
                    icon: "💬",
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
                          onSpeakerChange={(id) =>
                            setCompose((c) => ({ ...c, speakerId: id }))
                          }
                          onTextChange={(t) =>
                            setCompose((c) => ({ ...c, text: t }))
                          }
                          onSecretChange={setSecret}
                          onVisibleToChange={setVisibleTo}
                          onSubmit={submitCompose}
                          maskSecret
                          inputRef={inputRef}
                        />
                      </div>
                    ),
                  },
                  {
                    id: "memo",
                    title: "メモ",
                    icon: "📝",
                    defaultOpen: false,
                    body: (
                      <MemoPanel
                        playId={scene.id}
                        shared={scene.sharedMemo ?? ""}
                        onSharedChange={setSharedMemo}
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
      {cutin && <CutInOverlay cutin={cutin} onDone={() => setCutin(null)} />}
      {telop && <TelopOverlay text={telop} onDone={() => setTelop(null)} />}
    </div>
  );
}
