import { useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { BgmTrack, CutIn } from "@trpg/core";
import { audioUrl, baseName } from "./audio-url";

/**
 * カットイン演出。登録した画像をクリックで画面に走らせる(非ブロッキング)。
 * 画像は data URL で .play に保存し、卓と一緒に持ち運べる。
 * ♪ で効果音(ローカル音声ファイル)を任意で添付でき、発火時に一緒に鳴る。
 */

const CUTIN_MS = 2400;

/** サイドバーの管理パネル(追加 / 一覧 / 発火 / 削除 / 効果音)。 */
export function CutInPanel({
  cutins,
  seTracks,
  onAdd,
  onRemove,
  onFire,
  onSetSound,
}: {
  cutins: CutIn[];
  /** SE パネルに登録済みの音源(添付の選択肢)。 */
  seTracks: BgmTrack[];
  onAdd: (name: string, image: string) => void;
  onRemove: (id: string) => void;
  onFire: (cutin: CutIn) => void;
  /** 効果音の添付(null で解除)。 */
  onSetSound: (id: string, sound: { path: string; name: string } | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickSound(id: string) {
    const sel = await open({
      multiple: false,
      filters: [
        { name: "音声", extensions: ["mp3", "wav", "ogg", "m4a", "flac", "aac"] },
      ],
    });
    if (typeof sel === "string") {
      onSetSound(id, { path: sel, name: baseName(sel) });
    }
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onAdd(file.name.replace(/\.[^.]+$/, ""), reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="cutin-panel">
      {cutins.length === 0 ? (
        <p className="palette-empty muted">
          画像を追加して、クリックで画面に流します(決め台詞・登場演出など)。
        </p>
      ) : (
        <div className="cutin-list">
          {cutins.map((c) => (
            <div key={c.id} className="cutin-item">
              <button
                className="cutin-fire"
                onClick={() => onFire(c)}
                title={`「${c.name}」を再生${c.soundName ? `（♪ ${c.soundName}）` : ""}`}
              >
                <img src={c.image} alt={c.name} />
                <span className="cutin-name">{c.name}</span>
              </button>
              {/* 効果音: SE パネルの登録音源から選ぶ(ファイル直指定も可)。 */}
              <select
                className={`cutin-snd ${c.soundPath ? "on" : ""}`}
                value={c.soundPath ?? ""}
                title={
                  c.soundPath
                    ? `効果音: ${c.soundName}`
                    : "効果音を添付（発火時に一緒に鳴らす）"
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    onSetSound(c.id, null);
                  } else if (v === "__file__") {
                    void pickSound(c.id);
                  } else {
                    const t = seTracks.find((x) => x.path === v);
                    if (t) onSetSound(c.id, { path: t.path, name: t.name });
                  }
                }}
              >
                <option value="">♪ なし</option>
                {c.soundPath &&
                  !seTracks.some((t) => t.path === c.soundPath) && (
                    <option value={c.soundPath}>♪ {c.soundName}</option>
                  )}
                {seTracks.map((t) => (
                  <option key={t.id} value={t.path}>
                    ♪ {t.name}
                  </option>
                ))}
                <option value="__file__">ファイルから…</option>
              </select>
              <button
                className="cutin-del"
                onClick={() => onRemove(c.id)}
                title="削除"
                aria-label={`${c.name} を削除`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        className="btn mini"
        style={{ width: "100%" }}
        onClick={() => fileRef.current?.click()}
      >
        ＋ 画像を追加
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={pick}
      />
    </div>
  );
}

/** 画面を横切るカットイン本体。効果音付きなら同時に鳴らし、終了で onDone。 */
export function CutInOverlay({
  cutin,
  onDone,
}: {
  cutin: CutIn;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, CUTIN_MS);
    let audio: HTMLAudioElement | null = null;
    if (cutin.soundPath) {
      void audioUrl(cutin.soundPath)
        .then((url) => {
          audio = new Audio(url);
          audio.volume = 0.85;
          return audio.play();
        })
        .catch(() => {
          // 効果音が読めなくても演出自体は続行
        });
    }
    return () => {
      window.clearTimeout(t);
      audio?.pause();
    };
  }, [cutin, onDone]);

  return (
    <div className="cutin-overlay" aria-hidden>
      <div className="cutin-band" />
      <img className="cutin-image" src={cutin.image} alt="" />
    </div>
  );
}
