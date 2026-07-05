"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MfaEnrollFlow } from "@/components/account/mfa-enroll-flow";
import {
  enrollMfaAction,
  verifyMfaAction,
  unenrollMfaAction,
} from "@/app/(app)/account/settings/actions";

/**
 * 設定ページの「二段階認証」パネル(任意)。
 * 有効/無効の表示切替と、無効時の登録フロー(MfaEnrollFlow)を出し分ける。
 */
export function MfaStatusPanel({
  initialFactor,
}: {
  initialFactor: { id: string; friendlyName: string | null } | null;
}) {
  const [hasFactor, setHasFactor] = useState(initialFactor !== null);
  const [factorId] = useState(initialFactor?.id ?? null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disable() {
    if (!factorId) return;
    if (!window.confirm("二段階認証を無効にしますか?")) return;
    setBusy(true);
    setError(null);
    const result = await unenrollMfaAction(factorId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setHasFactor(false);
  }

  if (hasFactor) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm text-emerald-700">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          二段階認証は有効です
        </p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={disable}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          無効にする
        </Button>
      </div>
    );
  }

  if (!showEnroll) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldOff className="h-4 w-4" aria-hidden />
          二段階認証は未設定です
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowEnroll(true)}
        >
          設定する
        </Button>
      </div>
    );
  }

  return (
    <MfaEnrollFlow
      enrollAction={enrollMfaAction}
      verifyAction={verifyMfaAction}
      onEnrolled={() => window.location.reload()}
    />
  );
}
