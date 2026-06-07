"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInviteAction } from "@/app/(app)/friends/actions";

/** 招待リンクの承認ボタン。成功したらフレンド一覧へ。 */
export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  async function accept() {
    setBusy(true);
    setError(false);
    try {
      const result = await acceptInviteAction(token);
      if (result.ok) {
        setDone(true);
        setTimeout(() => router.push("/friends" as Route), 800);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Button disabled className="w-full">
        <Check className="mr-2 h-4 w-4" /> フレンドになりました
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={accept} disabled={busy} className="w-full">
        <UserPlus className="mr-2 h-4 w-4" /> フレンドになる
      </Button>
      {error && (
        <p className="text-center text-sm text-destructive">
          リンクが無効か、期限切れの可能性があります。
        </p>
      )}
    </div>
  );
}
