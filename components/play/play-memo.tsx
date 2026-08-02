"use client";

import { useEffect, useState } from "react";
import { NotebookPen, Plus, Trash2 } from "lucide-react";
import type { MemoPage } from "@trpg/core";

/**
 * 共有メモ(卓の全員で見る覚書)。
 *
 * ハンドアウト・NPC 名・調査で判明したことなど、チャットに流すと埋もれる
 * 情報を置く場所。GM も参加者も編集でき、変更は Realtime の `memo` で
 * 卓全体に配られる(GM が保持して .play / play_sessions に残す)。
 *
 * 入力中に毎打鍵で配信すると相手のカーソルが飛ぶので、変更が落ち着いてから
 * (デバウンス)送る。
 */
export function PlayMemo({
  memos,
  onChange,
  disabled,
}: {
  memos: MemoPage[];
  /** 確定した全ページ(呼び出し側が配信 or intent 送信する)。 */
  onChange: (next: MemoPage[]) => void;
  disabled?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(
    memos[0]?.id ?? null,
  );
  const [draft, setDraft] = useState<string>("");
  const active = memos.find((m) => m.id === activeId) ?? memos[0] ?? null;

  // 外部(他の参加者)からの更新を取り込む。自分が編集中でなければ追従する。
  useEffect(() => {
    setDraft(active?.text ?? "");
  }, [active?.id, active?.text]);

  // 入力が落ち着いたら確定して配信。
  useEffect(() => {
    if (!active || draft === active.text) return;
    const t = window.setTimeout(() => {
      onChange(
        memos.map((m) => (m.id === active.id ? { ...m, text: draft } : m)),
      );
    }, 600);
    return () => window.clearTimeout(t);
    // onChange/memos は毎レンダー変わりうるので依存に入れない(draft の確定だけが目的)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, active?.id]);

  function addPage() {
    const name = prompt("メモの名前", `メモ${memos.length + 1}`);
    if (!name?.trim()) return;
    const page: MemoPage = {
      id: crypto.randomUUID(),
      name: name.trim(),
      text: "",
    };
    onChange([...memos, page]);
    setActiveId(page.id);
  }

  function removePage(id: string, name: string) {
    if (!confirm(`メモ「${name}」を削除しますか？`)) return;
    const next = memos.filter((m) => m.id !== id);
    onChange(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-background p-2">
      <div className="flex items-center gap-1.5">
        <NotebookPen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-[10px] font-semibold text-muted-foreground">
          共有メモ
        </span>
        <button
          onClick={addPage}
          disabled={disabled}
          title="メモを追加"
          className="ml-auto text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {memos.length === 0 ? (
        <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">
          「＋」でメモを作ると、卓の全員と共有できます。
        </p>
      ) : (
        <>
          {/* ページ切替 */}
          <div className="flex flex-wrap gap-1">
            {memos.map((m) => (
              <span
                key={m.id}
                className={[
                  "group inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] transition",
                  m.id === active?.id
                    ? "border-primary bg-primary/10 font-semibold"
                    : "border-border text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <button onClick={() => setActiveId(m.id)}>{m.name}</button>
                <button
                  onClick={() => removePage(m.id, m.name)}
                  disabled={disabled}
                  title="このメモを削除"
                  className="opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                >
                  <Trash2 className="h-2.5 w-2.5" aria-hidden />
                </button>
              </span>
            ))}
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={disabled}
            rows={6}
            placeholder="ハンドアウト、判明した手がかり、NPC の名前など"
            className="w-full resize-y rounded border border-border bg-background p-2 text-[11.5px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </>
      )}
    </div>
  );
}
