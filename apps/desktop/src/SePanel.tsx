import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { BgmTrack } from "@trpg/core";
import { audioUrl, baseName } from "./audio-url";

/**
 * SE(効果音)。BGM とは別の単発再生用の音源庫。
 *  - ▶ でその場で鳴らす(普段使い。多重再生せず直前の SE は止める)
 *  - カットインの ♪ や定型文の [SE:名前] から、ここの登録音源を参照する
 * トラック一覧は .play(卓データ)に保存される。
 */

const VOL_KEY = "trpg.se.volume.v1";

function readVol(): number {
  const v = Number(localStorage.getItem(VOL_KEY));
  return Number.isFinite(v) && v > 0 ? v : 0.8;
}

let current: HTMLAudioElement | null = null;

/** SE を単発再生する(直前の SE は停止)。失敗時は null。 */
export async function playSeFile(
  path: string,
): Promise<HTMLAudioElement | null> {
  try {
    const url = await audioUrl(path);
    current?.pause();
    const a = new Audio(url);
    a.volume = readVol();
    current = a;
    void a.play();
    return a;
  } catch {
    return null;
  }
}

export function SePanel({
  tracks,
  onAdd,
  onRemove,
}: {
  tracks: BgmTrack[];
  onAdd: (tracks: BgmTrack[]) => void;
  onRemove: (id: string) => void;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [volume, setVolume] = useState(readVol);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(VOL_KEY, String(volume));
    if (current) current.volume = volume;
  }, [volume]);

  async function play(t: BgmTrack) {
    setError(null);
    const a = await playSeFile(t.path);
    if (!a) {
      setError("再生できませんでした(移動/削除の可能性)");
      return;
    }
    setPlayingId(t.id);
    a.onended = () => setPlayingId((v) => (v === t.id ? null : v));
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
      if (added.length) onAdd(added);
    } catch (e) {
      setError(`追加できませんでした: ${String(e)}`);
    }
  }

  return (
    <div className="se-panel">
      {tracks.length === 0 ? (
        <p className="palette-empty muted">
          効果音を登録すると、ここから単発再生できるほか、カットインや
          定型文(行末に <code>[SE:名前]</code>)にも載せられます。
        </p>
      ) : (
        <div className="bgm-list">
          {tracks.map((t) => (
            <div
              key={t.id}
              className={`bgm-item ${playingId === t.id ? "active" : ""}`}
              onClick={() => void play(t)}
              title={`${t.path}\nクリックで再生`}
            >
              <span className="bgm-ic">{playingId === t.id ? "▶" : "🔔"}</span>
              <span className="bgm-name">{t.name}</span>
              <button
                className="bgm-del"
                title="一覧から外す"
                onClick={(e) => {
                  e.stopPropagation();
                  if (playingId === t.id) {
                    current?.pause();
                    setPlayingId(null);
                  }
                  onRemove(t.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="se-vol-row">
        <span aria-hidden>🔊</span>
        <input
          className="bgm-vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          title="SE 音量"
        />
      </div>

      <button
        className="btn mini btn-primary"
        style={{ width: "100%" }}
        onClick={() => void pickFiles()}
      >
        ＋ 効果音を追加
      </button>

      {error && (
        <p className="tag fail" style={{ fontSize: 11 }}>
          {error}
        </p>
      )}
    </div>
  );
}
