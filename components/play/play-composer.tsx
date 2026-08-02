"use client";

import { forwardRef } from "react";
import { Send, EyeOff } from "lucide-react";
import type { Panel } from "@trpg/core";
import { Button } from "@/components/ui/button";

/** よく使うダイス(ワンクリックで振れる)。 */
const QUICK_DICE = ["1d100", "2d6", "1d6", "1d20", "1d10", "1d4"];

/**
 * チャット入力欄。発言者(駒 or 地の声)の切替 + 定番ダイス + シークレット。
 * Enter で送信、Shift+Enter は改行しない(1 行入力なのでそのまま送信)。
 */
export const PlayComposer = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: (text: string) => void;
    /** 発言できる駒(GM は全部、参加者は自分の駒)。 */
    speakers: Panel[];
    speakerId: string;
    onSpeakerChange: (id: string) => void;
    /** 「自分の名前で喋る」ときの表示名(参加者用)。GM は "GM"。 */
    selfLabel: string;
    secret: boolean;
    onSecretChange: (v: boolean) => void;
    /** シークレットは GM だけが使う(参加者には出さない)。 */
    canSecret: boolean;
    disabled?: boolean;
  }
>(function PlayComposer(
  {
    value,
    onChange,
    onSend,
    speakers,
    speakerId,
    onSpeakerChange,
    selfLabel,
    secret,
    onSecretChange,
    canSecret,
    disabled,
  },
  ref,
) {
  function submit() {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    onChange("");
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-2">
      {/* 発言者 + シークレット */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[10px] font-semibold text-muted-foreground">
          発言者
        </label>
        <select
          value={speakerId}
          onChange={(e) => onSpeakerChange(e.target.value)}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="GM">{selfLabel}</option>
          {speakers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {canSecret && (
          <button
            onClick={() => onSecretChange(!secret)}
            aria-pressed={secret}
            title="シークレットダイス(出目を伏せる)"
            className={[
              "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition",
              secret
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <EyeOff className="h-3 w-3" aria-hidden />
            秘匿
          </button>
        )}
      </div>

      {/* 定番ダイス */}
      <div className="flex flex-wrap gap-1">
        {QUICK_DICE.map((d) => (
          <button
            key={d}
            onClick={() => onSend(d)}
            disabled={disabled}
            className="rounded border border-border px-2 py-0.5 font-mono text-[11px] transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
          >
            {d}
          </button>
        ))}
      </div>

      {/* 入力 */}
      <div className="flex gap-2">
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
          placeholder="発言 / CC<=70 目星 / 2d6+1 …"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <Button onClick={submit} disabled={disabled || !value.trim()} size="sm">
          <Send className="h-3.5 w-3.5" aria-hidden />
          送信
        </Button>
      </div>
    </div>
  );
});
