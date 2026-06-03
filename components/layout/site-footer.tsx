import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * サイト全体のフッター。
 *
 * 構成:
 *   1. ブランド + tagline + α バッジ + Discord 招待ボタン
 *   2. ナビゲーション / 情報 / サポート の 3 列リンク集
 *   3. コピーライト + α 注意書き
 *
 * α 期間中は「準備中」表示の項目があるが、Phase 2 で
 * 利用規約 / プライバシーポリシー / 特商法ページが揃ったら
 * リンクに置き換える。
 *
 * Discord 招待 URL は env `NEXT_PUBLIC_ALPHA_DISCORD_INVITE_URL` を優先、
 * 未設定なら固定の招待コードに fallback(α 期間中は常に有効)。
 *
 * Server Component(状態を持たない)。root layout から mount。
 */

const FALLBACK_DISCORD_URL = "https://discord.gg/HMXx3pbAEz";

function getDiscordUrl(): string {
  return process.env.NEXT_PUBLIC_ALPHA_DISCORD_INVITE_URL || FALLBACK_DISCORD_URL;
}

export function SiteFooter() {
  const discordUrl = getDiscordUrl();
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* ブランド列 */}
          <div className="space-y-3">
            {/* ブランドロゴ。TopHeader と同じ /logo.png を使い回す。
                footer では高さ少し小さめ(h-8)に。 */}
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="パラDa-iCE TRPGサイト ホーム"
            >
              <Image
                src="/logo.png"
                alt="パラDa-iCE TRPGサイト"
                width={340}
                height={190}
                className="h-8 w-auto"
              />
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              シナリオ・アセット・パッケージの
              <br />
              マーケットプレイス
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="muted">α</Badge>
            </div>
            {/* Discord コミュニティリンク(SNS 風)。α 期間中は連絡 / 質問 /
                バグ報告の主チャネルなので、目立つ位置で常設。 */}
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="α テスター Discord サーバーに参加(別タブで開く)"
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition",
                "hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-800",
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Discord で参加する
            </a>
          </div>

          {/* ナビゲーション */}
          <FooterColumn title="ナビゲーション">
            <FooterLink href="/" label="ホーム" />
            <FooterLink href="/store" label="ストアを見る" />
            <FooterLink href="/creator/products/new" label="作品を投稿する" />
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
            {/* α 期間中は Discord が問い合わせの主チャネル。ブランド列の
                ボタンと重複してでも、ナビ脈絡からも辿れるようリンクを置く。 */}
            <FooterExternal
              href={discordUrl}
              label="お問い合わせ — Discord"
              icon={MessageCircle}
            />
            <FooterPlaceholder label="ヘルプ(準備中)" />
            <FooterPlaceholder label="開発者ブログ(準備中)" />
          </FooterColumn>
        </div>

        {/* ボトム行 */}
        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} パラDa-iCE TRPGサイト
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

function FooterExternal({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </a>
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
