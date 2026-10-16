import Link from "next/link";
import type { Route } from "next";
import { Mail, MessageCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand/brand-mark";
import { OpenWelcomeTourButton } from "@/components/onboarding/welcome-tour";
import { getOperator } from "@/lib/legal/operator";
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
  const { email } = getOperator();
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* ブランド列 */}
          <div className="space-y-3">
            {/* ブランドロゴ。TopHeader と同じ BrandMark を使い回す。 */}
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="Re-dice TRPGサイト ホーム"
            >
              <BrandMark size="md" />
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              卓を立てて、すぐ遊ぶ。
              <br />
              TRPG オンラインセッション
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
                "inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition",
                "hover:bg-ink/85",
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Discord で参加する
            </a>
          </div>

          {/* ナビゲーション */}
          <FooterColumn title="ナビゲーション">
            <FooterLink href="/" label="ホーム" />
            <FooterLink href={"/play" as Route} label="PLAY" />
            <FooterLink href="/library" label="ライブラリ" />
            <FooterLink href={"/characters" as Route} label="キャラシ" />
            <FooterLink href={"/schedule/new" as Route} label="日程調整" />
            <FooterLink href={"/friends" as Route} label="フレンド" />
            <FooterLink href={"/download" as Route} label="アプリをダウンロード" />
            <FooterLink href={"/pricing" as Route} label="料金プラン" />
          </FooterColumn>

          {/* 情報(SSSSS で実ページに差替)*/}
          <FooterColumn title="情報">
            <FooterLink href="/terms" label="利用規約" />
            <FooterLink href="/privacy" label="プライバシーポリシー" />
            <FooterLink
              href={"/legal/guidelines" as Route}
              label="コミュニティガイドライン"
            />
            <FooterLink href={"/legal/rights" as Route} label="権利表記・対応システム" />
            <FooterLink href={"/legal/licenses" as Route} label="OSS ライセンス" />
            <FooterLink
              href="/legal/tokushoho"
              label="特定商取引法に基づく表記"
            />
          </FooterColumn>

          {/* サポート */}
          <FooterColumn title="サポート">
            {/* お問い合わせはメール(Discord を使わない人のため)と Discord の両方。 */}
            {email && (
              <li>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  お問い合わせ(メール)
                </a>
              </li>
            )}
            <FooterExternal
              href={discordUrl}
              label="Discord コミュニティ"
              icon={MessageCircle}
            />
            {/* 初回ガイドを再表示するトリガー。テスターが「あれ何だっけ」
                となったときに、いつでも再確認できるようにする。 */}
            <li>
              <OpenWelcomeTourButton className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                使い方ガイドを開く
              </OpenWelcomeTourButton>
            </li>
            <FooterLink href="/help" label="ヘルプ・よくある質問" />
          </FooterColumn>
        </div>

        {/* ボトム行 */}
        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Re-dice TRPGサイト
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

