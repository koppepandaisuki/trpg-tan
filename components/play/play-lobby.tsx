"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dices, Plus, LogIn, BookOpenText, Users } from "lucide-react";
import { createScene } from "@trpg/core";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  savePlayScene,
  deletePlaySession,
  duplicatePlaySession,
  importPlayFile,
} from "@/lib/play/store";
import type { PlaySessionSummary } from "@/lib/queries/play-sessions";
import { TableGrid } from "./table-grid";
import { JoinCodeForm } from "./join-code-form";
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
export function PlayLobby({
  sessions,
  signedIn = true,
  autoCreate = false,
}: {
  sessions: PlaySessionSummary[];
  /** 未ログインでもロビーは開ける(参加だけできる)。卓を立てるにはログイン。 */
  signedIn?: boolean;
  /**
   * 開いたらすぐ新しい卓を作って入る(/play?new=1)。トップの「卓を立てる」と、
   * 「ログインして卓を立てる」からログインして戻ってきたとき用(もう一度押させない)。
   */
  autoCreate?: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState(sessions);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
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
      router.replace(`/play/${scene.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  }

  async function duplicate(id: string) {
    setError(null);
    try {
      const newId = await duplicatePlaySession(id);
      router.push(`/play/${newId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const playInput = useRef<HTMLInputElement>(null);
  async function pickPlayFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setImporting(true);
    try {
      const id = await importPlayFile(file);
      router.push(`/play/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImporting(false);
    } finally {
      if (playInput.current) playInput.current.value = "";
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

  // /play?new=1: ログイン済みなら、その場で新しい卓を作って入る(1 回だけ)。
  const autoCreated = useRef(false);
  useEffect(() => {
    if (!autoCreate || !signedIn || autoCreated.current) return;
    autoCreated.current = true;
    void createTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate, signedIn]);

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* 参加する / 卓を立てる。どちらも同じ重さで見せる(スマホは参加が先: 参加者はスマホが多い) */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="order-2 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 md:order-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <Dices className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight">卓を立てる(GM)</h2>
              <p className="text-xs text-muted-foreground">
                盤面を用意して、参加コードで仲間を呼ぶ
              </p>
            </div>
          </div>
          {!signedIn ? (
            <div className="space-y-2">
              <Link
                href={`/login?next=${encodeURIComponent("/play?new=1")}` as Route}
                className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}
              >
                <LogIn aria-hidden />
                ログインして卓を立てる(無料)
              </Link>
              <p className="text-center text-[11px] text-muted-foreground">
                ログインすると、そのまま新しい卓が開きます。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void createTable()}
                maxLength={60}
                placeholder="卓のタイトル(あとで変えられます)"
                className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm transition-colors hover:border-foreground/25 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              />
              <Button
                size="lg"
                className="w-full"
                onClick={() => void createTable()}
                disabled={creating}
              >
                <Plus aria-hidden />
                {creating ? "卓を作っています…" : "卓を立てる"}
              </Button>
            </div>
          )}
        </section>

        <section className="order-1 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 md:order-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight">卓に参加する(参加者)</h2>
              <p className="text-xs text-muted-foreground">ログインもインストールも不要</p>
            </div>
          </div>
          <JoinCodeForm />
          <p className="text-center text-[11px] text-muted-foreground">
            GM から届いた招待リンクを開いても参加できます。
          </p>
        </section>
      </div>

      {/* 姉妹アプリ「TRPGシナリオ工房」から(卓を保存するのでログイン時のみ) */}
      {signedIn && (
        <Card className="border-border">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <BookOpenText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold tracking-tight">
                シナリオ工房・卓ファイルから作る
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                「TRPGシナリオ工房」の設定 →「バックアップ」で書き出した .zip を選ぶと、
                シーン・読み上げ文・NPC・ハンドアウト・判定メモ入りの卓ができます (秘密の情報は GM
                だけに表示)。
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
            <input
              ref={playInput}
              type="file"
              accept=".play,application/json"
              className="hidden"
              onChange={(e) => void pickPlayFile(e.target.files?.[0])}
            />
            <Button
              variant="ghost"
              onClick={() => playInput.current?.click()}
              disabled={importing}
              title="Re-dice で書き出した卓ファイル(.play。デスクトップ版と共通)を読み込む"
            >
              卓ファイル(.play)を読み込む
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
      )}

      {/* 最近の卓 */}
      {signedIn && (
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
            onDuplicate={(s) => void duplicate(s.id)}
            empty="まだ卓がありません。上の「作る」から最初の卓を立ててみましょう。"
          />
        </div>
      )}
    </div>
  );
}
