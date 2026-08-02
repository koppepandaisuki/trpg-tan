"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dices, Plus, LogIn, Trash2, Users } from "lucide-react";
import { createScene } from "@trpg/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { savePlayScene, deletePlaySession } from "@/lib/play/store";
import type { PlaySessionSummary } from "@/lib/queries/play-sessions";

/**
 * PLAY ロビー(卓一覧 / 新規作成 / 参加コードで参加)。
 *
 * 新規作成はその場で PlayScene を組んで play_sessions に保存し、卓画面へ。
 * 参加は DB を触らず、参加コードだけで Realtime のルームに入る。
 */
export function PlayLobby({ sessions }: { sessions: PlaySessionSummary[] }) {
  const router = useRouter();
  const [list, setList] = useState(sessions);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createTable() {
    setCreating(true);
    setError(null);
    try {
      const scene = createScene({
        id: crypto.randomUUID(),
        title: title.trim() || "新しい卓",
        now: new Date().toISOString(),
      });
      await savePlayScene(scene);
      router.push(`/play/${scene.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？この操作は取り消せません。`)) return;
    setError(null);
    try {
      await deletePlaySession(id);
      setList((l) => l.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function join() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push(`/play/join/${encodeURIComponent(code)}`);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* 卓を立てる / 参加する */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border">
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-2">
              <Dices className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold tracking-tight">
                卓を立てる（GM）
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              新しい卓を作って盤面を用意します。参加コードを共有すると、
              相手はブラウザからそのまま参加できます。
            </p>
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void createTable()}
                maxLength={60}
                placeholder="卓のタイトル（例: 白嶺の裁 1話）"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button onClick={() => void createTable()} disabled={creating}>
                <Plus className="h-4 w-4" aria-hidden />
                {creating ? "作成中…" : "作る"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-accent" aria-hidden />
              <h2 className="text-sm font-semibold tracking-tight">
                卓に参加する
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              GM から共有された 6 桁の参加コードを入れてください。
              インストールは不要です。
            </p>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && join()}
                maxLength={8}
                placeholder="参加コード"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                variant="outline"
                onClick={join}
                disabled={joinCode.trim().length < 4}
              >
                参加
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 保存済みの卓 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          保存した卓{list.length > 0 && `（${list.length}）`}
        </h2>
        {list.length === 0 ? (
          <Card className="border-dashed border-border">
            <CardContent className="py-8 text-center">
              <Dices
                className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                まだ卓がありません。上の「作る」から最初の卓を立ててみましょう。
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <li key={s.id}>
                <Card className="group relative overflow-hidden border-border transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                  <button
                    onClick={() => router.push(`/play/${s.id}`)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                      {s.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Dices
                            className="h-7 w-7 text-muted-foreground/40"
                            aria-hidden
                          />
                        </div>
                      )}
                    </div>
                    <CardContent className="space-y-1 py-3">
                      <p className="line-clamp-1 text-sm font-semibold">
                        {s.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden />
                          {s.panelCount} 駒
                        </span>
                        <span>・</span>
                        <span>{formatDate(s.updatedAt)}</span>
                      </div>
                    </CardContent>
                  </button>
                  <button
                    onClick={() => void remove(s.id, s.title)}
                    title="この卓を削除"
                    aria-label={`「${s.title}」を削除`}
                    className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
