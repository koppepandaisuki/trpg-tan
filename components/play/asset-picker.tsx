"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { FolderOpen, Loader2, Music, Pause, Play, X } from "lucide-react";
import { listMyAssets, type AssetKind, type PlayAsset } from "@/lib/play/assets";
import { toolButton } from "@/components/ui/button";

/**
 * ライブラリの素材を卓で使うためのピッカー(モーダル)。
 *
 * 卓の背景・カットイン・BGM/効果音を「新しくアップロード」する代わりに、
 * ライブラリに保管してある素材から選べるようにする。素材は公開 URL なので、
 * 選んだ URL をそのまま scene に入れれば参加者にも届く。
 */
export function AssetPicker({
  kind,
  title,
  onPick,
  onClose,
}: {
  kind: AssetKind;
  title: string;
  onPick: (asset: PlayAsset) => void;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<PlayAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    listMyAssets(kind)
      .then((a) => alive && setAssets(a))
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setAssets([]);
      });
    return () => {
      alive = false;
      audioRef.current?.pause();
    };
  }, [kind]);

  // Escape で閉じる。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function preview(a: PlayAsset) {
    if (playingId === a.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const el = new Audio(a.url);
    el.volume = 0.5;
    el.onended = () => setPlayingId(null);
    void el.play().catch(() => setPlayingId(null));
    audioRef.current = el;
    setPlayingId(a.id);
  }

  function pick(a: PlayAsset) {
    audioRef.current?.pause();
    onPick(a);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="閉じる"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <FolderOpen className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="ml-auto rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {assets === null ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              読み込み中…
            </p>
          ) : assets.length === 0 ? (
            <div className="space-y-2 py-10 text-center text-sm text-muted-foreground">
              <p>
                ライブラリに{kind === "image" ? "画像" : "音声"}
                の素材がまだありません。
              </p>
              <Link
                href={"/library?tab=assets" as Route}
                target="_blank"
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                ライブラリで素材を追加する(新しいタブ)
              </Link>
            </div>
          ) : kind === "image" ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {assets.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => pick(a)}
                    title={`「${a.name}」を使う`}
                    className="group block w-full overflow-hidden rounded-md border border-border text-left transition hover:border-primary hover:shadow-md"
                  >
                    <div className="aspect-square overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <p className="truncate px-1.5 py-1 text-[11px]">{a.name}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {assets.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => preview(a)}
                    aria-label={
                      playingId === a.id ? "試聴を止める" : `「${a.name}」を試聴`
                    }
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
                  >
                    {playingId === a.id ? (
                      <Pause className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Play className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                  <Music
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                  <button
                    onClick={() => pick(a)}
                    className={toolButton}
                  >
                    使う
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
