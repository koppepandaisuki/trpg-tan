"use client";

import * as React from "react";
import { Loader2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  grantCreatorAction,
  revokeCreatorAction,
  grantAdminAction,
  revokeAdminAction,
  adjustGoldAction,
  type AdminActionResult,
} from "@/app/(app)/admin/users/actions";
import type { AdminUserRow } from "@/lib/queries/admin";

interface UserRowProps {
  user: AdminUserRow;
  /** Disable action buttons for the current admin's own row. */
  isSelf: boolean;
}

export function UserRow({ user, isSelf }: UserRowProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [goldOpen, setGoldOpen] = React.useState(false);
  const [goldAmount, setGoldAmount] = React.useState("");
  const [goldNote, setGoldNote] = React.useState("");
  const [goldPending, startGoldTransition] = React.useTransition();
  const [goldError, setGoldError] = React.useState<string | null>(null);
  const [goldBalance, setGoldBalance] = React.useState(user.goldBalance);

  function handle(action: () => Promise<AdminActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  function submitGoldAdjust() {
    const amount = Math.trunc(Number(goldAmount));
    if (!Number.isFinite(amount) || amount === 0) {
      setGoldError("金額を入力してください(0以外の整数)");
      return;
    }
    const verb = amount > 0 ? "付与" : "減算";
    if (
      !window.confirm(
        `「${user.displayName || "このユーザー"}」に ${Math.abs(amount).toLocaleString()} ゴールドを${verb}しますか？`,
      )
    )
      return;
    setGoldError(null);
    startGoldTransition(async () => {
      const result = await adjustGoldAction(user.id, amount, goldNote);
      if (!result.ok) {
        setGoldError(result.message);
        return;
      }
      setGoldBalance(result.balance);
      setGoldAmount("");
      setGoldNote("");
      setGoldOpen(false);
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">
              {user.displayName || "(名称未設定)"}
            </p>
            {user.isAdmin && <Badge variant="category">admin</Badge>}
            {user.isCreator && <Badge variant="muted">creator</Badge>}
            {isSelf && <Badge variant="default">あなた</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            ID: <code>{user.id.slice(0, 8)}…</code> · 作成{" "}
            {formatDate(user.createdAt)} ·{" "}
            <Coins className="inline h-3 w-3 align-text-bottom" />{" "}
            {goldBalance.toLocaleString()} G
          </p>
          {error && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSelf ? (
            <span className="text-xs text-muted-foreground">操作不可</span>
          ) : (
            <>
              {user.isCreator ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => handle(() => revokeCreatorAction(user.id))}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  creator 剥奪
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={pending}
                  onClick={() => handle(() => grantCreatorAction(user.id))}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  creator 付与
                </Button>
              )}
              {user.isAdmin ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `「${user.displayName || "このユーザー"}」の admin 権限を剥奪しますか？`,
                      )
                    )
                      return;
                    handle(() => revokeAdminAction(user.id));
                  }}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  admin 剥奪
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `「${user.displayName || "このユーザー"}」に admin 権限を付与しますか？\n（ストア審査・全権操作・全商品の無料 DL ができるようになります）`,
                      )
                    )
                      return;
                    handle(() => grantAdminAction(user.id));
                  }}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  admin 付与
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGoldOpen((v) => !v)}
              >
                <Coins className="h-4 w-4" />
                ゴールド調整
              </Button>
            </>
          )}
        </div>
      </div>

      {goldOpen && !isSelf && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-2">
          <Input
            type="number"
            step={1}
            value={goldAmount}
            onChange={(e) => setGoldAmount(e.target.value)}
            placeholder="±金額 (例: 100 / -50)"
            className="w-40"
          />
          <Input
            type="text"
            value={goldNote}
            onChange={(e) => setGoldNote(e.target.value)}
            placeholder="理由(任意・監査ログに記録)"
            className="w-56"
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={goldPending}
            onClick={submitGoldAdjust}
          >
            {goldPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            適用
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setGoldOpen(false);
              setGoldError(null);
            }}
          >
            閉じる
          </Button>
          {goldError && (
            <p role="alert" className="w-full text-xs text-destructive">
              {goldError}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
