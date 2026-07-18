import Link from "next/link";
import type { Route } from "next";
import { DieFace } from "./die-face";

/**
 * 「作品を遊ぶには Re-dice アプリが必要」バナー(Re-dice Store.dc.html)。
 * ストアの購買体験とデスクトップアプリの関係を最初に明示し、DL 導線を
 * /download(最新 setup.exe への直リンクを持つページ)へつなぐ。
 *
 * デザインのダミー文言のうち事実と異なる箇所だけ実態に合わせている:
 *  - 対応 OS: Windows のみ(Mac 版は未提供)
 *  - スマホ: ブラウザから卓への参加のみベータ対応(PWA)
 */
export function AppBanner() {
  return (
    <section id="app" aria-label="アプリのダウンロード" className="scroll-mt-24">
      <div className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-[18px] border-[1.5px] border-[#B02832]/45 bg-gradient-to-r from-[#FFF8EF] to-white to-55% p-5 shadow-[0_10px_30px_rgba(94,52,24,.10)] sm:p-6">
        {/* 右下の薄い装飾ダイス */}
        <DieFace
          face={5}
          size={74}
          color="rgba(201,162,39,.25)"
          className="absolute -bottom-[18px] -right-3.5 rotate-[-14deg]"
          style={{ position: "absolute" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dice.png"
          alt="Re-dice アプリ"
          className="relative h-[70px] w-[70px] shrink-0 rounded-2xl shadow-[0_10px_24px_rgba(176,40,50,.28),0_0_0_1px_rgba(176,40,50,.15)]"
        />
        <div className="relative flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#B02832] px-2.5 py-[3px] text-[10.5px] font-extrabold tracking-wide text-white">
              プレイには必須
            </span>
            <span className="text-[11px] font-bold tracking-[0.18em] text-[#8a6a2a]">
              RE-DICE APP
            </span>
          </div>
          <h2 className="font-serif text-[19px] font-bold leading-[1.4]">
            作品を遊ぶには、<span className="text-[#B02832]">Re-diceアプリ</span>
            が必要です。
          </h2>
          <p className="text-xs leading-[1.7] text-muted-foreground">
            購入した作品はPC版アプリに自動で同期。セッションの進行・ダイスロール・キャラシ管理まで、すべてアプリの中で完結します。
          </p>
        </div>
        <div className="relative flex shrink-0 flex-col items-stretch gap-2 sm:ml-auto">
          <Link
            href={"/download" as Route}
            className="flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[#B02832] px-5 text-white shadow-[0_10px_24px_rgba(176,40,50,.32)] transition hover:bg-[#93202A]"
          >
            <span className="text-base" aria-hidden>
              ⤓
            </span>
            <span className="flex flex-col leading-[1.25]">
              <span className="text-[9px] text-white/80">FOR WINDOWS</span>
              <span className="text-[13.5px] font-extrabold">
                PC版を無料ダウンロード
              </span>
            </span>
          </Link>
          <span className="text-center text-[10.5px] text-muted-foreground">
            スマホは卓への参加のみブラウザ対応(ベータ)
          </span>
        </div>
      </div>
    </section>
  );
}
