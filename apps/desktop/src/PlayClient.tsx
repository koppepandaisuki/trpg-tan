import { useEffect, useMemo, useRef, useState } from "react";
import { Users, MessageSquare, StickyNote, Globe, UserPlus } from "lucide-react";
import {
  reduce,
  panelFromSheet,
  panelFromGeneric,
  type PlayScene,
  type Panel,
  type PanelResource,
  type RollEvent,
  type CutIn,
} from "@trpg/core";
import { getLibrary } from "./library";
import { readSheetFromPath, isGenericSheet } from "./storage";
import { DiceMotion } from "./DiceMotion";
import { unlockDiceSound } from "./dice-sound";
import { PlayBoard } from "./PlayBoard";
import { PlayPanel } from "./PlayPanel";
import { LogView } from "./LogView";
import { BoardStatusBar } from "./BoardStatusBar";
import { PortraitLayer } from "./PortraitLayer";
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
  // 卓データ(スナップショット)の受信進捗。null=まだ届いていない / 受信中=チャンク数。
  const [progress, setProgress] = useState<{ received: number; total: number } | null>(
    null,
  );
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

  // 音声(GM から配信される BGM/SE)。BGM は 1 本のループ要素、SE は単発。
  const bgmElRef = useRef<HTMLAudioElement | null>(null);
  const [audioVol, setAudioVol] = useState<number>(() => {
    const v = Number(localStorage.getItem("trpg.client.vol.v1"));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.6;
  });
  const audioVolRef = useRef(audioVol);
  audioVolRef.current = audioVol;
  // 自動再生がブラウザにブロックされたら true(クリックで解除する)。
  const [audioBlocked, setAudioBlocked] = useState(false);
  // 音声の解錠状態。WebView は最初のユーザー操作までメディア再生をブロックする
  // ため、入室後の最初のクリック/キー操作で一度だけ解錠する。
  const audioReadyRef = useRef(false);
  // GM が現在流している BGM(解錠・途中入室のときに再開するため保持)。
  const curBgmRef = useRef<{ src: string | null }>({ src: null });

  const roomRef = useRef<Room | null>(null);

  // 接続 → hello → snapshot 待ち。アンマウントで切断。
  useEffect(() => {
    let alive = true;
    let r: Room | null = null;
    let got = false; // スナップショット受領済みか
    let gmSeen = false; // GM の presence を一度でも見たか(離脱検知用)
    let helloTimer: number | undefined;
    void (async () => {
      try {
        r = await connectRoom(code, name);
        if (!alive) {
          r.close();
          return;
        }
        roomRef.current = r;
        r.onPresence((names) => {
          if (!alive) return;
          setMembers(names);
          // GM(presence 名 "GM")が一度居て、その後消えたら卓は閉じられたとみなす。
          // 「終了」を押さず抜けた/アプリを閉じた場合も presence 落ちで検知できる。
          if (names.includes("GM")) gmSeen = true;
          else if (gmSeen) setPhase("closed");
        });
        r.onProgress((p) => alive && setProgress(p));
        r.onMessage((msg) => {
          if (!alive) return;
          if (msg.type === "snapshot") {
            got = true;
            if (helloTimer) window.clearInterval(helloTimer);
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
          } else if (msg.type === "audio") {
            handleAudio(msg.channel, msg.src);
          } else if (msg.type === "closed") {
            setPhase("closed");
          }
        });
        r.send({ type: "hello", from: r.selfId, name });
        setPhase("waiting");
        // snapshot が来るまで hello を再送する。GM が後から共有を開始した場合や、
        // 最初の hello が取りこぼされた場合に「卓データ待ち」で固まらないため。
        // ~2.5s 間隔 × 最大 ~30s。
        let tries = 0;
        helloTimer = window.setInterval(() => {
          if (got || !alive || tries >= 12) {
            window.clearInterval(helloTimer);
            return;
          }
          tries += 1;
          roomRef.current?.send({ type: "hello", from: r!.selfId, name });
        }, 2500);
      } catch (e) {
        if (alive) {
          setNetError(String(e));
          setPhase("error");
        }
      }
    })();
    return () => {
      alive = false;
      if (helloTimer) window.clearInterval(helloTimer);
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

  /** GM から配信された音声を再生する(BGM=ループ / SE=単発)。 */
  function handleAudio(channel: "bgm" | "se", src: string | null) {
    if (channel === "bgm") {
      curBgmRef.current = { src };
      if (!src) {
        bgmElRef.current?.pause();
        return;
      }
      if (!audioReadyRef.current) {
        // 未解錠: 最初のクリックで鳴らすので、合図だけ出して保持しておく。
        setAudioBlocked(true);
        return;
      }
      playBgm();
    } else {
      // SE は単発。未解錠なら鳴らせないので捨てる(BGM と違い状態を持たない)。
      if (!src) return;
      if (!audioReadyRef.current) {
        setAudioBlocked(true);
        return;
      }
      const a = new Audio(src);
      a.volume = audioVolRef.current;
      a.play().catch(() => setAudioBlocked(true));
    }
  }

  /** 現在の BGM を冪等に再生する(同じ曲が鳴っていれば頭出しせず何もしない)。 */
  function playBgm() {
    const src = curBgmRef.current.src;
    if (!src) return;
    let a = bgmElRef.current;
    if (!a) {
      a = new Audio();
      a.loop = true;
      a.preload = "auto"; // 先読みして途切れにくくする
      bgmElRef.current = a;
    }
    a.loop = true;
    a.volume = audioVolRef.current;
    if (a.src === src && !a.paused) return; // 既に同じ曲を再生中
    if (a.src !== src) a.src = src;
    a.play().then(
      () => setAudioBlocked(false),
      () => setAudioBlocked(true),
    );
  }

  /** ユーザー操作で音声を解錠する(最初の一回だけ。以後は自由に再生できる)。 */
  function primeAudio() {
    if (audioReadyRef.current) return;
    audioReadyRef.current = true;
    setAudioBlocked(false);
    unlockDiceSound(); // ダイス効果音(Web Audio)も同時に解錠する
    playBgm(); // GM が既に流している BGM があれば再開する
  }

  // 音量変更を再生中の BGM にも反映し、端末に保存。
  useEffect(() => {
    if (bgmElRef.current) bgmElRef.current.volume = audioVol;
    localStorage.setItem("trpg.client.vol.v1", String(audioVol));
  }, [audioVol]);

  // 退室/アンマウントで BGM を止める。
  useEffect(() => {
    return () => {
      bgmElRef.current?.pause();
    };
  }, []);

  // 入室後、最初のユーザー操作(クリック/キー/タッチ)で音声を一度だけ解錠する。
  // WebView は操作前の自動再生をブロックするため。一度解錠すれば以後は自由に鳴る。
  useEffect(() => {
    const onFirst = () => {
      primeAudio();
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
      window.removeEventListener("touchstart", onFirst);
    };
    window.addEventListener("pointerdown", onFirst);
    window.addEventListener("keydown", onFirst);
    window.addEventListener("touchstart", onFirst);
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
      window.removeEventListener("touchstart", onFirst);
    };
    // primeAudio はマウント時のみ登録すればよい(冪等)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 「音声を有効化」ボタン: ユーザー操作として音声を解錠する。 */
  function unblockAudio() {
    primeAudio();
  }

  const cards = useMemo(
    () =>
      (scene?.panels ?? [])
        .filter((p) => p.stats.length > 0 || p.resources.length > 0)
        .sort((a, b) => (b.speed ?? -Infinity) - (a.speed ?? -Infinity)),
    [scene],
  );
  const playerCards = cards.filter((p) => !p.hidden);
  // 自分が追加したキャラ(owner=自分の表示名)。サイドバーで操作できるのはこれだけ。
  const myCards = playerCards.filter((p) => p.owner === name);

  // 自分のローカルライブラリ(この端末に保存したキャラ)。
  const [lib] = useState(() => getLibrary());
  const [picking, setPicking] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  /** 自分のキャラを登場させる(GM へ intent を送り、GM が owner を刻んで配信)。 */
  async function addMyCharacter(charId: string) {
    const entry = lib.find((c) => c.id === charId);
    if (!entry) return;
    setAddErr(null);
    try {
      const sheet = await readSheetFromPath(entry.path);
      const base = isGenericSheet(sheet)
        ? panelFromGeneric({ id: crypto.randomUUID(), sheet })
        : panelFromSheet({ id: crypto.randomUUID(), sheet });
      sendIntent({ kind: "add-char", panel: base });
      setPicking(false);
    } catch (e) {
      setAddErr(`キャラを読み込めませんでした: ${String(e)}`);
    }
  }

  // 発言者は自分のキャラに限定。未選択/無効なら先頭の自キャラに合わせる。
  const myIds = myCards.map((p) => p.id).join(",");
  useEffect(() => {
    if (myCards.length > 0 && !myCards.some((p) => p.id === compose.speakerId)) {
      setCompose((c) => ({ ...c, speakerId: myCards[0].id }));
    }
    // myIds で myCards の変化を検知(配列参照は毎回変わるため)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myIds, compose.speakerId]);

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
          {phase === "waiting" &&
            (progress ? (
              <div className="pclient-wait">
                <p>
                  📦 卓データを受信中…{" "}
                  <b>{Math.round((progress.received / progress.total) * 100)}%</b>
                </p>
                <div className="pclient-bar">
                  <div
                    className="pclient-bar-fill"
                    style={{
                      width: `${Math.round(
                        (progress.received / progress.total) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="muted" style={{ fontSize: 11 }}>
                  {progress.received} / {progress.total} ブロック
                </p>
              </div>
            ) : (
              <div className="pclient-wait">
                <p>🪑 入室しました。GM の卓データを待っています…</p>
                <div className="pclient-bar indet">
                  <div className="pclient-bar-fill" />
                </div>
                <p className="muted" style={{ fontSize: 11 }}>
                  GM が「共有」を開始すると自動で受信を始めます。
                </p>
              </div>
            ))}
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
          {audioBlocked && (
            <button
              className="btn mini pclient-audio-on"
              onClick={unblockAudio}
              title="自動再生がブロックされました。クリックで音声を有効化します"
            >
              🔊 音声を有効化
            </button>
          )}
          <span className="pclient-vol" title="音量（BGM / 効果音）">
            🔊
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={audioVol}
              onChange={(e) => setAudioVol(Number(e.target.value))}
            />
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
            <PortraitLayer log={scene.log} panels={scene.panels} playId={scene.id} />
            <BoardStatusBar cards={playerCards} turn={scene.turn} />
          </div>
        </main>

        {/* 左ドロワー: 自分のキャラクター(操作できるのは自分が追加した分だけ) */}
        <aside className={`pdrawer left ${leftOpen ? "open" : ""}`}>
          <div className="pdrawer-head ibtn"><Users size={14} /> マイキャラクター</div>
          <div className="pdrawer-body ss-chars">
            {/* 自分のキャラを登場させる(この端末のライブラリから) */}
            {picking ? (
              <div className="pclient-addchar">
                {lib.length === 0 ? (
                  <p className="pside-empty muted">
                    この端末に保存されたキャラがありません。先にキャラシを作成/保存して
                    ください。
                  </p>
                ) : (
                  <select
                    className="input"
                    defaultValue=""
                    onChange={(e) => e.target.value && void addMyCharacter(e.target.value)}
                  >
                    <option value="" disabled>
                      キャラを選んで登場…
                    </option>
                    {lib.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {addErr && (
                  <p className="tag fail" style={{ fontSize: 11 }}>
                    {addErr}
                  </p>
                )}
                <button className="btn mini" onClick={() => setPicking(false)}>
                  閉じる
                </button>
              </div>
            ) : (
              <button
                className="btn mini btn-primary ibtn"
                style={{ width: "100%" }}
                onClick={() => setPicking(true)}
              >
                <UserPlus size={14} /> 自分のキャラを追加
              </button>
            )}
            {myCards.length === 0 ? (
              <p className="pside-empty muted">
                まだ自分のキャラがいません。「自分のキャラを追加」から登場させると、
                ここからダイスやチャットパレットを操作できます。
              </p>
            ) : (
              myCards.map((p) => (
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
                        speakers={myCards.map((p) => ({
                          id: p.id,
                          name: p.name,
                        }))}
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
                        onQuickRoll={(expr) => handleSend(compose.speakerId, expr)}
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
