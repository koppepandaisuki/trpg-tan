"use client";

import { useState } from "react";
import { Loader2, ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EnrollResult =
  | { ok: true; factorId: string; qrCodeSvg: string; secret: string }
  | { ok: false; error: string };

type VerifyResult = { ok: true } | { ok: false; error: string };

interface MfaEnrollFlowProps {
  enrollAction: () => Promise<EnrollResult>;
  verifyAction: (input: { factorId: string; code: string }) => Promise<VerifyResult>;
  /** 設定済みで指定時は verify 成功後にハードナビゲーション(管理画面の必須フロー用)。 */
  redirectTo?: string;
  /** redirectTo 未指定時、verify 成功後に呼ばれる(設定ページでの状態更新用)。 */
  onEnrolled?: () => void;
}

/**
 * TOTP(認証アプリ)の新規登録フロー。
 *
 *   1. 「設定する」→ enrollAction() で QR コード + シークレットを取得
 *   2. 認証アプリで読み取り、表示された 6 桁コードを入力
 *   3. verifyAction() で検証(成功すると同時に現在セッションが aal2 に昇格)
 *
 * QR は Supabase が返す SVG 文字列を data URI として <img src> に渡す
 * (dangerouslySetInnerHTML は使わない — Supabase 公式ドキュメントの
 * 推奨パターンに合わせつつ、このコードベースの XSS 対策方針とも一致する)。
 */
export function MfaEnrollFlow({
  enrollAction,
  verifyAction,
  redirectTo,
  onEnrolled,
}: MfaEnrollFlowProps) {
  const [enrolled, setEnrolled] = useState<{
    factorId: string;
    qrCodeSvg: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    const result = await enrollAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEnrolled({
      factorId: result.factorId,
      qrCodeSvg: result.qrCodeSvg,
      secret: result.secret,
    });
  }

  async function submitCode() {
    if (!enrolled) return;
    setBusy(true);
    setError(null);
    const result = await verifyAction({ factorId: enrolled.factorId, code });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }
    onEnrolled?.();
  }

  if (!enrolled) {
    return (
      <div className="space-y-3">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="button" onClick={startEnroll} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldPlus className="h-4 w-4" />
          )}
          二段階認証を設定する
        </Button>
      </div>
    );
  }

  const qrDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(enrolled.qrCodeSvg)}`;

  return (
    <div className="space-y-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrDataUri}
        alt="認証アプリで読み取る QR コード"
        className="mx-auto h-48 w-48"
      />
      <p className="text-center text-xs text-muted-foreground">
        読み取れない場合はこのコードを手入力:{" "}
        <code className="font-mono">{enrolled.secret}</code>
      </p>
      <div className="space-y-1.5">
        <label htmlFor="mfa-enroll-code" className="text-sm font-medium">
          認証アプリに表示された 6 桁のコード
        </label>
        <Input
          id="mfa-enroll-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
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
        onClick={submitCode}
        disabled={busy || code.length !== 6}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        確認して有効化
      </Button>
    </div>
  );
}
