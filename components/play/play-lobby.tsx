"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Dices, Plus, LogIn, BookOpenText } from "lucide-react";
import { createScene } from "@trpg/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { savePlayScene, deletePlaySession } from "@/lib/play/store";
import type { PlaySessionSummary } from "@/lib/queries/play-sessions";
import { TableGrid } from "./table-grid";
import { readKoboBackup, type KoboBackup } from "@/lib/play/kobo-import";
import type { KoboScenarioRef } from "@trpg/core";

/** ロビーに出す「最近の卓」の件数。すべてはライブラリで見る。 */
const RECENT_LIMIT = 6;

/**
 * PLAY ロビー(新規作成 / 参加コードで参加 / 最近の卓)。
 *
 * 卓の保管と管理(全件・削除)はライブラリが持つ。ロビーは「遊び始める」ための
 * 画面なので、最近の卓を数件だけ出して、続きはライブラリへ誘導する。
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
  // シナリオ工房のバックアップ(複数シナリオ入りなら選んでもらう)。
  const koboInput = useRef<HTMLInputElement>(null);
  const [kobo, setKobo] = useState<KoboBackup | null>(null);
  const [importing, setImporting] = useState(false);

  async function pickKobo(file: File | undefined) {
    if (!file) return;
    setError(null);
    setImporting(true);
    try {
      const backup = await readKoboBackup(file);
      if (backup.scenarios.length === 1) {
        await importKobo(backup, backup.scenarios[0]);
      } else {
        setKobo(backup);
        setImporting(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImporting(false);
    } finally {
      if (koboInput.current) koboInput.current.value = "";
    }
  }

  async function importKobo(backup: KoboBackup, ref: KoboScenarioRef) {
    setImporting(true);
    setError(null);
    try {
      const scene = backup.toPlay(ref);
      await savePlayScene(scene);
      router.push(`/play/${scene.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImporting(false);
    }
  }

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

      {/* 姉妹アプリ「TRPGシナリオ工房」から */}
      <Card className="border-border">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <BookOpenText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight">
              シナリオ工房から卓を作る
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              「TRPGシナリオ工房」の設定 →「バックアップ」で書き出した .zip を選ぶと、
              シーン・読み上げ文・NPC・ハンドアウト・判定メモ入りの卓ができます
              (秘密の情報は GM だけに表示)。
            </p>
          </div>
          <input
            ref={koboInput}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => void pickKobo(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            onClick={() => koboInput.current?.click()}
            disabled={importing}
          >
            {importing ? "読み込み中…" : "バックアップを選ぶ"}
          </Button>
          {kobo && (
            <div className="w-full space-y-2 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold">
                どのシナリオで卓を作りますか?({kobo.scenarios.length} 本)
              </p>
              <div className="flex flex-wrap gap-2">
                {kobo.scenarios.map((ref) => (
                  <Button
                    key={ref.dir}
                    size="sm"
                    variant="outline"
                    disabled={importing}
                    onClick={() => void importKobo(kobo, ref)}
                  >
                    {ref.title || "(無題)"}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setKobo(null)}>
                  やめる
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最近の卓 */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight">最近の卓</h2>
          {list.length > RECENT_LIMIT && (
            <Link
              href={"/library" as Route}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              ライブラリですべて見る（{list.length}）→
            </Link>
          )}
        </div>
        <TableGrid
          sessions={list.slice(0, RECENT_LIMIT)}
          onRemove={(s) => void remove(s.id, s.title)}
          empty="まだ卓がありません。上の「作る」から最初の卓を立ててみましょう。"
        />
      </div>
    </div>
  );
}
