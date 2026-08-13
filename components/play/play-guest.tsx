"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  ClipboardPaste,
  Loader2,
  Users,
  Volume2,
  WifiOff,
} from "lucide-react";
import {
  reduce,
  parseCcfoliaCharacter,
  type CutIn,
  type Panel,
  type PlayScene,
} from "@trpg/core";
import { Button } from "@/components/ui/button";
import { PlayBoard } from "./play-board";
import { PlayLog } from "./play-log";
import { PlayPanelCard } from "./play-panel-card";
import { PlayComposer } from "./play-composer";
import { PlayMemo } from "./play-memo";
import { PlayReplayButton } from "./play-replay-button";
import { CutInOverlay, TelopOverlay } from "./play-fx";
import { usePlayAudio } from "./use-play-audio";
import { connectRoom, type Room } from "@/lib/play/net";

/**
 * 卓の参加者ビュー(Web 版)。
 *
 * GM が権威なので、ここでは自分で状態を作らない:
 *   - `state`(スナップショット)を受けたら丸ごと置き換える(rev が進んだ時のみ)
 *   - `event`(チャット/ダイス)はログ即時表示のためだけに reduce する
 *   - 自分の操作は intent として GM へ送り、返ってきた state で確定する
 */
export function PlayGuest({ code }: { code: string }) {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [scene, setScene] = useState<PlayScene | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [progress, setProgress] = useState<{
    received: number;
    total: number;
  } | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [input, setInput] = useState("");
  const [speakerId, setSpeakerId] = useState("GM");
  const inputRef = useRef<HTMLInputElement>(null);
  const revRef = useRef(-1);
  const myName = useRef("");

  // 演出(GM から配信される)。
  const [cutin, setCutin] = useState<CutIn | null>(null);
  const [telop, setTelop] = useState<string | null>(null);
  const audio = usePlayAudio();
  // cutin は id だけ届くので、受信ハンドラ(接続時に固定される closure)から
  // 最新の scene を読むための ref。
  const sceneRef = useRef<PlayScene | null>(null);
  sceneRef.current = scene;

  // 入室名は前回のものを引き継ぐ(卓に入り直すたびに打ち直さなくてよい)。
  useEffect(() => {
    setName(localStorage.getItem("redice.play.name") ?? "");
  }, []);

  useEffect(() => {
    return () => {
      room?.close();
    };
  }, [room]);

  async function join() {
    const nm = name.trim();
    if (!nm) return;
    setConnecting(true);
    setError(null);
    try {
      localStorage.setItem("redice.play.name", nm);
      myName.current = nm;
      const r = await connectRoom(code, nm);
      r.onMessage((msg) => {
        if (msg.type === "state") {
          // 順序逆転で古い state が新しいものを潰さないよう rev で守る。
          if (msg.rev <= revRef.current) return;
          revRef.current = msg.rev;
          setScene(msg.scene);
        } else if (msg.type === "event") {
          // ログの即時表示(状態の正は次の state)。
          setScene((s) => (s ? reduce(s, msg.ev) : s));
        } else if (msg.type === "memo") {
          // デスクトップ版 GM は共有メモを memo で単独配信する。
          setScene((s) => (s ? { ...s, sharedMemos: msg.memos } : s));
        } else if (msg.type === "cutin") {
          // id だけ届くので、自分が持っている scene から画像を引く。
          // ハンドラは接続時の closure なので最新 scene は ref から読む。
          const c = sceneRef.current?.cutins?.find((x) => x.id === msg.cutinId);
          if (c) setCutin(c);
        } else if (msg.type === "telop") {
          setTelop(msg.text);
        } else if (msg.type === "audio") {
          audio.handleAudio(msg.channel, msg.src);
        } else if (msg.type === "closed") {
          setClosed(true);
        }
      });
      r.onLive((live) => {
        if (live.kind === "drag") {
          setScene((s) =>
            s
              ? {
                  ...s,
                  panels: s.panels.map((p) =>
                    p.id === live.panelId
                      ? { ...p, pos: { x: live.x, y: live.y } }
                      : p,
                  ),
                }
              : s,
          );
        }
      });
      r.onPresence(setParticipants);
      r.onProgress(setProgress);
      setRoom(r);
      setJoined(true);
      // 参加を知らせる → GM が現在状態を送り返してくれる。
      await r.send({ type: "hello", from: r.selfId, name: nm });
    } catch (e) {
      setError(e instanceof Error ? e.message : "参加できませんでした");
    } finally {
      setConnecting(false);
    }
  }

  /** 自分の駒か(GM が owner に自分の入室名を刻む)。 */
  const isMine = useCallback(
    (p: Panel) => p.owner === myName.current,
    [],
  );

  function send(text: string) {
    room?.send({
      type: "intent",
      from: room.selfId,
      intent: {
        kind: "send",
        speakerId,
        raw: text,
        channel: "main",
        secret: false,
        visibleTo: [],
      },
    });
  }

  function addMyCharacter() {
    const text = prompt(
      "ココフォリアの「コマをコピー」した内容を貼り付けてください",
    );
    if (!text?.trim() || !room) return;
    const panel = parseCcfoliaCharacter(text, () => crypto.randomUUID());
    if (!panel) {
      setError("ココフォリア駒の JSON ではないようです");
      return;
    }
    void room.send({
      type: "intent",
      from: room.selfId,
      intent: {
        kind: "add-char",
        panel: { ...panel, pos: { x: 0.5, y: 0.6 } },
      },
    });
  }

  /* ===== 入室前 ===== */
  if (!joined) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <Link
          href={"/play" as Route}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          ロビー
        </Link>
        <div className="rounded-xl border border-border bg-background p-5">
          <h1 className="text-lg font-semibold tracking-tight">卓に参加する</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            参加コード{" "}
            <span className="font-mono font-bold tracking-[0.2em] text-foreground">
              {code}
            </span>{" "}
            の卓に入ります。表示名を入れてください。
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void join()}
              maxLength={20}
              autoFocus
              placeholder="あなたの表示名"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              onClick={() => void join()}
              disabled={!name.trim() || connecting}
            >
              {connecting ? "接続中…" : "参加"}
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    );
  }

  /* ===== 卓データ待ち ===== */
  if (!scene) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <p>卓のデータを待っています…</p>
        {progress && (
          <p className="text-xs">
            受信中 {progress.received} / {progress.total}
          </p>
        )}
      </div>
    );
  }

  const myPanels = scene.panels.filter(isMine);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
          {scene.title}
        </h1>
        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" aria-hidden />
          {participants.length} 人
        </span>
        <button
          onClick={addMyCharacter}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs transition hover:bg-muted"
        >
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
          自分のキャラを出す
        </button>
        <PlayReplayButton
          scene={scene}
          isGm={false}
          myPanelIds={myPanels.map((p) => p.id)}
        />
        <label
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1"
          title="自分に聞こえる音量(この端末だけ)"
        >
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={audio.volume}
            onChange={(e) => audio.setVolume(Number(e.target.value))}
            className="h-1 w-20 accent-primary"
            aria-label="音量"
          />
        </label>
      </div>

      {/* ブラウザは操作前の自動再生を止めるので、一度クリックしてもらう。 */}
      {audio.blocked && (
        <p className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Volume2 className="h-4 w-4" aria-hidden />
          音が止まっています。画面のどこかを一度クリックすると鳴ります。
        </p>
      )}

      {closed && (
        <p className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <WifiOff className="h-4 w-4" aria-hidden />
          GM が卓を閉じました。
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-2">
          <PlayBoard
            board={
              scene.scenes?.find((s) => s.id === scene.activeSceneId)?.board ??
              scene.board
            }
            panels={scene.panels}
            canDrag={isMine}
            liveDrag={(panelId, x, y) =>
              room?.sendLive({ kind: "drag", panelId, x, y })
            }
            onMove={(panelId, x, y) =>
              room?.send({
                type: "intent",
                from: room.selfId,
                intent: { kind: "move", panelId, x, y },
              })
            }
          />

          <div className="flex h-[320px] flex-col gap-2">
            <PlayLog
              log={scene.log}
              isGm={false}
              myPanelIds={myPanels.map((p) => p.id)}
            />
            <PlayComposer
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSend={send}
              speakers={myPanels}
              speakerId={speakerId}
              onSpeakerChange={setSpeakerId}
              selfLabel={`${myName.current}(自分)`}
              secret={false}
              onSecretChange={() => {}}
              canSecret={false}
              disabled={closed}
            />
          </div>
        </div>

        <aside className="space-y-2">
          <PlayMemo
            memos={scene.sharedMemos ?? []}
            disabled={closed}
            onChange={(memos) => {
              // 自分の画面には即反映(相手の確定を待たない)。正は GM の state。
              setScene((s) => (s ? { ...s, sharedMemos: memos } : s));
              room?.send({
                type: "intent",
                from: room.selfId,
                intent: { kind: "memo", memos },
              });
            }}
          />

          <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">
            キャラクター({scene.panels.length})
          </h2>
          <div className="space-y-2">
            {scene.panels.map((p) => (
              <PlayPanelCard
                key={p.id}
                panel={p}
                canControl={isMine(p)}
                onFill={(t) => {
                  setInput(t);
                  inputRef.current?.focus();
                }}
                onSend={(t) => {
                  setSpeakerId(p.id);
                  room?.send({
                    type: "intent",
                    from: room.selfId,
                    intent: {
                      kind: "send",
                      speakerId: p.id,
                      raw: t,
                      channel: "main",
                      secret: false,
                      visibleTo: [],
                    },
                  });
                }}
                onResource={(panel, r, delta) =>
                  room?.send({
                    type: "intent",
                    from: room.selfId,
                    intent: {
                      kind: "resource",
                      panelId: panel.id,
                      resourceKey: r.key,
                      delta,
                    },
                  })
                }
                onRemove={
                  isMine(p)
                    ? (panel) => {
                        if (!confirm(`「${panel.name}」を片付けますか？`)) return;
                        room?.send({
                          type: "intent",
                          from: room.selfId,
                          intent: { kind: "remove-char", panelId: panel.id },
                        });
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </aside>
      </div>

      {/* 演出オーバーレイ(非ブロッキング・自動で消える) */}
      {cutin && <CutInOverlay cutin={cutin} onDone={() => setCutin(null)} />}
      {telop && <TelopOverlay text={telop} onDone={() => setTelop(null)} />}
    </div>
  );
}
