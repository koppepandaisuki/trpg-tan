"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccountAction } from "@/app/(app)/account/settings/actions";

/**
 * アカウント削除(退会)フォーム(QQQQQ)。danger zone。
 *
 * 二段階の誤操作防止:
 *  1. 「退会手続きへ」ボタンで confirm 入力欄を開く
 *  2. 「退会する」と入力 → 削除実行
 *
 * 成功時は client 側で /auth/sign-out に POST(session 破棄 + ホーム遷移)。
 * deleteAccountAction が auth.users を消すので、残ったセッション cookie を
 * sign-out で確実にクリアしてからリダイレクトする。
 */
export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setSubmitting(true);
    setError(null);
    const result = await deleteAccountAction(confirm);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    // 成功: session を破棄してホームへ。sign-out route は POST → 303 redirect。
    // 退会済みなので getUser は null になるが、cookie を確実に消すため
    // sign-out フォームを programmatic に submit する。
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/sign-out";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50/50 px-3 py-2 text-xs text-rose-900">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <p className="leading-relaxed">
          退会するとアカウント・プロフィール情報が削除され、元に戻せません。
          購入履歴は匿名化されて保全されます(運用記録のため)。
        </p>
      </div>

      {!open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        >
          退会手続きへ
        </Button>
      ) : (
        <div className="space-y-2">
          <label htmlFor="delete-confirm" className="text-xs font-medium">
            確認のため <span className="font-mono text-rose-700">退会する</span>{" "}
            と入力してください
          </label>
          <Input
            id="delete-confirm"
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="退会する"
            aria-label="退会確認の入力"
            autoComplete="off"
          />
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onDelete}
              disabled={submitting || confirm.trim() !== "退会する"}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              退会する(取り消せません)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setError(null);
              }}
              disabled={submitting}
            >
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
