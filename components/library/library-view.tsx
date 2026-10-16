"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Dices,
  Image as ImageIcon,
  Loader2,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableGrid } from "@/components/play/table-grid";
import { deletePlaySession, duplicatePlaySession } from "@/lib/play/store";
import { uploadPlayAudio, uploadPlayImage } from "@/lib/play/media";
import {
  listMyAssets,
  removeAsset,
  renameAsset,
  type AssetKind,
  type PlayAsset,
} from "@/lib/play/assets";
import type { PlaySessionSummary } from "@/lib/queries/play-sessions";
import { cn } from "@/lib/utils";
import { chipVariants, tabListVariants, tabVariants } from "@/components/ui/tabs";

type Tab = "tables" | "assets";
type Filter = "all" | AssetKind;

/**
 * ライブラリの本体(卓 / 素材 のタブ)。
 *
 * 初期データはサーバーで取って渡してもらい、以降の追加・改名・削除は
 * ブラウザから直接 Supabase を叩いて手元の一覧を更新する(PLAY ロビーと同じ)。
 */
export function LibraryView({
  sessions,
  assets,
  assetsReady,
  initialTab,
}: {
  sessions: PlaySessionSummary[];
  assets: PlayAsset[];
  /** 素材一覧を読めたか(読めないときは素材タブで案内を出す)。 */
  assetsReady: boolean;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tables, setTables] = useState(sessions);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  async function duplicateTable(s: PlaySessionSummary) {
    setError(null);
    try {
      const id = await duplicatePlaySession(s.id);
      router.push(`/play/${id}` as Route);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeTable(s: PlaySessionSummary) {
    if (!confirm(`「${s.title}」を削除しますか？この操作は取り消せません。`))
      return;
    setError(null);
    try {
      await deletePlaySession(s.id);
      setTables((l) => l.filter((x) => x.id !== s.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="ライブラリの表示"
        className={tabListVariants()}
      >
        <TabButton active={tab === "tables"} onClick={() => setTab("tables")}>
          <Dices className="h-4 w-4" aria-hidden />卓（{tables.length}）
        </TabButton>
        <TabButton active={tab === "assets"} onClick={() => setTab("assets")}>
          <ImageIcon className="h-4 w-4" aria-hidden />
          素材
        </TabButton>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {tab === "tables" ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link
              href={"/play" as Route}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Plus className="h-4 w-4" aria-hidden />
              新しい卓を立てる
            </Link>
          </div>
          <TableGrid
            sessions={tables}
            onRemove={(s) => void removeTable(s)}
            onDuplicate={(s) => void duplicateTable(s)}
            empty="まだ卓がありません。PLAY で卓を立てると、ここに保存されます。"
          />
        </div>
      ) : (
        <AssetsPanel initial={assets} ready={assetsReady} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(tabVariants(), "h-8 px-4 text-sm")}
    >
      {children}
    </button>
  );
}

/* ===================================================================== */

function AssetsPanel({
  initial,
  ready,
}: {
  initial: PlayAsset[];
  ready: boolean;
}) {
  const [assets, setAssets] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown =
    filter === "all" ? assets : assets.filter((a) => a.kind === filter);
  const counts = {
    image: assets.filter((a) => a.kind === "image").length,
    audio: assets.filter((a) => a.kind === "audio").length,
  };

  async function upload(files: FileList) {
    setError(null);
    const list = Array.from(files);
    try {
      for (const [i, f] of list.entries()) {
        setBusy(
          list.length > 1
            ? `アップロード中 ${i + 1} / ${list.length}`
            : "アップロード中",
        );
        if (f.type.startsWith("image/")) await uploadPlayImage(f);
        else if (f.type.startsWith("audio/")) await uploadPlayAudio(f);
        else throw new Error(`「${f.name}」は画像でも音声でもありません`);
      }
      // 登録は upload 側で済んでいるので、索引を読み直すだけ。
      setAssets(await listMyAssets());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function rename(a: PlayAsset) {
    const name = prompt("素材の名前", a.name);
    if (name === null || name.trim() === a.name) return;
    setError(null);
    try {
      await renameAsset(a.id, name);
      setAssets((l) =>
        l.map((x) => (x.id === a.id ? { ...x, name: name.trim() } : x)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(a: PlayAsset) {
    if (
      !confirm(
        `「${a.name}」をライブラリから外しますか？\n（すでに卓で使っている画像・音はそのまま残ります）`,
      )
    )
      return;
    setError(null);
    try {
      await removeAsset(a.id);
      setAssets((l) => l.filter((x) => x.id !== a.id));
      if (playingId === a.id) stop();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** 音声の試聴(同時に鳴らすのは 1 つだけ)。 */
  function toggle(a: PlayAsset) {
    if (playingId === a.id) {
      stop();
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
  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }

  if (!ready) {
    return (
      <Card className="border-dashed border-border">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          素材の一覧を読み込めませんでした。時間をおいて再度お試しください。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["all", `すべて（${assets.length}）`],
              ["image", `画像（${counts.image}）`],
              ["audio", `音声（${counts.audio}）`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={chipVariants()}
            >
              {label}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          className="ml-auto"
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-4 w-4" aria-hidden />
          )}
          {busy ?? "素材を追加"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) void upload(files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="py-8 text-center">
            <ImageIcon
              className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              {assets.length === 0
                ? "背景・駒・BGM などを追加しておくと、卓でいつでも使えます。卓でアップロードしたものも自動でここに並びます。"
                : "この種類の素材はまだありません。"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((a) => (
            <li key={a.id}>
              <Card className="group relative overflow-hidden border-border">
                {a.kind === "image" ? (
                  <div className="aspect-square overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => toggle(a)}
                    aria-label={
                      playingId === a.id
                        ? `「${a.name}」の試聴を止める`
                        : `「${a.name}」を試聴`
                    }
                    className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground transition hover:text-foreground"
                  >
                    <Music className="h-7 w-7" aria-hidden />
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-sm">
                      {playingId === a.id ? (
                        <Pause className="h-4 w-4" aria-hidden />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden />
                      )}
                    </span>
                  </button>
                )}
                <CardContent className="flex items-center gap-1 px-2 py-2">
                  <p
                    className="min-w-0 flex-1 truncate text-xs font-medium"
                    title={a.name}
                  >
                    {a.name}
                  </p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatSize(a.sizeBytes)}
                  </span>
                </CardContent>
                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton label="名前を変える" onClick={() => void rename(a)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </IconButton>
                  <IconButton
                    label="ライブラリから外す"
                    onClick={() => void remove(a)}
                    danger
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </IconButton>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm transition",
        danger ? "hover:text-red-600" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
