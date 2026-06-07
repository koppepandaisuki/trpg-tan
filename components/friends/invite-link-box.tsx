"use client";

import { useState } from "react";
import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ensureInviteTokenAction,
  regenerateInviteTokenAction,
} from "@/app/(app)/friends/actions";

/**
 * 招待リンクの発行・表示・コピー・再発行。
 * トークンが無い初回は「作成」ボタン、以降は URL とコピー/再発行。
 */
export function InviteLinkBox({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/friends/invite/${token}`
    : "";

  async function create() {
    setBusy(true);
    try {
      setToken(await ensureInviteTokenAction());
    } finally {
      setBusy(false);
    }
  }
  async function regenerate() {
    setBusy(true);
    try {
      setToken(await regenerateInviteTokenAction());
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* クリップボード不可環境は無視(手動選択でコピー可能) */
    }
  }

  if (!token) {
    return (
      <Button onClick={create} disabled={busy}>
        <Link2 className="mr-2 h-4 w-4" /> 招待リンクを作成
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
          aria-label="招待リンク"
        />
        <Button type="button" variant="secondary" onClick={copy} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="ml-1.5 hidden sm:inline">
            {copied ? "コピー済み" : "コピー"}
          </span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        このリンクを送ると、相手が開いて承認するだけでフレンドになれます。
        <button
          type="button"
          onClick={regenerate}
          disabled={busy}
          className="ml-1 inline-flex items-center gap-1 underline transition hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className="h-3 w-3" /> 再発行
        </button>
      </p>
    </div>
  );
}
