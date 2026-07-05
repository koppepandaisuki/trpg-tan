"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Store,
  Upload,
  Library,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 初回ログイン / 初回訪問時に表示されるオンボーディング tour。
 *
 * 5 ステップでサイトの主要機能(ようこそ → ストア → 投稿 → ライブラリ →
 * Discord)を一気に紹介する。α テスター UX の総仕上げ。
 *
 * 仕様:
 *  - localStorage キー TOUR_STORAGE_KEY で「閉じた」or「完了」を記録
 *  - 表示判定は mount 時に 1 度だけ。Hydration を避けるため client only
 *  - Skill: 「閉じる」(後で再表示可)/「あとで」(同上)/「始める」(完了)
 *  - フッターから「ガイドを再表示」リンクで強制再表示できる
 *    (本コンポーネントを window.event 経由で開く別ボタンを用意)
 *  - Escape / backdrop クリックで close
 *
 * デザイン:
 *  - 半透明 backdrop + 中央固定 panel(max-w-md)
 *  - 各ステップにアイコン + タイトル + 説明 + 主アクションリンク
 *  - 進捗インジケータ(dots)
 *  - 「Discord で質問する」を常時 footer に表示
 */

const TOUR_STORAGE_KEY = "paradice_welcome_tour_v1";

// 別所(フッター等)から tour を再表示するための CustomEvent 名
const REOPEN_EVENT = "paradice:open-welcome-tour";

interface Step {
  icon: LucideIcon;
  iconTone: "indigo" | "emerald" | "amber" | "violet" | "rose";
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    iconTone: "violet",
    title: "ようこそ、Re-dice TRPGサイトへ",
    description:
      "シナリオ・アセット・パッケージを 作る・買う・遊ぶ。\n2 分でサイトの主要機能を見ていきましょう。",
  },
  {
    icon: Store,
    iconTone: "indigo",
    title: "ストアで作品を探す",
    description:
      "公開中の作品をカテゴリで絞り込んで探せます。トップページの「売上上位」「新着」も入口です。",
    primaryLabel: "ストアを見る",
    primaryHref: "/store",
  },
  {
    icon: Upload,
    iconTone: "amber",
    title: "自分の作品を投稿する",
    description:
      "α 期間中は登録すると自動で creator 権限が付与されます。すぐに作品を投稿できます。\n高度なビルダーは Phase 2 で Desktop App として提供予定。",
    primaryLabel: "作品を投稿する",
    primaryHref: "/creator/products/new",
  },
  {
    icon: Library,
    iconTone: "emerald",
    title: "ライブラリで購入作品を管理",
    description:
      "購入した作品はライブラリにまとめて表示されます。ダウンロードや状態確認はここから。",
    primaryLabel: "ライブラリを見る",
    primaryHref: "/library",
  },
  {
    icon: MessageCircle,
    iconTone: "rose",
    title: "Discord でフィードバック",
    description:
      "α 期間中の不具合報告・改善要望・新機能のリクエストは Discord でお気軽に。テスターの声で品質を上げていきます。",
    primaryLabel: "Discord に参加",
    primaryHref: "https://discord.gg/HMXx3pbAEz",
  },
];

const ICON_TONE_CLASSES: Record<Step["iconTone"], string> = {
  indigo: "border-sky-200 bg-sky-50 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // 初回 mount 時に localStorage を確認して「初回」なら自動で開く。
  // SSR との不整合を避けるため、useEffect(client only)で行う。
  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(TOUR_STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      // localStorage が disable(プライベートブラウジング等)の場合は
      // 表示しない方が安全(毎回出るのを避ける)
    }
  }, []);

  // 別所(フッターの「使い方ガイド」)から開けるよう CustomEvent を購読
  useEffect(() => {
    function onReopen() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener(REOPEN_EVENT, onReopen);
    return () => window.removeEventListener(REOPEN_EVENT, onReopen);
  }, []);

  // Escape で閉じる(完了済として記録)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 開いている間 body scroll lock
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function close() {
    try {
      window.localStorage.setItem(TOUR_STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setOpen(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLastStep = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="閉じる(背景)"
        onClick={close}
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Header(BrandMark + 閉じる)*/}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <BrandMark size="sm" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={close}
            aria-label="ガイドを閉じる"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-7 text-center">
          <div
            className={cn(
              "mx-auto flex h-14 w-14 items-center justify-center rounded-full border",
              ICON_TONE_CLASSES[current.iconTone],
            )}
          >
            <Icon className="h-7 w-7" aria-hidden />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Step {step + 1} / {STEPS.length}
            </p>
            <h2
              id="welcome-tour-title"
              className="text-xl font-semibold tracking-tight"
            >
              {current.title}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {current.description}
            </p>
          </div>

          {/* Primary action(Discord は外部リンク、その他は内部)*/}
          {current.primaryHref && current.primaryLabel && (
            <div className="pt-1">
              {current.primaryHref.startsWith("http") ? (
                <a
                  href={current.primaryHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                  className={cn(
                    buttonVariants({ variant: "primary", size: "sm" }),
                    "inline-flex",
                  )}
                >
                  {current.primaryLabel}
                </a>
              ) : (
                <Link
                  href={current.primaryHref as never}
                  onClick={close}
                  className={cn(
                    buttonVariants({ variant: "primary", size: "sm" }),
                    "inline-flex",
                  )}
                >
                  {current.primaryLabel}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div
          className="flex items-center justify-center gap-1.5 pb-3"
          aria-hidden
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-4 bg-foreground" : "w-1.5 bg-muted",
              )}
            />
          ))}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={close}
            className="text-xs"
          >
            あとで
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={next}
          >
            {isLastStep ? "始める" : "次へ"}
            {!isLastStep && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * フッターやメニュー等の任意の場所から tour を再表示するための button。
 * 内部で CustomEvent を dispatch して、WelcomeTour 側が購読して開く。
 */
export function OpenWelcomeTourButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        try {
          // 強制再表示するため、保存済 flag も消す(次回 mount でも自動で
          // 開くようにしておきたい場合は残してもよい。今回は明示的に開く
          // 動作なので flag は残しつつ event だけ投げる)
          window.dispatchEvent(new CustomEvent("paradice:open-welcome-tour"));
        } catch {
          // SSR safety
        }
      }}
    >
      {children ?? "使い方ガイドを再表示"}
    </button>
  );
}
