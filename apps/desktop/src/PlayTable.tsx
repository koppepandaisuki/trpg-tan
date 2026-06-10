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
  type CoCEdition,
} from "@trpg/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { DiceMotion } from "./DiceMotion";
import { PlayPanel } from "./PlayPanel";
import { PlayBoard } from "./PlayBoard";
import { SceneBar } from "./SceneBar";
import { BgmPanel } from "./BgmPanel";
import { FloatingWidget } from "./FloatingWidget";
import { LogView } from "./LogView";
import { WidgetLayoutProvider, type Rect } from "./widget-layout";
import {
  emitSync,
  onHello,
  onIntent,
  onRedock,
  openWidgetWindow,
  closeWidgetWindow,
  type PlayIntent,
} from "./play-bus";
import { getLibrary } from "./library";
import { readSheetFromPath } from "./storage";
import { savePlayAs, savePlayToPath } from "./play-storage";

/** イベント文脈(id/時刻)。乱数は @trpg/core 側の既定(Math.random)。 */
function newCtx() {
  return { id: crypto.randomUUID(), ts: new Date().toISOString() };
}

/** キャラ・ウィジェットの初期位置(左上から少しずつずらして重ねる)。 */
function panelDefault(i: number): (b: { w: number; h: number }) => Rect {
  const off = 16 + (i % 7) * 30;
  return () => ({ x: off, y: off, w: 268, h: 320, z: 0 });
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
  const [showBgm, setShowBgm] = useState(false);

  const [pickId, setPickId] = useState("");
  const [tokenName, setTokenName] = useState("");
  // 別ウィンドウ(別モニター)へ切り離し中のウィジェット id 集合。
  const [detached, setDetached] = useState<Set<string>>(() => new Set());

  const characters = useMemo(() => getLibrary(), []);
  const stageRef = useRef<HTMLDivElement>(null);

  // 能力値/リソースを持つ“キャラ駒”だけウィジェット化(画像オブジェクトは盤面のみ)。
  const cards = scene.panels.filter(
    (p) => p.stats.length > 0 || p.resources.length > 0,
  );

  // バス用に最新 scene / detached を ref で参照(リスナは一度だけ登録するため)。
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const detachedRef = useRef(detached);
  detachedRef.current = detached;

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
    },
  ) {
    dispatch(panelUpdateEvent(newCtx(), id, patch));
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
      const ev =
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
      dispatch(ev);
      setMotion(ev);
      setError(null);
    } catch {
      setError(`コマンドを解釈できません: "${raw}"`);
    }
  }

  /* ===== 切り離し(別ウィンドウ/別モニター)の同期 ===== */

  // intent(窓→メイン)を「最新の」ハンドラで処理するための ref。
  const intentRef = useRef<(i: PlayIntent) => void>(() => {});
  intentRef.current = (intent: PlayIntent) => {
    const s = sceneRef.current;
    switch (intent.kind) {
      case "roll": {
        const p = s.panels.find((x) => x.id === intent.panelId);
        const stat = p?.stats.find((st) => st.key === intent.statKey);
        if (p && stat) rollStat(p, stat);
        break;
      }
      case "resource": {
        const p = s.panels.find((x) => x.id === intent.panelId);
        const r = p?.resources.find((res) => res.key === intent.resourceKey);
        if (p && r) changeResource(p, r, intent.delta);
        break;
      }
      case "remove-panel":
        dispatch(panelRemoveEvent(newCtx(), intent.panelId));
        break;
      case "send":
        handleSend(intent.speakerId, intent.raw);
        break;
      case "panel-update":
        dispatch(panelUpdateEvent(newCtx(), intent.panelId, intent.patch));
        break;
      case "bgm-add":
        addBgmTracks(intent.tracks);
        break;
      case "bgm-remove":
        removeBgmTrack(intent.id);
        break;
    }
  };

  // バスのリスナは一度だけ登録(中身は ref 経由で常に最新を呼ぶ)。
  useEffect(() => {
    const subs = [
      onHello(() => void emitSync(sceneRef.current)),
      onIntent((i) => intentRef.current(i)),
      onRedock((wid) =>
        setDetached((set) => {
          const next = new Set(set);
          next.delete(wid);
          return next;
        }),
      ),
    ];
    return () => {
      subs.forEach((p) => p.then((un) => un()).catch(() => {}));
      // 卓を閉じる時は切り離し窓も閉じる。
      detachedRef.current.forEach((wid) => void closeWidgetWindow(wid));
    };
  }, []);

  // 切り離し窓があるときだけ scene 変更を配信(無ければ送らない)。
  useEffect(() => {
    if (detachedRef.current.size > 0) void emitSync(sceneRef.current);
  }, [scene]);

  function detach(widgetId: string, title: string) {
    setDetached((set) => new Set(set).add(widgetId));
    void openWidgetWindow(widgetId, title);
    void emitSync(sceneRef.current);
  }
  function redock(widgetId: string) {
    setDetached((set) => {
      const next = new Set(set);
      next.delete(widgetId);
      return next;
    });
    void closeWidgetWindow(widgetId);
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
          <button
            className={`btn mini ${showBgm ? "btn-primary" : ""}`}
            onClick={() => setShowBgm((v) => !v)}
          >
            ♪ BGM
          </button>
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

      <div className="ptable-body">
        <SceneBar
          scenes={scene.scenes ?? []}
          activeId={scene.activeSceneId}
          onSelect={selectScene}
          onAdd={addScene}
          onRename={renameScene}
          onRemove={(id) => void removeScene(id)}
        />

        <div className="pstage" ref={stageRef}>
          <PlayBoard
            board={scene.board}
            panels={scene.panels}
            onMove={movePanel}
            onSetImage={setBoardImage}
            onToggleGrid={toggleGrid}
            onAddImage={addImageObject}
            onUpdate={updatePanel}
            onRemove={(id) => dispatch(panelRemoveEvent(newCtx(), id))}
          />

          {/* フローティング・ウィジェット層(キャラ・ログ・BGM を自由配置) */}
          <WidgetLayoutProvider playId={scene.id}>
            {cards.map((p, i) => (
              <FloatingWidget
                key={p.id}
                id={`panel:${p.id}`}
                title={p.name}
                icon="🎭"
                boundsRef={stageRef}
                minW={232}
                minH={150}
                bodyClass="ppanel-body"
                defaultRect={panelDefault(i)}
                detached={detached.has(`panel:${p.id}`)}
                onDetach={() => detach(`panel:${p.id}`, p.name)}
                onRedock={() => redock(`panel:${p.id}`)}
              >
                <PlayPanel
                  panel={p}
                  onRoll={rollStat}
                  onResource={changeResource}
                  onRemove={removePanel}
                  onPalette={(line) => handleSend(p.id, line)}
                  onEditPalette={(text) => updatePanel(p.id, { palette: text })}
                />
              </FloatingWidget>
            ))}

            <FloatingWidget
              id="log"
              title="ログ / チャット"
              icon="📜"
              boundsRef={stageRef}
              minW={260}
              minH={220}
              bodyClass="log-body"
              defaultRect={(b) => ({
                x: Math.max(16, b.w - 356),
                y: 16,
                w: 340,
                h: Math.min(460, Math.max(240, b.h - 32)),
                z: 0,
              })}
              detached={detached.has("log")}
              onDetach={() => detach("log", "ログ / チャット")}
              onRedock={() => redock("log")}
            >
              <LogView
                log={scene.log}
                speakers={[
                  { id: "GM", name: "GM" },
                  ...scene.panels.map((p) => ({ id: p.id, name: p.name })),
                ]}
                onSend={handleSend}
              />
            </FloatingWidget>

            <BgmPanel
              tracks={scene.bgm?.tracks ?? []}
              open={showBgm}
              onClose={() => setShowBgm(false)}
              onAddTracks={addBgmTracks}
              onRemoveTrack={removeBgmTrack}
              boundsRef={stageRef}
            />
          </WidgetLayoutProvider>
        </div>
      </div>

      {motion && (
        <DiceMotion roll={motion} onClose={() => setMotion(null)} />
      )}
    </div>
  );
}
