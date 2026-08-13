"use client";

import { useRef, useState } from "react";
import {
  Clapperboard,
  Loader2,
  Music,
  Plus,
  Square,
  Trash2,
  Type,
  Volume2,
} from "lucide-react";
import type { BgmTrack, CutIn } from "@trpg/core";
import { uploadPlayAudio, uploadPlayImage } from "@/lib/play/media";

/**
 * GM 用の演出コントロール(BGM / SE / カットイン / テロップ)。
 *
 * 音声・画像はいったん `play` バケットへ上げて **公開 URL だけ** を配信する。
 * data URL のまま broadcast に載せると数 MB がチャンク分割 + ack で直列送信され、
 * 参加者側が数十秒待たされるため([[play-sync-media]] と同じ理由)。
 *
 * カットインは `scene.cutins` に貯めておき、発火時は **id だけ** を送る。
 * 参加者は自分が持っている scene から画像を引く。
 */
export function PlayFxBar({
  bgmTracks,
  seTracks,
  onTracksChange,
  cutins,
  onCutinsChange,
  playingBgm,
  onBgm,
  onSe,
  onFireCutin,
  onTelop,
  volume,
  onVolumeChange,
  disabled,
}: {
  /** 卓に保存された音源庫(scene.bgm / scene.se)。次回もここから選ぶだけで鳴る。 */
  bgmTracks: BgmTrack[];
  seTracks: BgmTrack[];
  onTracksChange: (kind: "bgm" | "se", next: BgmTrack[]) => void;
  cutins: CutIn[];
  onCutinsChange: (next: CutIn[]) => void;
  /** 再生中の BGM(null なら停止中)。 */
  playingBgm: BgmTrack | null;
  /** track=null は停止。 */
  onBgm: (track: BgmTrack | null) => void;
  onSe: (track: BgmTrack) => void;
  onFireCutin: (c: CutIn) => void;
  onTelop: (text: string) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telop, setTelop] = useState("");
  const bgmInput = useRef<HTMLInputElement>(null);
  const seInput = useRef<HTMLInputElement>(null);
  const cutinInput = useRef<HTMLInputElement>(null);

  /**
   * 音源ファイル → 卓に保存できる BgmTrack。
   *
   * `path` は desktop ではローカルの絶対パスだが、ブラウザにファイルシステムは
   * 無いので Storage の公開 URL を入れる。desktop 側の audioUrl は http(s) を
   * そのまま通すようにしてあるので、この卓を desktop で開いても鳴る。
   */
  async function toTrack(file: File): Promise<BgmTrack> {
    return {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 30),
      path: await uploadPlayAudio(file),
    };
  }

  async function withBusy(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-2">
      <div className="flex items-center gap-1.5">
        <Clapperboard
          className="h-3.5 w-3.5 text-muted-foreground"
          aria-hidden
        />
        <span className="text-[10px] font-semibold text-muted-foreground">
          演出(GM)
        </span>
        {busy && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {busy}
          </span>
        )}
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10.5px] text-red-800">
          {error}
        </p>
      )}

      {/* ===== BGM(卓に保存した音源庫から選ぶ) ===== */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Music className="h-3 w-3 text-muted-foreground" aria-hidden />
          <span className="text-[10px] font-semibold text-muted-foreground">
            BGM
          </span>
          {playingBgm && (
            <button
              onClick={() => onBgm(null)}
              disabled={disabled}
              title="BGMを止める"
              className="ml-auto inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Square className="h-2.5 w-2.5" aria-hidden />
              停止
            </button>
          )}
          <button
            onClick={() => bgmInput.current?.click()}
            disabled={disabled || !!busy}
            title="音源を追加"
            className={`${playingBgm ? "" : "ml-auto "}text-muted-foreground transition hover:text-foreground disabled:opacity-50`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <TrackList
          tracks={bgmTracks}
          activeId={playingBgm?.id ?? null}
          empty="「＋」で曲を追加すると、卓に残って次回も使えます。"
          disabled={disabled}
          onPlay={(t) => onBgm(t)}
          onRemove={(t) =>
            onTracksChange(
              "bgm",
              bgmTracks.filter((x) => x.id !== t.id),
            )
          }
        />
        <input
          ref={bgmInput}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            void withBusy("曲を追加中", async () => {
              const track = await toTrack(f);
              onTracksChange("bgm", [...bgmTracks, track]);
              onBgm(track); // 追加したらそのまま流す
            });
          }}
        />

        {/* 自分(GM)の音量。参加者は各自の画面で調整する。 */}
        <label className="flex items-center gap-1.5 px-0.5">
          <Volume2 className="h-3 w-3 text-muted-foreground" aria-hidden />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="h-1 flex-1 accent-primary"
            aria-label="自分の音量"
          />
        </label>
      </div>

      {/* ===== 効果音 ===== */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Volume2 className="h-3 w-3 text-muted-foreground" aria-hidden />
          <span className="text-[10px] font-semibold text-muted-foreground">
            効果音
          </span>
          <button
            onClick={() => seInput.current?.click()}
            disabled={disabled || !!busy}
            title="効果音を追加"
            className="ml-auto text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <TrackList
          tracks={seTracks}
          activeId={null}
          empty="「＋」で効果音を追加できます。"
          disabled={disabled}
          onPlay={(t) => onSe(t)}
          onRemove={(t) =>
            onTracksChange(
              "se",
              seTracks.filter((x) => x.id !== t.id),
            )
          }
        />
        <input
          ref={seInput}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            void withBusy("効果音を追加中", async () => {
              const track = await toTrack(f);
              onTracksChange("se", [...seTracks, track]);
              onSe(track); // 追加したらそのまま鳴らす
            });
          }}
        />
      </div>

      {/* ===== カットイン ===== */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">
            カットイン
          </span>
          <button
            onClick={() => cutinInput.current?.click()}
            disabled={disabled || !!busy}
            title="カットインを登録"
            className="ml-auto text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <input
          ref={cutinInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            void withBusy("カットインを登録中", async () => {
              const image = await uploadPlayImage(f);
              onCutinsChange([
                ...cutins,
                {
                  id: crypto.randomUUID(),
                  name: f.name.replace(/\.[^.]+$/, "").slice(0, 24),
                  image,
                },
              ]);
            });
          }}
        />
        {cutins.length === 0 ? (
          <p className="px-0.5 text-[10px] text-muted-foreground">
            「＋」で画像を登録すると、ここから全員の画面に流せます。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {cutins.map((c) => (
              <span
                key={c.id}
                className="group inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10.5px] transition hover:border-foreground/30"
              >
                <button
                  onClick={() => onFireCutin(c)}
                  disabled={disabled}
                  title={`「${c.name}」を流す`}
                  className="disabled:opacity-50"
                >
                  {c.name}
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`カットイン「${c.name}」を削除しますか？`))
                      return;
                    onCutinsChange(cutins.filter((x) => x.id !== c.id));
                  }}
                  title="削除"
                  className="opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                >
                  <Trash2 className="h-2.5 w-2.5" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ===== テロップ ===== */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = telop.trim();
          if (!t) return;
          onTelop(t);
          setTelop("");
        }}
        className="flex items-center gap-1"
      >
        <Type className="h-3 w-3 text-muted-foreground" aria-hidden />
        <input
          value={telop}
          onChange={(e) => setTelop(e.target.value)}
          disabled={disabled}
          maxLength={60}
          placeholder="テロップを流す"
          className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !telop.trim()}
          className="rounded border border-border px-1.5 py-1 text-[10.5px] transition hover:bg-muted disabled:opacity-40"
        >
          送信
        </button>
      </form>
    </div>
  );
}

/** 卓に保存された音源の一覧。クリックで再生、× で庫から外す。 */
function TrackList({
  tracks,
  activeId,
  empty,
  disabled,
  onPlay,
  onRemove,
}: {
  tracks: BgmTrack[];
  /** 再生中の曲(BGM のみ。SE は null)。 */
  activeId: string | null;
  empty: string;
  disabled?: boolean;
  onPlay: (t: BgmTrack) => void;
  onRemove: (t: BgmTrack) => void;
}) {
  if (tracks.length === 0) {
    return <p className="px-0.5 text-[10px] text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {tracks.map((t) => {
        const active = t.id === activeId;
        return (
          <span
            key={t.id}
            className={[
              "group inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] transition",
              active
                ? "border-primary bg-primary/10 font-semibold"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            ].join(" ")}
          >
            <button
              onClick={() => onPlay(t)}
              disabled={disabled}
              title={active ? "再生中" : `「${t.name}」を鳴らす`}
              className="min-w-0 truncate disabled:opacity-50"
            >
              {active ? "♪ " : ""}
              {t.name}
            </button>
            <button
              onClick={() => {
                if (!confirm(`「${t.name}」を卓から外しますか？`)) return;
                onRemove(t);
              }}
              title="卓から外す"
              className="shrink-0 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
            >
              <Trash2 className="h-2.5 w-2.5" aria-hidden />
            </button>
          </span>
        );
      })}
    </div>
  );
}
