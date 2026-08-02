"use client";

import { useState } from "react";
import { Heart, Droplet, Brain, Diamond, Eye, EyeOff, X } from "lucide-react";
import type { Panel, PanelResource, PanelStat } from "@trpg/core";

/**
 * 卓上のキャラ駒 1 枚(サイドバー)。
 *
 * デスクトップ版 PlayPanel と同じ操作感:
 *   - HP/MP/SAN 等のリソースを ± で増減
 *   - 能力値/技能ボタン: クリックで入力欄へ、ダブルクリックで即ロール
 *   - チャットパレット(1 行 1 コマンド)
 */

function resourceIcon(key: string) {
  const k = key.toLowerCase();
  if (k === "hp") return <Heart className="h-3 w-3 text-red-600" aria-hidden />;
  if (k === "mp") return <Droplet className="h-3 w-3 text-sky-600" aria-hidden />;
  if (k === "san") return <Brain className="h-3 w-3 text-violet-600" aria-hidden />;
  return <Diamond className="h-3 w-3 text-muted-foreground" aria-hidden />;
}

/** CoC 駒か(能力値ラベルの流儀を分ける)。 */
function isCoCPanel(panel: Panel): boolean {
  return (
    panel.systemId === "coc6" || panel.systemId === "coc7" || !!panel.edition
  );
}

/** 能力値は CoC のみ英語キー(STR 等)、他システムは自前のラベル。 */
function statLabel(s: PanelStat, panel: Panel): string {
  if (s.kind === "characteristic" && isCoCPanel(panel)) return s.key;
  return s.label || s.key;
}

/** 能力値/技能をクリックしたときのダイスコマンド。 */
export function cmdFor(s: PanelStat, panel: Panel): string {
  const label = statLabel(s, panel);
  if (panel.checkTemplate) {
    let cmd = panel.checkTemplate.replace(/\{value\}/g, String(s.target));
    // 雛形に残った目標値プレースホルダ「?」を解決(? のままだと振れない)。
    if (cmd.includes("?")) {
      if (/<=\s*\?/.test(cmd)) {
        cmd = cmd.replace(/<=\s*\?/g, `<=${s.target}`);
      } else {
        cmd = cmd.replace(/\s*>=\s*\?.*$/, "").trim();
      }
    }
    return `${cmd} ${label}`;
  }
  if (isCoCPanel(panel)) return `CC<=${s.target} ${label}`;
  return `${label} ${s.target}`;
}

function parsePalette(text: string): { text: string; comment: boolean }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      l.startsWith("#") || l.startsWith("//")
        ? { text: l.replace(/^#+\s*|^\/\/\s*/, ""), comment: true }
        : { text: l, comment: false },
    );
}

export function PlayPanelCard({
  panel,
  canControl,
  onResource,
  onFill,
  onSend,
  onRemove,
  onToggleHidden,
}: {
  panel: Panel;
  /** この駒を操作できるか(GM は全部、参加者は自分の駒のみ)。 */
  canControl: boolean;
  onResource: (panel: Panel, resource: PanelResource, delta: number) => void;
  /** クリック: 入力欄へ流し込む。 */
  onFill: (text: string) => void;
  /** ダブルクリック: 即ロール。 */
  onSend: (text: string) => void;
  onRemove?: (panel: Panel) => void;
  onToggleHidden?: (panel: Panel) => void;
}) {
  const [open, setOpen] = useState(false);
  const characteristics = panel.stats.filter((s) => s.kind === "characteristic");
  const skills = panel.stats.filter((s) => s.kind === "skill");
  const palette = parsePalette(panel.palette ?? "");

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-background"
      style={{ borderTopColor: panel.color, borderTopWidth: 3 }}
    >
      {/* ヘッダー(クリックで展開) */}
      <div className="flex items-center gap-2 p-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          title={open ? "折りたたむ" : "展開する"}
        >
          <span className="text-[10px] text-muted-foreground">
            {open ? "▾" : "▸"}
          </span>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] text-white"
            style={{ background: panel.color }}
          >
            {panel.portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={panel.portrait}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              "👤"
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-1 text-xs font-bold">{panel.name}</span>
            <span className="line-clamp-1 text-[10px] text-muted-foreground">
              {panel.source === "token"
                ? "トークン"
                : (panel.systemName ?? "キャラクター")}
            </span>
          </span>
        </button>
        {canControl && onToggleHidden && (
          <button
            onClick={() => onToggleHidden(panel)}
            title={panel.hidden ? "盤面に表示する" : "盤面から隠す"}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {panel.hidden ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        )}
        {canControl && onRemove && (
          <button
            onClick={() => onRemove(panel)}
            title="卓から外す"
            className="shrink-0 text-muted-foreground hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      {/* リソース(折りたたみ中も出す = 卓で一番見る値) */}
      {panel.resources.length > 0 && (
        <div className="space-y-1 px-2 pb-2">
          {panel.resources.map((r) => (
            <div key={r.key} className="flex items-center gap-1.5">
              <span className="flex flex-1 items-center gap-1 text-[11px] font-medium">
                {resourceIcon(r.key)}
                {r.label}
              </span>
              {canControl && (
                <button
                  onClick={() => onResource(panel, r, -1)}
                  className="h-5 w-5 rounded border border-border text-xs leading-none hover:bg-muted"
                  title="-1"
                >
                  −
                </button>
              )}
              <span className="min-w-[46px] text-center text-xs font-bold tabular-nums">
                {r.current}
                <span className="text-[10px] font-normal text-muted-foreground">
                  /{r.max}
                </span>
              </span>
              {canControl && (
                <button
                  onClick={() => onResource(panel, r, 1)}
                  className="h-5 w-5 rounded border border-border text-xs leading-none hover:bg-muted"
                  title="+1"
                >
                  ＋
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-2 border-t border-border px-2 py-2">
          {/* 能力値 */}
          {characteristics.length > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {characteristics.map((s) => (
                <button
                  key={s.key}
                  onClick={() => onFill(cmdFor(s, panel))}
                  onDoubleClick={() => onSend(cmdFor(s, panel))}
                  title={`${s.label} ─ クリック: 入力欄に / ダブルクリック: 即ロール`}
                  className="rounded border border-border bg-muted/40 px-1 py-1 text-center transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="block text-[9px] text-muted-foreground">
                    {statLabel(s, panel)}
                  </span>
                  <span className="block text-xs font-bold tabular-nums">
                    {s.target}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 技能 */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skills.map((s) => (
                <button
                  key={s.key}
                  onClick={() => onFill(cmdFor(s, panel))}
                  onDoubleClick={() => onSend(cmdFor(s, panel))}
                  title="クリック: 入力欄に / ダブルクリック: 即ロール"
                  className="rounded-full border border-border px-2 py-0.5 text-[10.5px] transition hover:border-primary/40 hover:bg-primary/5"
                >
                  {s.label} <b className="tabular-nums">{s.target}</b>
                </button>
              ))}
            </div>
          )}

          {/* チャットパレット */}
          {palette.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground">
                チャパレ
              </p>
              {palette.map((ln, i) =>
                ln.comment ? (
                  <p
                    key={i}
                    className="px-1 pt-1 text-[10px] font-bold text-muted-foreground"
                  >
                    {ln.text}
                  </p>
                ) : (
                  <button
                    key={i}
                    onClick={() => onFill(ln.text)}
                    onDoubleClick={() => onSend(ln.text)}
                    title="クリック: 入力欄に / ダブルクリック: 即ロール"
                    className="block w-full truncate rounded border border-border px-2 py-1 text-left text-[11px] transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    {ln.text}
                  </button>
                ),
              )}
            </div>
          )}

          {panel.note?.trim() && (
            <p className="whitespace-pre-wrap rounded bg-muted/50 p-1.5 text-[10.5px] text-muted-foreground">
              {panel.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
