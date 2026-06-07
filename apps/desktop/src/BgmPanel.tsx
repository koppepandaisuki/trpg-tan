import { useEffect, useRef, useState, type RefObject } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { BgmTrack } from "@trpg/core";
import { audioUrl, baseName } from "./audio-url";
import { FloatingWidget } from "./FloatingWidget";

/**
 * BGM プレイヤー(GM ローカル再生)。ファイルを追加してプレイリスト再生。
 * 音声は配信せず GM のマシンで鳴らすだけ(サーバ負荷ゼロ)。
 *
 * <audio> は常にマウントしておき、パネルを閉じても再生が続くようにする。
 */
const VOL_KEY = "trpg.bgm.volume.v1";

export function BgmPanel({
  tracks,
  open: isOpen,
  onClose,
  onAddTracks,
  onRemoveTrack,
  boundsRef,
}: {
  tracks: BgmTrack[];
  open: boolean;
  onClose: () => void;
  onAddTracks: (tracks: BgmTrack[]) => void;
  onRemoveTrack: (id: string) => void;
  boundsRef: RefObject<HTMLElement | null>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(() => {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0.6;
  });

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(VOL_KEY, String(volume));
  }, [volume]);

  async function playTrack(id: string) {
    const track = tracks.find((t) => t.id === id);
    const audio = audioRef.current;
    if (!track || !audio) return;
    setError(null);
    try {
      const url = await audioUrl(track.path);
      audio.src = url;
      audio.volume = volume;
      await audio.play();
      setCurrentId(id);
      setPlaying(true);
    } catch (e) {
      setError(`再生できませんでした: ${String(e)}`);
    }
  }

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
    if (tracks.length === 0) return;
    const i = tracks.findIndex((t) => t.id === currentId);
    const isLast = i === tracks.length - 1;
    if (isLast && !loop) {
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
    <>
      <audio ref={audioRef} onEnded={onEnded} />

      {isOpen && (
        <FloatingWidget
          id="bgm"
          title="BGM"
          icon="♪"
          boundsRef={boundsRef}
          onClose={onClose}
          minW={220}
          minH={240}
          bodyClass="bgm-body"
          defaultRect={(b) => ({
            x: 16,
            y: Math.max(16, b.h - 360),
            w: 264,
            h: 344,
            z: 0,
          })}
        >
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
              className={`bgm-btn ${loop ? "on" : ""}`}
              onClick={() => setLoop((v) => !v)}
              title="リピート"
            >
              🔁
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
        </FloatingWidget>
      )}
    </>
  );
}
