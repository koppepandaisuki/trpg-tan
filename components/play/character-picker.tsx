"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Loader2, ScrollText, X } from "lucide-react";
import { panelFromGeneric, panelFromSheet, type Panel } from "@trpg/core";
import { isGenericSheet } from "@trpg/ui/io";
import { getSheet, listMySheets, type SheetSummary } from "@/lib/sheets/client";

/**
 * 保存したキャラ(キャラシ / character_sheets)を卓に出すためのピッカー。
 * GM ビューと参加者ビューの両方で使う。選んだキャラは駒(Panel)に変換して返す
 * (能力値・技能・リソース・チャットパレットが駒に乗る。デスクトップの
 * 「キャラを呼ぶ」と同じ panelFromSheet / panelFromGeneric)。
 */
export function CharacterPicker({
  onPick,
  onClose,
}: {
  onPick: (panel: Panel) => void;
  onClose: () => void;
}) {
  const [sheets, setSheets] = useState<SheetSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listMySheets()
      .then((s) => alive && setSheets(s))
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setSheets([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pick(s: SheetSummary) {
    setBusy(s.id);
    setError(null);
    try {
      const sheet = await getSheet(s.id);
      const id = crypto.randomUUID();
      const panel = isGenericSheet(sheet)
        ? panelFromGeneric({ id, sheet })
        : panelFromSheet({ id, sheet });
      onPick(panel);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="保存したキャラを卓に出す"
    >
      <button
        aria-label="閉じる"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ScrollText className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">保存したキャラを卓に出す</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="ml-auto rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {error && (
            <p className="m-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {sheets === null ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              読み込み中…
            </p>
          ) : sheets.length === 0 ? (
            <div className="space-y-2 py-10 text-center text-sm text-muted-foreground">
              <p>保存したキャラがまだありません。</p>
              <Link
                href={"/characters" as Route}
                target="_blank"
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                キャラシでキャラを作る(新しいタブ)
              </Link>
            </div>
          ) : (
            <ul>
              {sheets.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => void pick(s)}
                    disabled={busy !== null}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-muted disabled:opacity-60"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-xs text-muted-foreground">
                      {busy === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : s.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (s.name || "?").slice(0, 1)
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {s.name || "(名前未設定)"}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {s.systemName ?? s.systemId}
                      </span>
                    </span>
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
