import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { BgmTrack } from "@trpg/core";
import { audioUrl, baseName } from "./audio-url";

/**
 * BGM プレイヤー(GM ローカル再生)。別ウィンドウの中身として描画する。
 * 音声はこのウィンドウで鳴る(配信せず GM のマシンで再生)。トラック一覧は
 * onAddTracks / onRemoveTrack でメイン卓へ送り、.play に保存・同期する。
 */
const VOL_KEY = "trpg.bgm.volume.v1";

/** リピートの種類: 1曲(既定) / プレイリスト全体 / なし。 */
type RepeatMode = "one" | "all" | "off";
const REPEAT_LABEL: Record<RepeatMode, string> = {
  one: "🔂 1曲",
  all: "🔁 全曲",
  off: "➡ なし",
};

export function BgmPlayer({
  tracks,
  onAddTracks,
  onRemoveTrack,
  sceneBgmId,
  onBindScene,
}: {
  tracks: BgmTrack[];
  onAddTracks: (tracks: BgmTrack[]) => void;
  onRemoveTrack: (id: string) => void;
  /** 現在のシーンに紐づく BGM(切替で自動再生)。 */
  sceneBgmId?: string | null;
  /** 現在のシーンへの紐付け切替(null で解除)。 */
  onBindScene?: (trackId: string | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("one");
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(() => {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0.6;
  });

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(VOL_KEY, String(volume));
  }, [volume]);

  // 1曲リピートは audio.loop で実現(ended が発火しない)。
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = repeat === "one";
  }, [repeat]);

  async function playTrack(id: string) {
    const track = tracks.find((t) => t.id === id);
    const audio = audioRef.current;
    if (!track || !audio) return;
    setError(null);
    try {
      const url = await audioUrl(track.path);
      audio.src = url;
      audio.volume = volume;
      audio.loop = repeat === "one";
      await audio.play();
      setCurrentId(id);
      setPlaying(true);
    } catch (e) {
      setError(`再生できませんでした: ${String(e)}`);
    }
  }

  // シーン切替: 紐づいた BGM があれば自動で再生(同じ曲なら継続)。
  useEffect(() => {
    if (sceneBgmId && sceneBgmId !== currentId) {
      void playTrack(sceneBgmId);
    }
    // playTrack/currentId は意図的に依存から外す(シーン変更時のみ反応)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneBgmId]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentId) {
      if (tracks[0]) void playTrack(tracks[0].id);
      return;
    }
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function step(delta: number) {
    if (tracks.length === 0) return;
    const i = tracks.findIndex((t) => t.id === currentId);
    const next = (i + delta + tracks.length) % tracks.length;
    void playTrack(tracks[next].id);
  }

  function onEnded() {
    // repeat === "one" は audio.loop が処理(ここには来ない)。
    if (tracks.length === 0) return;
    const i = tracks.findIndex((t) => t.id === currentId);
    const isLast = i === tracks.length - 1;
    if (isLast && repeat !== "all") {
      setPlaying(false);
      return;
    }
    step(1);
  }

  function remove(id: string) {
    if (id === currentId) {
      audioRef.current?.pause();
      setPlaying(false);
      setCurrentId(null);
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
            「＋ 音声を追加」で BGM を入れてください。
          </p>
        ) : (
          tracks.map((t) => (
            <div
              key={t.id}
              className={`bgm-item ${currentId === t.id ? "active" : ""}`}
              onClick={() => void playTrack(t.id)}
              title={t.path}
            >
              <span className="bgm-ic">
                {currentId === t.id && playing ? "▶" : "♪"}
              </span>
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
          ))
        )}
      </div>

      <div className="bgm-controls">
        <button className="bgm-btn" onClick={() => step(-1)} title="前へ">
          ⏮
        </button>
        <button
          className="bgm-btn play"
          onClick={togglePlay}
          title={playing ? "一時停止" : "再生"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button className="bgm-btn" onClick={() => step(1)} title="次へ">
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
        <input
          className="bgm-vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          title="音量"
        />
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
