import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";

/**
 * サイト全体のフッター。
 *
 * 構成:
 *   1. ブランド + tagline + α バッジ
 *   2. ナビゲーション / 情報 / サポート の 3 列リンク集
 *   3. コピーライト + α 注意書き
 *
 * α 期間中は「準備中」表示の項目があるが、Phase 2 で
 * 利用規約 / プライバシーポリシー / 特商法ページが揃ったら
 * リンクに置き換える。
 *
 * Server Component(状態を持たない)。root layout から mount。
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* ブランド列 */}
          <div className="space-y-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2"
              aria-label="TRPG プラットフォーム ホーム"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
                T
              </span>
              <span className="text-sm font-semibold tracking-tight">
                TRPG プラットフォーム
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              シナリオ・アセット・パッケージの
              <br />
              マーケットプレイス
            </p>
            <Badge variant="muted" className="mt-1">
              α
            </Badge>
          </div>

          {/* ナビゲーション */}
          <FooterColumn title="ナビゲーション">
            <FooterLink href="/" label="ホーム" />
            <FooterLink href="/store" label="ストアを見る" />
            <FooterLink href="/creator/products/new" label="作品を出品する" />
            <FooterLink href="/library" label="ライブラリ" />
          </FooterColumn>

          {/* 情報(α 中は placeholder)*/}
          <FooterColumn title="情報">
            <FooterPlaceholder label="利用規約(準備中)" />
            <FooterPlaceholder label="プライバシーポリシー(準備中)" />
            <FooterPlaceholder label="特定商取引法に基づく表記(準備中)" />
          </FooterColumn>

          {/* サポート */}
          <FooterColumn title="サポート">
            <FooterPlaceholder label="お問い合わせ — Discord でご連絡ください" />
            <FooterPlaceholder label="ヘルプ(準備中)" />
            <FooterPlaceholder label="開発者ブログ(準備中)" />
          </FooterColumn>
        </div>

        {/* ボトム行 */}
        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TRPG プラットフォーム
          </p>
          <p className="text-xs text-muted-foreground">
            α 期間中 — 仕様変更・データリセットの可能性があります
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, label }: { href: Route; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground transition hover:text-foreground"
      >
        {label}
      </Link>
    </li>
  );
}

function FooterPlaceholder({ label }: { label: string }) {
  return (
    <li>
      <span className="cursor-default text-sm text-muted-foreground/70">
        {label}
      </span>
    </li>
  );
}
