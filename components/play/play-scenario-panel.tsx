"use client";

import { useMemo, useState } from "react";
import { BookOpenText, Lock, Send } from "lucide-react";
import type { Handout, PlayScene } from "@trpg/core";

/**
 * GM 専用のシナリオパネル(Web 版)。
 *
 *   - このシーン: 読み上げ文(段落ごとにチャットへ流せる)/ GM メモ / 判定
 *   - テキスト: テキストストック(1 行 1 テキスト、# は見出し)
 *   - シナリオ: あらすじ・HO(秘密込み)・NPC(秘密込み)・GM メモ
 *
 * ここに出る情報は参加者へは送られない(@trpg/core の projectForPlayers が
 * 配信前に落とす)。「TRPGシナリオ工房」から作った卓はここが埋まった状態で始まる。
 */
export function PlayScenarioPanel({
  scene,
  onSay,
  members = [],
  onDistribute,
}: {
  scene: PlayScene;
  /** GM(地の声)としてチャットへ流す。 */
  onSay: (text: string) => void;
  /** 卓に参加中の人(入室名)。ハンドアウトの配布先。 */
  members?: string[];
  /** ハンドアウトをその人だけに配る(宛先だけが読める暗号文で届く)。 */
  onDistribute?: (handout: Handout, to: string) => void;
}) {
  const active = scene.scenes?.find((s) => s.id === scene.activeSceneId);
  const info = scene.scenario;
  const stock = useMemo(
    () =>
      (scene.textStock ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [scene.textStock],
  );
  const hasScene = !!(active?.script || active?.gmNote || active?.clues?.length);
  const hasInfo = !!(
    info?.synopsis ||
    info?.gmNotes ||
    info?.handouts?.length ||
    info?.npcs?.length
  );
  const [tab, setTab] = useState<"scene" | "stock" | "info">(
    hasScene ? "scene" : stock.length > 0 ? "stock" : "info",
  );
  if (!hasScene && !hasInfo && stock.length === 0) return null;

  const paragraphs = (active?.script ?? "")
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const tabBtn = (id: typeof tab, label: string, show: boolean) =>
    show && (
      <button
        type="button"
        onClick={() => setTab(id)}
        className={`rounded px-2 py-0.5 text-[11px] ${
          tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
        }`}
      >
        {label}
      </button>
    );

  return (
    <section className="rounded-lg border border-border bg-background">
      <header className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <BookOpenText className="h-3.5 w-3.5 text-primary" aria-hidden />
        <h2 className="flex-1 text-xs font-semibold">シナリオ</h2>
        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden />
          GMのみ
        </span>
      </header>
      <div className="flex gap-1 border-b border-border px-2 py-1.5">
        {tabBtn("scene", "このシーン", hasScene)}
        {tabBtn("stock", `テキスト(${stock.length})`, stock.length > 0)}
        {tabBtn("info", "シナリオ情報", hasInfo)}
      </div>
      <div className="space-y-3 px-3 py-2.5 text-xs leading-relaxed">
        {tab === "scene" && (
          <>
            {!hasScene && (
              <p className="text-muted-foreground">このシーンにはメモがありません。</p>
            )}
            {paragraphs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">読み上げ</p>
                {paragraphs.map((p, i) => (
                  <div key={i} className="group flex items-start gap-1.5">
                    <p className="flex-1 whitespace-pre-wrap">{p}</p>
                    <button
                      type="button"
                      onClick={() => onSay(p)}
                      title="チャットに流す"
                      className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Send className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {active?.gmNote && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">GMメモ</p>
                <p className="whitespace-pre-wrap">{active.gmNote}</p>
              </div>
            )}
            {active?.clues && active.clues.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">手がかり・判定</p>
                <ul className="list-disc pl-4">
                  {active.clues.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {tab === "stock" && (
          <ul className="space-y-1">
            {stock.map((line, i) =>
              line.startsWith("#") ? (
                <li key={i} className="pt-1 text-[11px] font-semibold text-muted-foreground">
                  {line.replace(/^#+\s*/, "")}
                </li>
              ) : (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSay(line)}
                    className="w-full rounded px-1.5 py-1 text-left transition hover:bg-muted"
                    title="クリックでチャットに流す"
                  >
                    {line}
                  </button>
                </li>
              ),
            )}
          </ul>
        )}

        {tab === "info" && info && (
          <>
            {info.synopsis && <p className="whitespace-pre-wrap">{info.synopsis}</p>}
            {info.handouts && info.handouts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">ハンドアウト</p>
                {info.handouts.map((h) => (
                  <div key={h.id} className="rounded border border-border p-2">
                    <p className="font-semibold">
                      {h.label} {h.title}
                    </p>
                    {h.publicText && <p className="whitespace-pre-wrap">{h.publicText}</p>}
                    {h.secretText && (
                      <p className="mt-1 whitespace-pre-wrap text-red-700">
                        秘匿: {h.secretText}
                      </p>
                    )}
                    {onDistribute && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">配る:</span>
                        {members.length === 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            (卓を公開して参加者が入ると選べます)
                          </span>
                        )}
                        {members.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              if (confirm(`${h.label} を「${m}」さんだけに配りますか？`)) onDistribute(h, m);
                            }}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
                            title="この人だけに届きます(他の参加者には見えません)"
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {info.npcs && info.npcs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">NPC</p>
                {info.npcs.map((n) => (
                  <div key={n.id}>
                    <p className="font-semibold">{n.name}</p>
                    {n.note && <p className="whitespace-pre-wrap">{n.note}</p>}
                    {n.secret && (
                      <p className="whitespace-pre-wrap text-red-700">秘密: {n.secret}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {info.gmNotes && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">GMメモ</p>
                <p className="whitespace-pre-wrap">{info.gmNotes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
