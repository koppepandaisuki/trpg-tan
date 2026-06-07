import { useEffect, useMemo, useRef, useState } from "react";
import {
  reduce,
  panelFromSheet,
  makeTokenPanel,
  checkEvent,
  freeRollEvent,
  chatEvent,
  resourceEvent,
  panelAddEvent,
  panelRemoveEvent,
  panelMoveEvent,
  panelUpdateEvent,
  boardSetEvent,
  type PlayScene,
  type PlayEvent,
  type RollEvent,
  type Panel,
  type PanelStat,
  type PanelResource,
  type BgmTrack,
  type CoCEdition,
  type CoCCheckResult,
} from "@trpg/core";
import { DiceMotion } from "./DiceMotion";
import { PlayPanel } from "./PlayPanel";
import { PlayBoard } from "./PlayBoard";
import { BgmPanel } from "./BgmPanel";
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
  const [showBgm, setShowBgm] = useState(false);

  const [pickId, setPickId] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [chat, setChat] = useState("");
  const [notation, setNotation] = useState("");

  const characters = useMemo(() => getLibrary(), []);
  const logRef = useRef<HTMLDivElement>(null);

  // ログ更新で末尾へ自動スクロール。
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scene.log.length]);

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
    patch: { name?: string; note?: string; hidden?: boolean; size?: number },
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

  function sendChat() {
    const text = chat.trim();
    if (!text) return;
    dispatch(chatEvent(newCtx(), "GM", text));
    setChat("");
  }

  function rollFree() {
    const n = notation.trim();
    if (!n) return;
    try {
      const ev = freeRollEvent(newCtx(), "GM", n);
      dispatch(ev);
      setMotion(ev);
      setNotation("");
      setError(null);
    } catch {
      setError(`ダイス記法を解釈できません: "${n}"（例: 2d6+1）`);
    }
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
        <section className="ptable-panels">
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

          {(() => {
            // 能力値/リソースを持つ“キャラ駒”だけ下のパネルに出す。
            // 画像だけのオブジェクトは盤面上にのみ置く。
            const cards = scene.panels.filter(
              (p) => p.stats.length > 0 || p.resources.length > 0,
            );
            if (cards.length === 0) {
              return (
                <div className="ptable-empty muted">
                  「＋キャラ」で保存済みキャラを、「＋トークン」で NPC/敵を、
                  画像のドロップでオブジェクトを置けます。能力値・技能を
                  クリックすると判定が振れます。
                </div>
              );
            }
            return (
              <div className="ptable-grid">
                {cards.map((p) => (
                  <PlayPanel
                    key={p.id}
                    panel={p}
                    onRoll={rollStat}
                    onResource={changeResource}
                    onRemove={removePanel}
                  />
                ))}
              </div>
            );
          })()}
        </section>

        <aside className="ptable-side">
          <div className="plog" ref={logRef}>
            {scene.log.length === 0 ? (
              <p className="muted" style={{ padding: 8, fontSize: 12 }}>
                ここに判定・チャットのログが流れます。
              </p>
            ) : (
              scene.log.map((ev) => <LogRow key={ev.id} ev={ev} />)
            )}
          </div>

          <div className="pinput">
            <div className="pinput-row">
              <input
                className="input"
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="発言…"
              />
              <button className="btn mini" onClick={sendChat}>
                送信
              </button>
            </div>
            <div className="pinput-row">
              <input
                className="input"
                value={notation}
                onChange={(e) => setNotation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rollFree()}
                placeholder="ダイス記法（例: 2d6+1, 1d100）"
              />
              <button className="btn mini btn-primary" onClick={rollFree}>
                ロール
              </button>
            </div>
          </div>
        </aside>
      </div>

      <BgmPanel
        tracks={scene.bgm?.tracks ?? []}
        open={showBgm}
        onClose={() => setShowBgm(false)}
        onAddTracks={addBgmTracks}
        onRemoveTrack={removeBgmTrack}
      />

      {motion && (
        <DiceMotion roll={motion} onClose={() => setMotion(null)} />
      )}
    </div>
  );
}

/** ログ 1 行のレンダリング(イベント種別で分岐)。 */
function LogRow({ ev }: { ev: PlayEvent }) {
  if (ev.kind === "chat")
    return (
      <p className="logrow">
        <b className="log-actor">{ev.actor}</b>
        <span>{ev.text}</span>
      </p>
    );
  if (ev.kind === "roll") {
    const tone = ev.check ? levelTone(ev.check) : "";
    return (
      <p className="logrow">
        <b className="log-actor">{ev.actor}</b>
        <span className="log-roll">
          {ev.label} → 🎲 [{ev.dice.join(", ")}] = <b>{ev.total}</b>
          {ev.check && (
            <span className={`log-level ${tone}`}> {levelLabel(ev.check)}</span>
          )}
        </span>
      </p>
    );
  }
  if (ev.kind === "resource")
    return (
      <p className="logrow muted">
        <b className="log-actor">{ev.actor}</b>
        <span>
          {ev.label} {ev.delta >= 0 ? `+${ev.delta}` : ev.delta} →{" "}
          {ev.current}
        </span>
      </p>
    );
  if (ev.kind === "panel-add")
    return (
      <p className="logrow muted">
        <span>＋ {ev.panel.name} を卓に追加</span>
      </p>
    );
  if (ev.kind === "panel-remove")
    return (
      <p className="logrow muted">
        <span>− 駒を卓から外した</span>
      </p>
    );
  return (
    <p className="logrow muted">
      <span>{ev.kind === "system" ? ev.text : ""}</span>
    </p>
  );
}

function levelTone(r: CoCCheckResult): string {
  switch (r.level) {
    case "extreme":
      return "crit";
    case "special":
      return "gold";
    case "hard":
    case "regular":
      return "ok";
    case "fumble":
      return "fumble";
    default:
      return "fail";
  }
}

function levelLabel(r: CoCCheckResult): string {
  switch (r.level) {
    case "extreme":
      return "イクストリーム！";
    case "hard":
      return "ハード成功";
    case "regular":
      return "成功";
    case "special":
      return "スペシャル！";
    case "fumble":
      return "ファンブル…";
    default:
      return "失敗";
  }
}
