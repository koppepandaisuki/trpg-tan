"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VerifyResult = { ok: true } | { ok: false; error: string };

/**
 * 既に登録済みの TOTP factor への再認証(step-up)フォーム。
 * ログイン直後など、セッションが aal1 のまま管理画面に来たときに
 * 「認証アプリの現在のコードを入力させて aal2 へ昇格させる」ために使う。
 * 新規登録(MfaEnrollFlow)とは異なり QR は出さない。
 */
export function MfaChallengeForm({
  factorId,
  verifyAction,
  redirectTo,
}: {
  factorId: string;
  verifyAction: (input: { factorId: string; code: string }) => Promise<VerifyResult>;
  redirectTo: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await verifyAction({ factorId, code });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.href = redirectTo;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="mfa-challenge-code" className="text-sm font-medium">
          認証アプリの 6 桁コード
        </label>
        <Input
          id="mfa-challenge-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="primary"
        onClick={submit}
        disabled={busy || code.length !== 6}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
        確認する
      </Button>
    </div>
  );
}
