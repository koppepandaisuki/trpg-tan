import { useEffect, useMemo, useRef, useState } from "react";
import { Users, MessageSquare, StickyNote, Globe } from "lucide-react";
import {
  reduce,
  type PlayScene,
  type Panel,
  type PanelResource,
  type RollEvent,
  type CutIn,
} from "@trpg/core";
import { DiceMotion } from "./DiceMotion";
import { PlayBoard } from "./PlayBoard";
import { PlayPanel } from "./PlayPanel";
import { LogView } from "./LogView";
import { BoardStatusBar } from "./BoardStatusBar";
import { MemoPanel } from "./MemoPanel";
import { SideStack } from "./SideStack";
import { CutInOverlay } from "./CutIn";
import { TelopOverlay } from "./TextStock";
import { connectRoom, type NetIntent, type Room } from "./net";

type Phase = "connecting" | "waiting" | "ready" | "closed" | "error";

/**
 * ネットワーク参加クライアント(参加者ビュー固定)。
 *  - GM のスナップショット + イベント列を core の reduce で再構成する
 *  - 操作(発言/ダイス/リソース/移動)は intent として GM へ送る
 *    (乱数は GM 側で消費されるので、出目は全員で一致する)
 *  - 没入モード: 盤面フルスクリーン + [ / ] で左右ドロワー開閉
 */
export function PlayClient({
  code,
  name,
  onClose,
}: {
  code: string;
  name: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("connecting");
  const [netError, setNetError] = useState<string | null>(null);
  const [scene, setScene] = useState<PlayScene | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [motion, setMotion] = useState<RollEvent | null>(null);
  const [cutin, setCutin] = useState<CutIn | null>(null);
  const [telop, setTelop] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);

  // チャット入力(PlayTable と同じ流儀)。
  const [compose, setCompose] = useState<{ speakerId: string; text: string }>({
    speakerId: "GM",
    text: "",
  });
  const [secret, setSecret] = useState(false);
  const [visibleTo, setVisibleTo] = useState<string[]>([]);
  const [channel, setChannel] = useState("main");
  const inputRef = useRef<HTMLInputElement>(null);

  const roomRef = useRef<Room | null>(null);

  // 接続 → hello → snapshot 待ち。アンマウントで切断。
  useEffect(() => {
    let alive = true;
    let r: Room | null = null;
    void (async () => {
      try {
        r = await connectRoom(code, name);
        if (!alive) {
          r.close();
          return;
        }
        roomRef.current = r;
        r.onPresence((names) => alive && setMembers(names));
        r.onMessage((msg) => {
          if (!alive) return;
          if (msg.type === "snapshot") {
            setScene(msg.scene);
            setPhase("ready");
          } else if (msg.type === "event") {
            setScene((s) => (s ? reduce(s, msg.ev) : s));
            if (msg.ev.kind === "roll") setMotion(msg.ev);
          } else if (msg.type === "cutin") {
            setCutin(msg.cutin);
          } else if (msg.type === "telop") {
            setTelop(msg.text);
          } else if (msg.type === "memo") {
            setScene((s) => (s ? { ...s, sharedMemo: msg.text } : s));
          } else if (msg.type === "closed") {
            setPhase("closed");
          }
        });
        r.send({ type: "hello", from: r.selfId, name });
        setPhase("waiting");
      } catch (e) {
        if (alive) {
          setNetError(String(e));
          setPhase("error");
        }
      }
    })();
    return () => {
      alive = false;
      roomRef.current?.close();
      roomRef.current = null;
      r?.close();
    };
    // 参加コード/名前は入室時に固定。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name]);

  // [ / ] でドロワー開閉(入力中は無効)。
  useEffect(() => {
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
  }, []);

  function sendIntent(intent: NetIntent) {
    const r = roomRef.current;
    if (r) r.send({ type: "intent", from: r.selfId, intent });
  }

  const cards = useMemo(
    () =>
      (scene?.panels ?? [])
        .filter((p) => p.stats.length > 0 || p.resources.length > 0)
        .sort((a, b) => (b.speed ?? -Infinity) - (a.speed ?? -Infinity)),
    [scene],
  );
  const playerCards = cards.filter((p) => !p.hidden);

  /* ===== 操作 → intent ===== */

  function handleSend(speakerId: string, raw: string) {
    sendIntent({
      kind: "send",
      speakerId,
      raw,
      channel,
      secret,
      visibleTo: [...visibleTo],
    });
  }
  function fill(speakerId: string, text: string) {
    setCompose({ speakerId, text });
    inputRef.current?.focus();
  }
  function sendNow(speakerId: string, text: string) {
    handleSend(speakerId, text);
    setCompose((c) => ({ ...c, text: "" }));
  }
  function submitCompose() {
    const t = compose.text.trim();
    if (!t) return;
    handleSend(compose.speakerId, t);
    setCompose((c) => ({ ...c, text: "" }));
  }

  function changeResource(panel: Panel, resource: PanelResource, delta: number) {
    sendIntent({
      kind: "resource",
      panelId: panel.id,
      resourceKey: resource.key,
      delta,
    });
  }

  function movePanel(panelId: string, x: number, y: number) {
    sendIntent({ kind: "move", panelId, x, y });
  }

  function updatePanel(
    id: string,
    patch: {
      name?: string;
      note?: string;
      palette?: string;
      speed?: number;
      portrait?: string | null;
      variants?: { id: string; label: string; image: string }[];
    },
  ) {
    // 参加者が触れるのは名前/メモ/パレット/速さ/差分のみ
    // (hidden/locked などの GM 専用フィールドは UI 側で出ない)。
    sendIntent({
      kind: "panel-update",
      panelId: id,
      patch: {
        name: patch.name,
        note: patch.note,
        palette: patch.palette,
        speed: patch.speed,
        portrait: patch.portrait,
        variants: patch.variants,
      },
    });
  }

  // 共有メモ: 手元へ即反映しつつ、デバウンスして GM へ送る。
  const memoTimer = useRef<number | undefined>(undefined);
  function setSharedMemo(text: string) {
    setScene((s) => (s ? { ...s, sharedMemo: text } : s));
    window.clearTimeout(memoTimer.current);
    memoTimer.current = window.setTimeout(() => {
      sendIntent({ kind: "memo", text });
    }, 600);
  }

  /* ===== 接続前/切断後のステータス画面 ===== */

  if (phase !== "ready" || !scene) {
    return (
      <div className="ptable pclient-status">
        <div className="pclient-card">
          {phase === "connecting" && <p>🌐 接続しています…</p>}
          {phase === "waiting" && (
            <p>🪑 入室しました。GM からの卓データを待っています…</p>
          )}
          {phase === "closed" && <p>👋 GM が共有を終了しました。</p>}
          {phase === "error" && (
            <p className="tag fail">接続できませんでした: {netError}</p>
          )}
          <p className="muted" style={{ fontSize: 12 }}>
            参加コード: <code>{code}</code> / 名前: {name}
          </p>
          <button className="btn mini" onClick={onClose}>
            退出する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ptable">
      <header className="ptable-head">
        <span className="ptable-title-ro">{scene.title || "卓"}</span>
        <div className="ptable-tools">
          <span className="pclient-net ibtn" title={`参加コード ${code}`}>
            <Globe size={13} /> {code}・{members.length}人
          </span>
          <span className="ptable-spacer" />
          <button className="btn mini" onClick={onClose}>
            退出
          </button>
        </div>
      </header>

      <div className="ptable-body2 pbody-player">
        <main className="pmain">
          <div className="pstage">
            <PlayBoard
              board={scene.board}
              panels={scene.panels}
              activeSceneId={scene.activeSceneId}
              playerMode
              onMove={movePanel}
              onSetImage={() => {}}
              onToggleGrid={() => {}}
              onAddImage={() => {}}
              onUpdate={updatePanel}
              onRemove={() => {}}
            />
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
                  onRemove={() => {}}
                  onFill={(text) => fill(p.id, text)}
                  onSend={(text) => sendNow(p.id, text)}
                  onEditPalette={(text) => updatePanel(p.id, { palette: text })}
                  onSpeed={(panel, speed) => updatePanel(panel.id, { speed })}
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
              storageKey={`trpg.play.stack-client.v1::${scene.id}`}
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
                        viewerName={name}
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

      {motion && (
        <DiceMotion
          roll={motion}
          masked={!!motion.secret && !(motion.visibleTo ?? []).includes(name)}
          onClose={() => setMotion(null)}
        />
      )}
      {cutin && <CutInOverlay cutin={cutin} onDone={() => setCutin(null)} />}
      {telop && <TelopOverlay text={telop} onDone={() => setTelop(null)} />}
    </div>
  );
}
