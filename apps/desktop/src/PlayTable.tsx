import { useMemo, useRef, useState } from "react";
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
import { ask } from "@tauri-apps/plugin-dialog";
import { DiceMotion } from "./DiceMotion";
import { PlayBoard } from "./PlayBoard";
import { SceneBar } from "./SceneBar";
import { PlayPanel } from "./PlayPanel";
import { LogView } from "./LogView";
import { BgmPlayer } from "./BgmPanel";
import { BoardStatusBar } from "./BoardStatusBar";
import { TextStockPanel } from "./TextStock";
import { CutInPanel, CutInOverlay } from "./CutIn";
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
}: {
  initial: PlayScene;
  path: string | null;
  onClose: () => void;
  onPersist: (scene: PlayScene, path: string) => void;
}) {
  const [scene, setScene] = useState<PlayScene>(initial);
  const [savedPath, setSavedPath] = useState<string | null>(path);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ダイス・モーション(振った RollEvent をそのまま渡す)。
  const [motion, setMotion] = useState<RollEvent | null>(null);

  const [pickId, setPickId] = useState("");
  const [tokenName, setTokenName] = useState("");
  // チャット入力(発言者 + 本文)。技能/パレットのクリックでここに流し込む。
  const [compose, setCompose] = useState<{ speakerId: string; text: string }>({
    speakerId: "GM",
    text: "",
  });
  // シークレットダイス(出目を伏せる)+ 見せる相手(名前)。
  const [secret, setSecret] = useState(false);
  const [visibleTo, setVisibleTo] = useState<string[]>([]);
  // 再生中のカットイン。
  const [cutin, setCutin] = useState<CutIn | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const characters = useMemo(() => getLibrary(), []);

  // 能力値/リソースを持つ“キャラ駒”だけサイドバーに出す(画像オブジェクトは盤面のみ)。
  // 速さ(行動順)の降順で、サイドバー / 盤面左上の両方が同じ順序に並ぶ。
  const cards = scene.panels
    .filter((p) => p.stats.length > 0 || p.resources.length > 0)
    .sort((a, b) => (b.speed ?? -Infinity) - (a.speed ?? -Infinity));

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

  function addToken() {
    const name = tokenName.trim();
    if (!name) return;
    const panel = {
      ...makeTokenPanel({ id: crypto.randomUUID(), name }),
      pos: spawnPos(),
    };
    dispatch(panelAddEvent(newCtx(), panel));
    setTokenName("");
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
    const cmd = parseDiceCommand(raw);
    try {
      if (cmd.kind === "none") {
        dispatch(chatEvent(newCtx(), name, raw));
        return;
      }
      let ev =
        cmd.kind === "notation"
          ? freeRollEvent(newCtx(), name, cmd.notation, cmd.label)
          : cmd.kind === "coc"
            ? checkEvent(newCtx(), name, cmd.label, cmd.target, edition)
            : compareRollEvent(
                newCtx(),
                name,
                cmd.notation,
                cmd.op,
                cmd.target,
                cmd.label,
              );
      // シークレットダイス: 出目を伏せる(見せる相手はチェックで指定)。
      if (secret) {
        ev = { ...ev, secret: true, visibleTo: [...visibleTo] };
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
        <input
          className="ptable-title input"
          value={scene.title}
          onChange={(e) => {
            setScene((s) => ({ ...s, title: e.target.value }));
            setDirty(true);
          }}
          placeholder="卓のタイトル"
        />
        <div className="ptable-tools">
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
          <input
            className="input ptable-token"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addToken()}
            placeholder="トークン名"
          />
          <button className="btn mini" onClick={addToken} disabled={!tokenName.trim()}>
            ＋トークン
          </button>
          <span className="ptable-spacer" />
          <button className="btn mini btn-primary" onClick={() => void save()}>
            {dirty ? "保存*" : "保存"}
          </button>
          <button className="btn mini" onClick={onClose}>
            閉じる
          </button>
        </div>
      </header>

      {error && (
        <p className="tag fail" style={{ margin: "6px 12px" }}>
          {error}
        </p>
      )}

      <div className="ptable-body2">
        {/* 左サイドバー(固定): キャラ + ログ/チャット + BGM */}
        <aside className="pside">
          <div className="pside-chars">
            {cards.length === 0 ? (
              <p className="pside-empty muted">
                「＋キャラ」で保存済みキャラを、「＋トークン」で NPC/敵を、
                画像のドロップで盤面オブジェクトを置けます。
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
                  onEditPalette={(text) => updatePanel(p.id, { palette: text })}
                  onSpeed={(panel, speed) => updatePanel(panel.id, { speed })}
                />
              ))
            )}
          </div>

          <details className="pside-stock">
            <summary>📖 テキスト</summary>
            <TextStockPanel
              stock={scene.textStock ?? ""}
              onFill={(text) => fill("GM", text)}
              onSend={(text) => sendNow("GM", text)}
              onEdit={setTextStock}
            />
          </details>

          <details className="pside-cutin">
            <summary>🎬 カットイン</summary>
            <CutInPanel
              cutins={scene.cutins ?? []}
              onAdd={addCutin}
              onRemove={removeCutin}
              onFire={setCutin}
            />
          </details>

          <details className="pside-bgm">
            <summary>♪ BGM</summary>
            <BgmPlayer
              tracks={scene.bgm?.tracks ?? []}
              onAddTracks={addBgmTracks}
              onRemoveTrack={removeBgmTrack}
            />
          </details>

          <div className="pside-log">
            <LogView
              log={scene.log}
              speakers={[
                { id: "GM", name: "GM" },
                // 発言者・秘匿対象はキャラ駒のみ(画像オブジェクトは含めない)。
                ...cards.map((p) => ({ id: p.id, name: p.name })),
              ]}
              speakerId={compose.speakerId}
              text={compose.text}
              secret={secret}
              visibleTo={visibleTo}
              onSpeakerChange={(id) =>
                setCompose((c) => ({ ...c, speakerId: id }))
              }
              onTextChange={(t) => setCompose((c) => ({ ...c, text: t }))}
              onSecretChange={setSecret}
              onVisibleToChange={setVisibleTo}
              onSubmit={submitCompose}
              inputRef={inputRef}
            />
          </div>
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
      </div>

      {motion && (
        <DiceMotion roll={motion} onClose={() => setMotion(null)} />
      )}
      {cutin && <CutInOverlay cutin={cutin} onDone={() => setCutin(null)} />}
    </div>
  );
}
