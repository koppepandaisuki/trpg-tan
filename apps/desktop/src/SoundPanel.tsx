import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { BgmTrack } from "@trpg/core";
import { audioUrl, baseName } from "./audio-url";
import {
  getEffectiveBgmVolume,
  getVolumeSettings,
  setVolumeSettings,
  onVolumeChange,
} from "./volume-settings";

/**
 * サウンド・ライブラリ(BGM + SE 統合)。CCFOLIA と同じく音源を 1 つの一覧に
 * まとめ、各トラックを「▶ BGM(ループ)」と「🔔 SE(単発)」の 2 つのボタンで
 * 鳴らせる。BGM は 1 本の <audio> 要素でループ、SE は new Audio() の単発なので、
 * 両者は同時に鳴らせる(BGM を流したまま SE を重ねられる)。
 *
 * 音声は GM のローカルで鳴らし、参加者へは onPlayBgm / onPlaySe 経由で配信する
 * (実体は呼び出し側が Storage URL 化して送る)。トラック一覧は onAddTracks /
 * onRemoveTrack でメイン卓へ送り、.play に保存・同期する。
 *
 * BGM / SE スライダの音量は volume-settings の正本に同期する。設定画面 →
 * SoundPanel、SoundPanel → 設定画面、いずれの方向の変更も即座に反映される。
 */

/** リピートの種類: 1曲(既定) / プレイリスト全体 / なし。 */
type RepeatMode = "one" | "all" | "off";
const REPEAT_LABEL: Record<RepeatMode, string> = {
  one: "🔂 1曲",
  all: "🔁 全曲",
  off: "➡ なし",
};

/** BGM/SE の 2 リストを 1 つの音源一覧に統合(id/path 重複は除く)。 */
export function mergeSounds(
  bgm: BgmTrack[] | undefined,
  se: BgmTrack[] | undefined,
): BgmTrack[] {
  const base = bgm ?? [];
  const extra = (se ?? []).filter(
    (s) => !base.some((b) => b.id === s.id || b.path === s.path),
  );
  return [...base, ...extra];
}

export function SoundPanel({
  tracks,
  onAddTracks,
  onRemoveTrack,
  sceneBgmId,
  onBindScene,
  playSignal,
  onPlayBgm,
  onPlaySe,
}: {
  tracks: BgmTrack[];
  onAddTracks: (tracks: BgmTrack[]) => void;
  onRemoveTrack: (id: string) => void;
  /** 現在のシーンに紐づく BGM(切替で自動再生)。 */
  sceneBgmId?: string | null;
  /** 現在のシーンへの紐付け切替(null で解除)。 */
  onBindScene?: (trackId: string | null) => void;
  /**
   * 外部(アセットのマクロ等)からの BGM 再生指示。nonce が変わるたびに反応し、
   * id のトラックを再生する(id が null/空なら停止)。
   */
  playSignal?: { id: string | null; nonce: number };
  /** BGM 再生状態が変わった(track=開始 / null=停止)。参加者へループ配信。 */
  onPlayBgm?: (track: BgmTrack | null) => void;
  /** SE を単発再生(GM ローカル + 参加者へ単発配信)。 */
  onPlaySe?: (track: BgmTrack) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("one");
  const [error, setError] = useState<string | null>(null);
  // SE を鳴らした瞬間だけ光らせる(単発なので一覧の押下フィードバック用)。
  const [seFlash, setSeFlash] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(
    () => getVolumeSettings().bgm,
  );
  const [seVol, setSeVolState] = useState<number>(
    () => getVolumeSettings().se,
  );

  // BGM の <audio> には実効音量(master × bgm、または muted のときは 0)を当てる。
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = getEffectiveBgmVolume();
  }, [volume]);

  // 設定画面など外部からの音量変更を購読してスライダ/再生音量を追従させる。
  useEffect(() => {
    const off = onVolumeChange((s) => {
      setVolume(s.bgm);
      setSeVolState(s.se);
      if (audioRef.current) audioRef.current.volume = getEffectiveBgmVolume();
    });
    return off;
  }, []);

  // 1曲リピートは audio.loop で実現(ended が発火しない)。
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = repeat === "one";
  }, [repeat]);

  async function playBgm(id: string) {
    const track = tracks.find((t) => t.id === id);
    const audio = audioRef.current;
    if (!track || !audio) return;
    setError(null);
    try {
      const url = await audioUrl(track.path);
      audio.src = url;
      audio.volume = getEffectiveBgmVolume();
      audio.loop = repeat === "one";
      await audio.play();
      setCurrentId(id);
      setPlaying(true);
      onPlayBgm?.(track);
    } catch (e) {
      setError(`再生できませんでした: ${String(e)}`);
    }
  }

  /** 行の ▶BGM: 再生中の曲なら一時停止、それ以外はこの曲を BGM にする。 */
  function toggleBgm(track: BgmTrack) {
    const audio = audioRef.current;
    if (currentId === track.id && playing && audio) {
      audio.pause();
      setPlaying(false);
      onPlayBgm?.(null);
      return;
    }
    void playBgm(track.id);
  }

  /** 行の 🔔SE: 単発再生(BGM に重ねられる)。 */
  function playSe(track: BgmTrack) {
    setError(null);
    onPlaySe?.(track);
    setSeFlash(track.id);
    window.setTimeout(
      () => setSeFlash((v) => (v === track.id ? null : v)),
      600,
    );
  }

  // シーン切替: 紐づいた BGM があれば自動で再生(同じ曲なら継続)。
  useEffect(() => {
    if (sceneBgmId && sceneBgmId !== currentId) {
      void playBgm(sceneBgmId);
    }
    // playBgm/currentId は意図的に依存から外す(シーン変更時のみ反応)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneBgmId]);

  // 外部(アセットのマクロ)からの再生/停止指示。nonce 変化のたびに反応。
  useEffect(() => {
    if (!playSignal) return;
    const id = playSignal.id;
    if (!id) {
      audioRef.current?.pause();
      setPlaying(false);
      onPlayBgm?.(null);
      return;
    }
    if (id === currentId && playing) return; // 同じ曲が鳴っていれば継続
    void playBgm(id);
    // nonce のみをトリガにする(id/currentId を依存に入れると多重発火する)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playSignal?.nonce]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentId) {
      if (tracks[0]) void playBgm(tracks[0].id);
      return;
    }
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
      onPlayBgm?.(tracks.find((t) => t.id === currentId) ?? null);
    } else {
      audio.pause();
      setPlaying(false);
      onPlayBgm?.(null);
    }
  }

  function step(delta: number) {
    if (tracks.length === 0) return;
    const i = tracks.findIndex((t) => t.id === currentId);
    const next = (i + delta + tracks.length) % tracks.length;
    void playBgm(tracks[next].id);
  }

  function onEnded() {
    // repeat === "one" は audio.loop が処理(ここには来ない)。
    if (tracks.length === 0) return;
    const i = tracks.findIndex((t) => t.id === currentId);
    const isLast = i === tracks.length - 1;
    if (isLast && repeat !== "all") {
      setPlaying(false);
      onPlayBgm?.(null);
      return;
    }
    step(1);
  }

  function changeBgmVol(v: number) {
    setVolume(v);
    // volume-settings 経由で永続化 + 他コンポーネント(設定画面)へ通知。
    setVolumeSettings({ bgm: v });
  }

  function changeSeVol(v: number) {
    setSeVolState(v);
    setVolumeSettings({ se: v });
  }

  function remove(id: string) {
    if (id === currentId) {
      audioRef.current?.pause();
      setPlaying(false);
      setCurrentId(null);
      onPlayBgm?.(null);
    }
    onRemoveTrack(id);
  }

  async function pickFiles() {
    setError(null);
    try {
      const sel = await open({
        multiple: true,
        filters: [
          {
            name: "音声",
            extensions: ["mp3", "wav", "ogg", "m4a", "flac", "aac", "opus"],
          },
        ],
      });
      if (!sel) return;
      const paths = Array.isArray(sel) ? sel : [sel];
      const added: BgmTrack[] = paths.map((p) => ({
        id: crypto.randomUUID(),
        name: baseName(p),
        path: p,
      }));
      if (added.length) onAddTracks(added);
    } catch (e) {
      setError(`追加できませんでした: ${String(e)}`);
    }
  }

  return (
    <div className="bgm-window">
      <audio ref={audioRef} onEnded={onEnded} />

      <div className="bgm-list">
        {tracks.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, padding: "8px 4px" }}>
            「＋ 音声を追加」で BGM / SE をまとめて入れられます。各曲を ▶BGM
            (ループ)か 🔔SE(単発)で鳴らせます。
          </p>
        ) : (
          tracks.map((t) => {
            const isBgm = currentId === t.id && playing;
            return (
              <div
                key={t.id}
                className={`snd-item ${isBgm ? "bgm-on" : ""} ${
                  seFlash === t.id ? "se-on" : ""
                }`}
                title={t.path}
              >
                <button
                  className={`snd-btn snd-bgm ${isBgm ? "on" : ""}`}
                  title="BGM として再生（ループ）"
                  onClick={() => toggleBgm(t)}
                >
                  <span aria-hidden>{isBgm ? "❚❚" : "▶"}</span>
                  <i>BGM</i>
                </button>
                <button
                  className="snd-btn snd-se"
                  title="SE として再生（単発・BGM に重ねられます）"
                  onClick={() => playSe(t)}
                >
                  <span aria-hidden>🔔</span>
                  <i>SE</i>
                </button>
                <span className="bgm-name">{t.name}</span>
                {onBindScene && (
                  <button
                    className={`bgm-scene ${sceneBgmId === t.id ? "on" : ""}`}
                    title={
                      sceneBgmId === t.id
                        ? "このシーンの BGM（クリックで解除）"
                        : "このシーンの BGM にする（シーン切替で自動再生）"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      onBindScene(sceneBgmId === t.id ? null : t.id);
                    }}
                  >
                    🎬
                  </button>
                )}
                <button
                  className="bgm-del"
                  title="一覧から外す"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(t.id);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="bgm-controls">
        <button className="bgm-btn" onClick={() => step(-1)} title="前の曲へ">
          ⏮
        </button>
        <button
          className="bgm-btn play"
          onClick={togglePlay}
          title={playing ? "BGM 一時停止" : "BGM 再生"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button className="bgm-btn" onClick={() => step(1)} title="次の曲へ">
          ⏭
        </button>
        <button
          className={`bgm-btn bgm-repeat ${repeat !== "off" ? "on" : ""}`}
          onClick={() =>
            setRepeat((m) => (m === "one" ? "all" : m === "all" ? "off" : "one"))
          }
          title={`リピート: ${REPEAT_LABEL[repeat]}（クリックで切替）`}
        >
          {REPEAT_LABEL[repeat]}
        </button>
      </div>

      <div className="snd-vols">
        <label className="snd-vol" title="BGM 音量">
          🎵
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => changeBgmVol(Number(e.target.value))}
          />
        </label>
        <label className="snd-vol" title="SE 音量">
          🔔
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={seVol}
            onChange={(e) => changeSeVol(Number(e.target.value))}
          />
        </label>
      </div>

      <button
        className="btn mini btn-primary"
        style={{ width: "100%" }}
        onClick={() => void pickFiles()}
      >
        ＋ 音声を追加
      </button>

      {error && (
        <p className="tag fail" style={{ fontSize: 11, marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  );
}
