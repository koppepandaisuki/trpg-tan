"use client";

import { useEffect } from "react";

/**
 * Root レベルの Error Boundary。app/layout.tsx 自体の描画やプロバイダで
 * エラーが起きたとき、Next.js は本ファイルにフォールバックする。
 *
 * 制約:
 *  - 独自に <html><body> をレンダリングする必要がある(layout は壊れた前提)
 *  - TopHeader / SiteFooter / Tailwind すら使えない可能性があるので、
 *    インラインスタイルでブランド色だけ最小限当てる
 *  - 「ここまで来たらリカバリ困難」なので reset() ボタンと「トップへ」だけ
 *
 * 通常の Route エラーは app/error.tsx が処理するため、本ファイルが
 * 発火することは稀(layout / RootProvider の TypeError 等)。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global-error.tsx] caught:", error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          color: "#0f172a",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            !
          </div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#64748b",
              margin: "0 0 8px",
            }}
          >
            Critical error
          </p>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              margin: "0 0 8px",
              letterSpacing: "-0.01em",
            }}
          >
            重大なエラーが発生しました
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#64748b",
              margin: "0 0 16px",
            }}
          >
            アプリ全体の初期化に失敗しました。ページを再読込みして、それでも解消しない場合は Discord でご連絡ください。
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                color: "#64748b",
                margin: "0 0 16px",
              }}
            >
              digest: {error.digest}
            </p>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#0f172a",
                color: "white",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              再読込み
            </button>
            <a
              href="/"
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#0f172a",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                display: "inline-block",
                boxSizing: "border-box",
              }}
            >
              トップへ戻る
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
