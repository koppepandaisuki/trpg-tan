"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  grantCreatorAction,
  revokeCreatorAction,
  grantAdminAction,
  revokeAdminAction,
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

  function handle(action: () => Promise<AdminActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-sm">
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
          ID: <code>{user.id.slice(0, 8)}…</code> · 作成 {formatDate(user.createdAt)}
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
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                admin 付与
              </Button>
            )}
          </>
        )}
      </div>
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
