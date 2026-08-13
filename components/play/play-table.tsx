"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  Grid3x3,
  ImagePlus,
  Plus,
  ClipboardPaste,
  Share2,
  Check,
  Users,
  Loader2,
} from "lucide-react";
import {
  reduce,
  makeTokenPanel,
  panelAddEvent,
  panelRemoveEvent,
  panelMoveEvent,
  panelUpdateEvent,
  resourceEvent,
  boardSetEvent,
  sceneAddEvent,
  sceneSelectEvent,
  sceneRenameEvent,
  sceneRemoveEvent,
  parseCcfoliaCharacter,
  type CutIn,
  type Panel,
  type PanelResource,
  type PlayEvent,
  type PlayScene,
} from "@trpg/core";
import { Button } from "@/components/ui/button";
import { PlayBoard } from "./play-board";
import { PlayLog } from "./play-log";
import { PlayPanelCard } from "./play-panel-card";
import { PlayComposer } from "./play-composer";
import { PlaySceneBar } from "./play-scene-bar";
import { PlayMemo } from "./play-memo";
import { PlayReplayButton } from "./play-replay-button";
import { PlayFxBar } from "./play-fx-bar";
import { CutInOverlay, TelopOverlay } from "./play-fx";
import { usePlayAudio } from "./use-play-audio";
import { savePlayScene } from "@/lib/play/store";
import { uploadPlayImage } from "@/lib/play/media";
import { resolveInputToEvent, newEventCtx } from "@/lib/play/roll";
import { connectRoom, makeRoomCode, type Room, type NetIntent } from "@/lib/play/net";

/**
 * 卓本体(GM ビュー・Web 版)。
 *
 * 状態は PlayScene ひとつ。操作はすべて PlayEvent にして `reduce` に通す
 * (デスクトップ版とまったく同じイベントソーシング)。確定した状態は
 *   - play_sessions へオートセーブ(自分の卓の保存)
 *   - Realtime へ state 配信(参加者の画面へ反映)
 * の 2 方向へ流す。参加者からの操作は intent として受け、ここで検証してから
 * 正規イベント化する(乱数は GM 側だけで消費 = 全員の出目が一致)。
 */
export function PlayTable({ initialScene }: { initialScene: PlayScene }) {
  const [scene, setScene] = useState<PlayScene>(initialScene);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [speakerId, setSpeakerId] = useState("GM");
  const [secret, setSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // 演出(自分の画面にも出す。参加者へは cutin/telop/audio で配信)。
  const [cutin, setCutin] = useState<CutIn | null>(null);
  const [telop, setTelop] = useState<string | null>(null);
  const [bgmName, setBgmName] = useState<string | null>(null);
  const audio = usePlayAudio();
  // 途中入室した参加者へ現在の BGM を配り直すために覚えておく。
  const curBgmRef = useRef<string | null>(null);

  // 公開(参加募集)状態。
  const [room, setRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // 最新 scene を参照するための ref(Realtime のコールバックから読む)。
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const revRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ===== オートセーブ(変更が落ち着いたら保存) ===== */
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSaving(true);
      savePlayScene(scene)
        .catch((e) =>
          setError(e instanceof Error ? e.message : "保存に失敗しました"),
        )
        .finally(() => setSaving(false));
    }, 1200);
    return () => window.clearTimeout(saveTimer.current);
  }, [scene]);

  /* ===== 参加者へ state を配信(変更のたび) ===== */
  useEffect(() => {
    if (!room) return;
    revRef.current += 1;
    // 秘匿駒は参加者に送らない(GM の画面にだけ薄く出る)。
    const shared: PlayScene = {
      ...scene,
      panels: scene.panels.filter((p) => !p.hidden),
    };
    void room.send({ type: "state", rev: revRef.current, scene: shared });
  }, [scene, room]);

  /* ===== 退出時に接続を閉じる ===== */
  useEffect(() => {
    return () => {
      room?.close();
    };
  }, [room]);

  /** イベントを確定 → 状態更新 + 参加者へ即時通知(ログ/演出用)。 */
  const dispatch = useCallback(
    (ev: PlayEvent) => {
      setScene((s) => reduce(s, ev));
      if (ev.kind === "chat" || ev.kind === "roll") {
        void room?.send({ type: "event", ev });
      }
    },
    [room],
  );

  /* ===== 参加者からの intent を処理(GM が権威) ===== */
  const handleIntent = useCallback(
    (from: string, intent: NetIntent) => {
      const cur = sceneRef.current;
      switch (intent.kind) {
        case "send": {
          const ev = resolveInputToEvent({
            ctx: newEventCtx(),
            scene: cur,
            speakerId: intent.speakerId,
            // 参加者が「自分の名前」で喋る場合は駒が無いので as で補う。
            as: cur.panels.some((p) => p.id === intent.speakerId)
              ? undefined
              : from,
            raw: intent.raw,
            channel: intent.channel,
            color: intent.color,
            secret: intent.secret,
            visibleTo: intent.visibleTo,
          });
          if (ev) dispatch(ev);
          break;
        }
        case "resource": {
          const p = cur.panels.find((x) => x.id === intent.panelId);
          if (!p) break;
          // 自分の駒のみ(owner 未設定 = GM 所有は参加者から触らせない)。
          if (p.owner !== from) break;
          const res = p.resources.find((r) => r.key === intent.resourceKey);
          if (!res) break;
          dispatch(
            resourceEvent(newEventCtx(), p.name, p, res, intent.delta),
          );
          break;
        }
        case "move": {
          const p = cur.panels.find((x) => x.id === intent.panelId);
          if (!p || p.owner !== from || p.locked) break;
          dispatch(
            panelMoveEvent(newEventCtx(), p.id, intent.x, intent.y),
          );
          break;
        }
        case "add-char": {
          // 参加者が登場させた駒には owner を刻む(以後その人だけが操作可)。
          dispatch(
            panelAddEvent(newEventCtx(), {
              ...intent.panel,
              owner: from,
            }),
          );
          break;
        }
        case "remove-char": {
          const p = cur.panels.find((x) => x.id === intent.panelId);
          if (!p || p.owner !== from) break;
          dispatch(panelRemoveEvent(newEventCtx(), p.id));
          break;
        }
        case "claim-char": {
          const p = cur.panels.find((x) => x.id === intent.panelId);
          if (!p) break;
          dispatch(panelUpdateEvent(newEventCtx(), p.id, { owner: from }));
          break;
        }
        case "panel-update": {
          const p = cur.panels.find((x) => x.id === intent.panelId);
          if (!p || p.owner !== from) break;
          dispatch(
            panelUpdateEvent(newEventCtx(), p.id, intent.patch),
          );
          break;
        }
        case "memo": {
          // 共有メモは卓の覚書なので全員が編集できる(駒のような所有者検証はしない)。
          // イベントソーシング対象外なので state を直接置き換える。
          // 配信は scene 変更をトリガーにした state 配信が拾う。
          setScene((s) => ({ ...s, sharedMemos: intent.memos }));
          break;
        }
        default:
          break;
      }
    },
    [dispatch],
  );

  /** 参加募集を開始(参加コードを発行してルームを開く)。 */
  async function openRoom() {
    setBusy("卓を公開しています…");
    setError(null);
    try {
      const code = makeRoomCode();
      const r = await connectRoom(code, "GM");
      r.onMessage((msg) => {
        if (msg.type === "intent") handleIntent(msg.from, msg.intent);
        // hello を受けたら現在状態を送って参加者を追いつかせる。
        if (msg.type === "hello") {
          revRef.current += 1;
          void r.send({
            type: "state",
            rev: revRef.current,
            scene: {
              ...sceneRef.current,
              panels: sceneRef.current.panels.filter((p) => !p.hidden),
            },
          });
          // 途中入室でも今かかっている曲が揃うように BGM を配り直す。
          if (curBgmRef.current) {
            void r.send({
              type: "audio",
              channel: "bgm",
              src: curBgmRef.current,
              loop: true,
            });
          }
        }
      });
      r.onLive((live) => {
        // ドラッグ中の座標(確定は move intent)。GM 画面にも即時反映。
        if (live.kind === "drag") {
          setScene((s) => ({
            ...s,
            panels: s.panels.map((p) =>
              p.id === live.panelId ? { ...p, pos: { x: live.x, y: live.y } } : p,
            ),
          }));
        }
      });
      r.onPresence((names) => setParticipants(names.filter((n) => n !== "GM")));
      setRoom(r);
      setRoomCode(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "卓を公開できませんでした");
    } finally {
      setBusy(null);
    }
  }

  function closeRoom() {
    void room?.send({ type: "closed" });
    room?.close();
    setRoom(null);
    setRoomCode(null);
    setParticipants([]);
  }

  /* ===== 演出(GM が発火 → 自分の画面 + 参加者へ) ===== */

  /** BGM を差し替える / 止める(url=null で停止)。 */
  function setBgm(url: string | null, name: string | null) {
    curBgmRef.current = url;
    setBgmName(name);
    audio.handleAudio("bgm", url);
    void room?.send({ type: "audio", channel: "bgm", src: url, loop: true });
  }

  function fireSe(url: string) {
    audio.handleAudio("se", url);
    void room?.send({ type: "audio", channel: "se", src: url });
  }

  function fireCutin(c: CutIn) {
    setCutin(c);
    // id だけ送る。画像は参加者が自分の scene.cutins から引く
    // (画像を丸ごと載せると broadcast が詰まり、演出自体が届かなくなる)。
    void room?.send({ type: "cutin", cutinId: c.id });
  }

  function fireTelop(text: string) {
    setTelop(text);
    void room?.send({ type: "telop", text });
  }

  /* ===== GM の操作 ===== */

  function send(text: string) {
    const ev = resolveInputToEvent({
      ctx: newEventCtx(),
      scene,
      speakerId,
      as: speakerId === "GM" ? "GM" : undefined,
      raw: text,
      secret,
      visibleTo: [],
    });
    if (ev) dispatch(ev);
  }

  function fill(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  function addToken() {
    const name = prompt("駒の名前");
    if (!name?.trim()) return;
    const panel = makeTokenPanel({ id: crypto.randomUUID(), name: name.trim() });
    dispatch(
      panelAddEvent(newEventCtx(), {
        ...panel,
        pos: { x: 0.5, y: 0.5 },
      }),
    );
  }

  function pasteCcfolia() {
    const text = prompt(
      "ココフォリアの「コマをコピー」した内容を貼り付けてください",
    );
    if (!text?.trim()) return;
    const panel = parseCcfoliaCharacter(text, () => crypto.randomUUID());
    if (!panel) {
      setError("ココフォリア駒の JSON ではないようです");
      return;
    }
    dispatch(
      panelAddEvent(newEventCtx(), { ...panel, pos: { x: 0.5, y: 0.5 } }),
    );
  }

  async function setBackground(file: File | undefined) {
    if (!file) return;
    setBusy("背景をアップロードしています…");
    setError(null);
    try {
      const url = await uploadPlayImage(file);
      dispatch(boardSetEvent(newEventCtx(), { image: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "背景を設定できませんでした");
    } finally {
      setBusy(null);
    }
  }

  const board = scene.scenes?.find((s) => s.id === scene.activeSceneId)?.board ??
    scene.board;

  return (
    <div className="space-y-3">
      {/* ヘッダー行 */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={"/play" as Route}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          ロビー
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
          {scene.title}
        </h1>
        {saving && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            保存中
          </span>
        )}
        {roomCode ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
              <Users className="h-3 w-3" aria-hidden />
              {participants.length} 人参加中
            </span>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(roomCode);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
              title="参加コードをコピー"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-sm font-bold tracking-[0.2em] transition hover:border-primary/40"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              ) : (
                <Share2 className="h-3.5 w-3.5" aria-hidden />
              )}
              {roomCode}
            </button>
            <Button variant="outline" size="sm" onClick={closeRoom}>
              公開をやめる
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => void openRoom()} disabled={!!busy}>
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            みんなで遊ぶ
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {busy && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          {busy}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 左: 盤面 + 操作 */}
        <div className="min-w-0 space-y-2">
          {/* シーン(場面ごとに盤面を持ち替える。駒は卓に属したまま) */}
          <PlaySceneBar
            scenes={scene.scenes ?? []}
            activeId={scene.activeSceneId}
            onSelect={(id) => dispatch(sceneSelectEvent(newEventCtx(), id))}
            onAdd={(name) =>
              dispatch(
                sceneAddEvent(newEventCtx(), {
                  id: crypto.randomUUID(),
                  name,
                }),
              )
            }
            onRename={(id, name) =>
              dispatch(sceneRenameEvent(newEventCtx(), id, name))
            }
            onRemove={(id) => dispatch(sceneRemoveEvent(newEventCtx(), id))}
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs transition hover:bg-muted">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              背景を設定
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void setBackground(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              onClick={() =>
                dispatch(
                  boardSetEvent(newEventCtx(), {
                    grid: !(board?.grid !== false),
                  }),
                )
              }
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs transition hover:bg-muted"
            >
              <Grid3x3 className="h-3.5 w-3.5" aria-hidden />
              グリッド: {board?.grid !== false ? "ON" : "OFF"}
            </button>
            <button
              onClick={addToken}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs transition hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              駒を追加
            </button>
            <button
              onClick={pasteCcfolia}
              title="ココフォリアの「コマをコピー」した内容から駒を作る"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs transition hover:bg-muted"
            >
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
              コマ貼付
            </button>
            <PlayReplayButton scene={scene} isGm />
          </div>

          <PlayBoard
            board={board}
            panels={scene.panels}
            canDrag={() => true}
            selectedId={selectedId}
            onSelect={setSelectedId}
            liveDrag={(panelId, x, y) =>
              room?.sendLive({ kind: "drag", panelId, x, y })
            }
            onMove={(panelId, x, y) =>
              dispatch(panelMoveEvent(newEventCtx(), panelId, x, y))
            }
          />

          {/* ログ + 入力 */}
          <div className="flex h-[320px] flex-col gap-2">
            <PlayLog log={scene.log} isGm />
            <PlayComposer
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSend={send}
              speakers={scene.panels}
              speakerId={speakerId}
              onSpeakerChange={setSpeakerId}
              selfLabel="GM(地の声)"
              secret={secret}
              onSecretChange={setSecret}
              canSecret
            />
          </div>
        </div>

        {/* 右: 演出 + 共有メモ + 駒一覧 */}
        <aside className="space-y-2">
          <PlayFxBar
            cutins={scene.cutins ?? []}
            onCutinsChange={(cutins) => setScene((s) => ({ ...s, cutins }))}
            bgmName={bgmName}
            onBgm={setBgm}
            onSe={fireSe}
            onFireCutin={fireCutin}
            onTelop={fireTelop}
            volume={audio.volume}
            onVolumeChange={audio.setVolume}
          />

          <PlayMemo
            memos={scene.sharedMemos ?? []}
            onChange={(memos) =>
              // イベントではなく state に直接持つ(desktop 版と同じ扱い)。
              // 参加者へは scene 変更に反応する state 配信で届く。
              setScene((s) => ({ ...s, sharedMemos: memos }))
            }
          />

          <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">
            キャラクター({scene.panels.length})
          </h2>
          {scene.panels.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              「駒を追加」または「コマ貼付」で
              <br />
              キャラクターを登場させましょう。
            </p>
          ) : (
            <div className="space-y-2">
              {scene.panels.map((p) => (
                <PlayPanelCard
                  key={p.id}
                  panel={p}
                  canControl
                  onFill={fill}
                  onSend={(t) => {
                    setSpeakerId(p.id);
                    const ev = resolveInputToEvent({
                      ctx: newEventCtx(),
                      scene,
                      speakerId: p.id,
                      raw: t,
                      secret,
                    });
                    if (ev) dispatch(ev);
                  }}
                  onResource={(panel, r, delta) =>
                    dispatch(
                      resourceEvent(newEventCtx(), panel.name, panel, r, delta),
                    )
                  }
                  onToggleHidden={(panel) =>
                    dispatch(
                      panelUpdateEvent(newEventCtx(), panel.id, {
                        hidden: !panel.hidden,
                      }),
                    )
                  }
                  onRemove={(panel) => {
                    if (!confirm(`「${panel.name}」を卓から外しますか？`)) return;
                    dispatch(panelRemoveEvent(newEventCtx(), panel.id));
                  }}
                />
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* 演出オーバーレイ(非ブロッキング・自動で消える) */}
      {cutin && (
        <CutInOverlay cutin={cutin} onDone={() => setCutin(null)} />
      )}
      {telop && <TelopOverlay text={telop} onDone={() => setTelop(null)} />}
    </div>
  );
}

/** 型の再輸出(page 側で使う)。 */
export type { Panel, PanelResource };
