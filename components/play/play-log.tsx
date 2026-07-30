"use client";

import { useEffect, useRef } from "react";
import { EyeOff } from "lucide-react";
import type { CoCSuccessLevel, PlayEvent, RollEvent } from "@trpg/core";

/** CoC 判定の成功度ラベル(デスクトップ版 LogView と同じ文言)。 */
function levelLabel(level: CoCSuccessLevel): string {
  switch (level) {
    case "extreme":
      return "イクストリーム！";
    case "hard":
      return "ハード成功";
    case "regular":
      return "成功";
    case "special":
      return "スペシャル！";
    case "fumble":
      return "ファンブル…";
    default:
      return "失敗";
  }
}

/**
 * チャット / ダイスログ。新着で自動スクロール(ユーザーが上を読んでいる間は止める)。
 * シークレットダイスは、見る権利が無い相手には出目を伏せる。
 */
export function PlayLog({
  log,
  /** 自分が GM か(シークレットの出目を見られる)。 */
  isGm,
  /** 自分の駒 id 群(visibleTo 判定用)。 */
  myPanelIds,
}: {
  log: PlayEvent[];
  isGm: boolean;
  myPanelIds?: string[];
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <div
      ref={boxRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        // 下端付近にいるときだけ自動追従(ログを遡っている間は邪魔しない)。
        stickRef.current =
          el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      className="flex-1 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3"
    >
      {log.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">
          まだ発言がありません。下の入力欄から話しかけたり、ダイスを振れます。
        </p>
      )}
      {log.map((ev) => (
        <LogRow
          key={ev.id}
          ev={ev}
          canSeeSecret={isGm || canSee(ev, myPanelIds ?? [])}
        />
      ))}
    </div>
  );
}

function canSee(ev: PlayEvent, myPanelIds: string[]): boolean {
  if (ev.kind !== "roll" || !ev.secret) return true;
  return (ev.visibleTo ?? []).some((id) => myPanelIds.includes(id));
}

function LogRow({ ev, canSeeSecret }: { ev: PlayEvent; canSeeSecret: boolean }) {
  if (ev.kind === "system") {
    return (
      <p className="text-center text-[11px] text-muted-foreground">{ev.text}</p>
    );
  }
  if (ev.kind === "chat") {
    return (
      <p className="text-sm leading-relaxed">
        <span
          className="mr-1.5 font-bold"
          style={ev.color ? { color: ev.color } : undefined}
        >
          {ev.actor}
        </span>
        <span className="whitespace-pre-wrap break-words">{ev.text}</span>
      </p>
    );
  }
  if (ev.kind === "roll") {
    return <RollRow ev={ev} canSeeSecret={canSeeSecret} />;
  }
  // resource / panel 系はログに出さない(盤面に反映済み)。
  return null;
}

function RollRow({ ev, canSeeSecret }: { ev: RollEvent; canSeeSecret: boolean }) {
  if (ev.secret && !canSeeSecret) {
    return (
      <p className="flex items-center gap-1.5 text-sm">
        <span className="font-bold">{ev.actor}</span>
        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          <EyeOff className="h-3 w-3" aria-hidden />
          シークレットダイス
        </span>
      </p>
    );
  }
  // 成否の色分け(CoC 判定 / 比較ロール / ダイスボット)。
  const ok = ev.check ? ev.check.isSuccess : ev.success;
  const tone =
    ok === true
      ? "text-emerald-700"
      : ok === false
        ? "text-red-700"
        : "text-foreground";
  return (
    <p className="text-sm leading-relaxed">
      <span
        className="mr-1.5 font-bold"
        style={ev.color ? { color: ev.color } : undefined}
      >
        {ev.actor}
      </span>
      <span className="text-muted-foreground">{ev.label}</span>
      <span className="mx-1">→</span>
      <span className="font-mono text-xs text-muted-foreground">
        🎲 [{ev.dice.join(", ")}]
      </span>
      <span className={`ml-1.5 font-bold tabular-nums ${tone}`}>{ev.total}</span>
      {ev.secret && (
        <span className="ml-1 text-[10px] text-muted-foreground">(秘匿)</span>
      )}
      {(ev.check || ev.detail) && (
        <span className={`ml-1.5 text-xs font-semibold ${tone}`}>
          {ev.check ? levelLabel(ev.check.level) : ev.detail}
        </span>
      )}
    </p>
  );
}
