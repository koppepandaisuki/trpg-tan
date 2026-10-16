"use client";

import { useEffect, useMemo, useState } from "react";
import { Dice5, HelpCircle, Loader2, Search, X } from "lucide-react";
import { DICE_BOTS } from "@trpg/core";
import {
  BCDICE_PREFIX,
  bcdiceHelp,
  bcdiceIdOf,
  listBcdiceSystems,
  loadBcdiceSystem,
  type BcdiceSystemInfo,
} from "@/lib/play/bcdice";
import { toolButton } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/tabs";

/**
 * 卓のダイスボット選択(GM)。
 *
 *   - Re-dice 内蔵のボット(CoC・SW2.5・DX3 など 10 種。即時・軽量)
 *   - BCDice の 280 以上の日本語システム(選んだものだけを読み込む)
 *
 * 選ぶと卓の diceBot に保存され、参加者の発言(ダイス)も GM 端末のこのボットで
 * 振られる。BCDice のコマンド一覧は「?」で見られる。
 */
export function DiceBotPicker({
  value,
  systemId,
  onChange,
}: {
  value: string | undefined;
  /** 卓のシステム(未選択時の既定表示に使う)。 */
  systemId: string;
  onChange: (bot: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [bcdice, setBcdice] = useState<BcdiceSystemInfo[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bcId = bcdiceIdOf(value);
  const effective = value ?? (systemId === "coc6" || systemId === "coc7" ? "coc" : "generic");

  // 卓を開いた時点で BCDice のシステムを先読みしておく(最初の 1 投が遅れないように)。
  useEffect(() => {
    if (bcId) void loadBcdiceSystem(bcId).catch(() => {});
  }, [bcId]);

  useEffect(() => {
    if (!open || bcdice) return;
    listBcdiceSystems()
      .then(setBcdice)
      .catch(() => setError("BCDice の一覧を読み込めませんでした"));
  }, [open, bcdice]);

  const label = useMemo(() => {
    if (bcId) return bcdice?.find((s) => s.id === bcId)?.name ?? bcId;
    return DICE_BOTS.find((b) => b.id === effective)?.name ?? "汎用";
  }, [bcId, bcdice, effective]);

  const needle = q.trim().toLowerCase();
  const filtered = (bcdice ?? []).filter(
    (s) =>
      !needle ||
      s.name.toLowerCase().includes(needle) ||
      s.sortKey.includes(needle) ||
      s.id.toLowerCase().includes(needle),
  );

  async function pickBcdice(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      await loadBcdiceSystem(id);
      onChange(BCDICE_PREFIX + id);
      setOpen(false);
    } catch {
      setError("このシステムを読み込めませんでした");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <span className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="ダイスボット(システム固有のダイスコマンド)を選ぶ"
        className={toolButton}
      >
        <Dice5 className="h-3.5 w-3.5" aria-hidden />
        <span className="max-w-[12rem] truncate">{label}</span>
      </button>
      {bcId && (
        <button
          type="button"
          onClick={() =>
            setHelp(bcdiceHelp(bcId) || "読み込み中です。少し待ってから開いてください。")
          }
          title="コマンド一覧"
          className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-80 rounded-md border border-border bg-background p-2 text-xs shadow-lg">
          <p className="px-1 pb-1 font-semibold text-muted-foreground">内蔵(軽量)</p>
          <div className="flex flex-wrap gap-1 pb-2">
            {DICE_BOTS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  onChange(b.id);
                  setOpen(false);
                }}
                aria-pressed={!bcId && effective === b.id}
                className={chipVariants()}
              >
                {b.name}
              </button>
            ))}
          </div>
          <p className="px-1 pb-1 font-semibold text-muted-foreground">
            BCDice({bcdice ? `${bcdice.length} システム` : "読み込み中"})
          </p>
          <label className="flex items-center gap-1 rounded border border-border px-2 py-1">
            <Search className="h-3 w-3 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="システム名で検索(例: ソード、ネクロニカ)"
              className="min-w-0 flex-1 bg-transparent outline-none"
              autoFocus
            />
          </label>
          {error && <p className="px-1 pt-1 text-red-700">{error}</p>}
          <ul className="mt-1 max-h-64 overflow-y-auto">
            {!bcdice && (
              <li className="flex items-center gap-1 px-1 py-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                読み込み中…
              </li>
            )}
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void pickBcdice(s.id)}
                  disabled={!!loadingId}
                  className={`flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-muted ${
                    bcId === s.id ? "bg-ink font-semibold text-ink-foreground hover:bg-ink/90" : ""
                  }`}
                >
                  <span className="truncate">{s.name}</span>
                  {loadingId === s.id && (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="px-1 pt-1 text-[10px] text-muted-foreground">
            BCDice © BCDice Project(BSD-3-Clause)
          </p>
        </div>
      )}

      {help !== null && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setHelp(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-4 text-xs shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">{label} のコマンド</p>
              <button type="button" onClick={() => setHelp(null)} aria-label="閉じる">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans leading-relaxed">{help}</pre>
          </div>
        </div>
      )}
    </span>
  );
}
