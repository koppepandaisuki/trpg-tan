import Link from "next/link";
import type { Route } from "next";
import { DieFace } from "./die-face";

/**
 * クリエイター募集 CTA 帯(Re-dice Store.dc.html)。ヒーローと対になる
 * 逆向きの深紅グラデーション。取り分はデザインのダミー値(90%)ではなく
 * 実際の手数料(基本 30% / Pro 20%)に合わせて「最大80%」と表記する。
 * 導線: 出品フォーム(/creator/products/new)と出品ガイドライン。
 */
export function CreatorCta() {
  return (
    <section aria-label="クリエイター募集">
      <div
        className="relative flex flex-wrap items-center gap-6 overflow-hidden rounded-2xl border border-[#5a1119]/50 p-7 shadow-[0_24px_60px_rgba(90,17,25,.25)] sm:p-8"
        style={{
          background:
            "radial-gradient(120% 140% at 12% 0%, rgba(201,162,39,.26), transparent 46%), linear-gradient(300deg,#7d1a22,#a3202c 55%,#5a1119)",
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(118deg, rgba(255,255,255,.04) 0 1px, transparent 1px 16px)",
          }}
        />
        <DieFace
          face={5}
          size={58}
          color="rgba(243,230,200,.85)"
          className="relative shrink-0 shadow-[0_8px_24px_rgba(0,0,0,.35)]"
          style={{ backgroundColor: "rgba(255,255,255,.08)" }}
        />
        <div className="relative flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
          <h2 className="font-serif text-[22px] font-bold text-white">
            つくった物語が、誰かの卓になる。
          </h2>
          <p className="text-[12.5px] leading-[1.8] text-white/80">
            売上の最大80%がクリエイターに。登録から出品まで、今日のうちに完了します。
          </p>
        </div>
        <div className="relative flex shrink-0 flex-wrap items-center gap-2.5">
          <Link
            href={"/creator/products/new" as Route}
            className="flex h-[46px] items-center rounded-xl bg-gold px-5 text-sm font-extrabold text-[#3d2f0e] shadow-[0_10px_26px_rgba(0,0,0,.3)] transition hover:bg-[#b8931e]"
          >
            出品をはじめる
          </Link>
          <Link
            href={"/guidelines" as Route}
            className="flex h-[46px] items-center rounded-xl border border-white/40 bg-white/[.08] px-[18px] text-[13px] font-bold text-white transition hover:bg-white/[.16]"
          >
            出品ガイドライン
          </Link>
        </div>
      </div>
    </section>
  );
}
