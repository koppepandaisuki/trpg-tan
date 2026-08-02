"use client";

import { useState } from "react";
import { ClipboardCheck, Copy, Download, ScrollText } from "lucide-react";
import { replayToText, replayToHtml, type PlayScene } from "@trpg/core";

/**
 * リプレイ書き出し(Web 版)。
 *
 * デスクトップ版はネイティブの保存ダイアログを使うが、ブラウザには無いので
 * Blob → <a download> でダウンロードさせる。整形ロジック本体は
 * `@trpg/core` の replayToText / replayToHtml を共有しているので、
 * デスクトップと同じ出力になる。
 *
 * 参加者(GM でない)は、見る権利の無いシークレットダイスの出目を
 * 書き出せない(canSee で伏せる)。
 */
export function PlayReplayButton({
  scene,
  isGm,
  myPanelIds = [],
}: {
  scene: PlayScene;
  isGm: boolean;
  /** 自分の駒 id 群(シークレットの visibleTo 判定用)。 */
  myPanelIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  /** ログのチャンネル/駒 id → 表示名(デスクトップ版 logNameOf と同じ)。 */
  const nameOf = (id?: string) =>
    id ? (scene.panels.find((p) => p.id === id)?.name ?? id) : "メイン";

  /** 参加者視点で秘匿ロールの出目を書き出してよいか。GM は常に可。 */
  const canSee = isGm
    ? undefined
    : (ev: { visibleTo?: string[] }) =>
        (ev.visibleTo ?? []).some((id) => myPanelIds.includes(id));

  const base = scene.title?.trim() || "session";

  function download(text: string, filename: string, mime: string) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    // クリック直後に revoke するとダウンロードが始まらないブラウザがあるので少し待つ。
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setOpen(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        replayToText(scene.log, nameOf, canSee),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* クリップボードが使えない環境(権限拒否など)は黙って何もしない */
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={scene.log.length === 0}
        title={
          scene.log.length === 0
            ? "まだログがありません"
            : "リプレイを書き出す"
        }
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs transition hover:bg-muted disabled:opacity-40"
      >
        <ScrollText className="h-3.5 w-3.5" aria-hidden />
        リプレイ
      </button>

      {open && (
        <>
          {/* 外側クリックで閉じる */}
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
            <MenuItem
              icon={<Download className="h-3.5 w-3.5" aria-hidden />}
              label="テキストで保存(.txt)"
              hint="そのまま貼れる素のログ"
              onClick={() =>
                download(
                  replayToText(scene.log, nameOf, canSee),
                  `${base}-log.txt`,
                  "text/plain;charset=utf-8",
                )
              }
            />
            <MenuItem
              icon={<Download className="h-3.5 w-3.5" aria-hidden />}
              label="清書リプレイ(.html)"
              hint="色・時刻つき。そのまま公開できる"
              onClick={() =>
                download(
                  replayToHtml(scene.log, nameOf, scene.title || "セッション"),
                  `${base}-replay.html`,
                  "text/html;charset=utf-8",
                )
              }
            />
            <MenuItem
              icon={
                copied ? (
                  <ClipboardCheck
                    className="h-3.5 w-3.5 text-emerald-600"
                    aria-hidden
                  />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )
              }
              label={copied ? "コピーしました" : "クリップボードへコピー"}
              hint="Discord などへ貼る用"
              onClick={() => void copy()}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-muted"
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[10.5px] text-muted-foreground">
          {hint}
        </span>
      </span>
    </button>
  );
}
