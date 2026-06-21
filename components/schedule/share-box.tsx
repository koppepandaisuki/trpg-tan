"use client";

import * as React from "react";
import { Copy, Check, Link2, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 共有URL(全員に配る)と、管理URL(主催だけが持つ)をコピーできる箱。
 * 管理URLは adminToken があるとき = 主催が管理用リンクで開いているときだけ出す。
 */
export function ShareBox({
  publicToken,
  adminToken,
}: {
  publicToken: string;
  adminToken: string | null;
}) {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  const publicUrl = origin ? `${origin}/schedule/${publicToken}` : "";
  const adminUrl =
    origin && adminToken
      ? `${origin}/schedule/${publicToken}?admin=${adminToken}`
      : "";

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <CopyRow
        icon={<Link2 className="h-4 w-4" />}
        label="共有URL（参加者に配る）"
        url={publicUrl}
      />
      {adminUrl && (
        <CopyRow
          icon={<Settings2 className="h-4 w-4" />}
          label="管理URL（あなた専用・候補の確定や削除に必要）"
          url={adminUrl}
          danger
        />
      )}
    </div>
  );
}

function CopyRow({
  icon,
  label,
  url,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  url: string;
  danger?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボード不可環境は無視(ユーザーが手で選択コピーできる)。
    }
  }
  return (
    <div>
      <div
        className={cn(
          "mb-1 flex items-center gap-1.5 text-xs font-medium",
          danger ? "text-amber-600" : "text-muted-foreground",
        )}
      >
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-full truncate rounded-md border border-border bg-muted/40 px-2 text-xs"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              コピー済
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              コピー
            </>
          )}
        </button>
      </div>
    </div>
  );
}
