"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { FileInput, Loader2, LogIn, ScrollText, Trash2 } from "lucide-react";
import type { CharacterSheet as CocSheet, GenericSheet, SystemDef } from "@trpg/core";
import {
  CharacterSheet,
  GenericSheetEditor,
  NewCharacterMenu,
  SheetSystemPicker,
  isGenericSheet,
  type AnySheet,
} from "@trpg/ui";
import { cloudSheetIO, pickSheetFile } from "@/lib/sheets/io";
import { findWebSystem, webSheetSources } from "@/lib/sheets/sources";
import {
  deleteSheet,
  getQuota,
  getSheet,
  listMySheets,
  type SheetQuota,
  type SheetSummary,
} from "@/lib/sheets/client";
import { cn } from "@/lib/utils";

/** エディタに何を出しているか。key を変えるとエディタの内部状態を作り直す。 */
type Mode =
  | { kind: "picker" }
  | {
      kind: "coc";
      key: string;
      sheet: CocSheet | null;
      ref: string | null;
      systemId: "coc7" | "coc6";
    }
  | {
      kind: "generic";
      key: string;
      def: SystemDef | null;
      sheet: GenericSheet | null;
      ref: string | null;
    };

/**
 * Web 版キャラシの画面(デスクトップの「キャラクター」ページと同じ構成)。
 *   - 左: 保存したキャラの一覧(クラウド)+ 新規メニュー + 保存数
 *   - 右: システム選択 / CoC エディタ / 汎用エディタ(@trpg/ui = デスクトップと共通)
 *
 * エディタは .rd-sheet の中に置く(デスクトップと同じスタイル環境。
 * components/sheet/rd-sheet-base.css)。一覧側は Web の Tailwind で描く。
 */
export function CharactersView({
  loggedIn,
  initialSheets,
  initialQuota,
  storageReady,
}: {
  loggedIn: boolean;
  initialSheets: SheetSummary[];
  initialQuota: SheetQuota | null;
  /** キャラ一覧を読めたか(読めないときは保存まわりの案内を出す)。 */
  storageReady: boolean;
}) {
  const [sheets, setSheets] = useState(initialSheets);
  const [quota, setQuota] = useState(initialQuota);
  const [mode, setMode] = useState<Mode>({ kind: "picker" });
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRef = mode.kind === "picker" ? null : mode.ref;

  function newKey() {
    return `k-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function openCoc(sheet: CocSheet | null, ref: string | null, systemId: "coc7" | "coc6" = "coc7") {
    setError(null);
    setMode({ kind: "coc", key: newKey(), sheet, ref, systemId });
  }

  function openGeneric(def: SystemDef | null, sheet: GenericSheet | null, ref: string | null) {
    setError(null);
    if (!def && !sheet) return;
    setMode({ kind: "generic", key: newKey(), def, sheet, ref });
  }

  function openAny(sheet: AnySheet, ref: string | null) {
    if (isGenericSheet(sheet)) openGeneric(findWebSystem(sheet.systemId), sheet, ref);
    else openCoc(sheet, ref, sheet.systemId === "coc6" ? "coc6" : "coc7");
  }

  async function openSaved(s: SheetSummary) {
    setOpening(s.id);
    setError(null);
    try {
      openAny(await getSheet(s.id), s.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpening(null);
    }
  }

  async function remove(s: SheetSummary) {
    if (!confirm(`「${s.name || "(名前未設定)"}」を削除しますか？この操作は取り消せません。`)) return;
    setError(null);
    try {
      await deleteSheet(s.id);
      setSheets((l) => l.filter((x) => x.id !== s.id));
      if (activeRef === s.id) setMode({ kind: "picker" });
      setQuota(await getQuota());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** 保存のたびに一覧と保存数を取り直す(並び順 = 更新順も揃う)。 */
  async function refresh() {
    try {
      const [list, q] = await Promise.all([listMySheets(), getQuota()]);
      setSheets(list);
      setQuota(q);
    } catch {
      // 一覧の再取得に失敗しても保存自体は済んでいる
    }
  }

  async function importFile() {
    setError(null);
    try {
      const sheet = await pickSheetFile();
      if (sheet) openAny(sheet, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const atLimit = quota?.limit != null && quota.used >= quota.limit;

  return (
    // ヘッダー(h-16 + 下端 2px)の直下に貼り付け、残りの高さいっぱいを使う。上の
    // α テストの帯などでページが少し長くても、スクロールすれば全高のエディタになる。
    <div className="flex flex-col md:sticky md:top-[calc(4rem+2px)] md:h-[calc(100vh-4rem-2px)] md:flex-row">
      {/* ===== 左: 一覧 ===== */}
      <aside className="flex shrink-0 flex-col border-b border-border bg-background/60 md:w-72 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <ScrollText className="h-4 w-4 text-primary" aria-hidden />
          <strong className="text-sm">キャラクター</strong>
          {/* 新規メニューは共通部品(デスクトップと同じ)なので .rd-sheet の中に置く */}
          <div className="rd-sheet ml-auto">
            <NewCharacterMenu
              sources={webSheetSources}
              onNewCoC={() => openCoc(null, null, "coc7")}
              onNewGeneric={(def) => openGeneric(def, null, null)}
              onImported={(sheet) => openCoc(sheet, null, sheet.systemId === "coc6" ? "coc6" : "coc7")}
              onImportedGeneric={(sheet) => openGeneric(findWebSystem(sheet.systemId), sheet, null)}
            />
          </div>
        </div>

        {!loggedIn ? (
          <div className="m-3 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p>ログインしなくても作成・編集できます。保存するにはログインしてください。</p>
            <Link
              href={"/login?next=/characters" as Route}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden />
              ログイン / 新規登録
            </Link>
          </div>
        ) : !storageReady ? (
          <p className="m-3 text-xs text-muted-foreground">
            保存したキャラの一覧を読み込めませんでした。時間をおいて再度お試しください。
          </p>
        ) : (
          <>
            {quota && (
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
                <span>
                  保存{" "}
                  <span className={cn("font-semibold tabular-nums", atLimit && "text-red-700")}>
                    {quota.used}
                    {quota.limit != null ? ` / ${quota.limit}` : ""}
                  </span>{" "}
                  体{quota.limit == null && "(無制限)"}
                </span>
                {quota.limit != null && (
                  <Link
                    href={"/pricing" as Route}
                    className="ml-auto text-primary hover:underline"
                    title="Pro プランで保存数が無制限になります"
                  >
                    {atLimit ? "上限を増やす" : "Pro で無制限"}
                  </Link>
                )}
              </div>
            )}
            <ul className="flex-1 overflow-y-auto p-2 md:max-h-none">
              {sheets.length === 0 ? (
                <li className="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
                  保存したキャラがここに並びます。「＋新規」からシステムを選んで作成できます。
                </li>
              ) : (
                sheets.map((s) => (
                  <li key={s.id}>
                    <div
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1.5 transition",
                        activeRef === s.id ? "bg-primary/10" : "hover:bg-muted",
                      )}
                    >
                      <button
                        onClick={() => void openSaved(s)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        disabled={opening !== null}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-[10px] text-muted-foreground">
                          {opening === s.id ? (
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
                          <span className="block truncate text-[10.5px] text-muted-foreground">
                            {s.systemName ?? s.systemId}
                          </span>
                        </span>
                      </button>
                      <button
                        onClick={() => void remove(s)}
                        title="削除"
                        aria-label={`「${s.name || "(名前未設定)"}」を削除`}
                        className="shrink-0 rounded-full p-1 text-muted-foreground opacity-0 transition hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </>
        )}

        <div className="border-t border-border p-2">
          <button
            onClick={() => void importFile()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs transition hover:bg-muted"
            title="デスクトップアプリで保存した .ccsheet ファイルを開きます"
          >
            <FileInput className="h-3.5 w-3.5" aria-hidden />
            ファイルから開く(.ccsheet)
          </button>
        </div>
        {error && (
          <p className="mx-2 mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
            {error}
          </p>
        )}
      </aside>

      {/* ===== 右: エディタ(デスクトップと共通)。独立したスクロール領域にして、
          エディタ内の sticky ツールバーがサイトのヘッダーの下に潜らないようにする。 ===== */}
      <section className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {/* Web の Tailwind 部品は .rd-sheet の外に置く(中では --primary 等が別の意味になる) */}
        {atLimit && mode.kind !== "picker" && !mode.ref && (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            保存できるキャラの上限({quota?.limit} 体)に達しています。新しく保存するには、
            不要なキャラを削除するか{" "}
            <Link href={"/pricing" as Route} className="font-semibold text-primary hover:underline">
              Pro プラン
            </Link>
            をご利用ください。
          </p>
        )}
        <div className="rd-sheet">
        {mode.kind === "picker" ? (
          <SheetSystemPicker
            sources={webSheetSources}
            onPickCoC={(sid) => openCoc(null, null, sid)}
            onPickGeneric={(def) => openGeneric(def, null, null)}
            onImported={(sheet) => openCoc(sheet, null, sheet.systemId === "coc6" ? "coc6" : "coc7")}
            onImportedGeneric={(sheet) => openGeneric(findWebSystem(sheet.systemId), sheet, null)}
          />
        ) : mode.kind === "coc" ? (
          <CharacterSheet
            key={mode.key}
            io={cloudSheetIO}
            initialSheet={mode.sheet}
            initialSystemId={mode.systemId}
            initialRef={mode.ref}
            onSaved={(_, ref) => {
              setMode((m) => (m.kind === "coc" ? { ...m, ref } : m));
              void refresh();
            }}
            onBack={() => setMode({ kind: "picker" })}
          />
        ) : (
          <GenericSheetEditor
            key={mode.key}
            io={cloudSheetIO}
            def={mode.def}
            initial={mode.sheet}
            initialRef={mode.ref}
            onSaved={(_, ref) => {
              setMode((m) => (m.kind === "generic" ? { ...m, ref } : m));
              void refresh();
            }}
            onBack={() => setMode({ kind: "picker" })}
          />
        )}
        </div>
      </section>
    </div>
  );
}
