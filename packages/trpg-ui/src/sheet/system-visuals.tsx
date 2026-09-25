import type { LucideIcon } from "lucide-react";
import {
  Skull,
  Swords,
  Dna,
  Moon,
  Cpu,
  WalletCards,
  Sunset,
  HeartCrack,
  Eye,
  Brain,
  BookMarked,
  Shield,
  Castle,
  Dices,
} from "lucide-react";

/**
 * システム選択 UI のビジュアル(アイコン + アクセントカラー)。
 *
 * データ層(SystemDef.icon = 絵文字)には手を入れず、表示側だけを
 * 「色付きタイル + 線画アイコン」に差し替えるためのマッピング。
 * 自作システム(ビルダー製)はユーザーが選んだ絵文字をタイル内に出す。
 */

export type SystemVisual = { Icon: LucideIcon; tone: string };

export const SYSTEM_VISUALS: Record<string, SystemVisual> = {
  // CoC(専用エディタ)
  coc7: { Icon: Skull, tone: "#0ea5e9" },
  coc6: { Icon: Skull, tone: "#8b5cf6" },
  // ビルダーのプリセット
  "preset-sw25": { Icon: Swords, tone: "#f59e0b" },
  "preset-dx3": { Icon: Dna, tone: "#ef4444" },
  "preset-shinobigami": { Icon: Moon, tone: "#6366f1" },
  "preset-paranoia": { Icon: Cpu, tone: "#f43f5e" },
  "preset-tnova": { Icon: WalletCards, tone: "#06b6d4" },
  "preset-yuyake": { Icon: Sunset, tone: "#f97316" },
  "preset-nechronica": { Icon: HeartCrack, tone: "#ec4899" },
  "preset-emoklore": { Icon: Eye, tone: "#a855f7" },
  "preset-insane": { Icon: Brain, tone: "#b91c1c" },
  "preset-magicalogia": { Icon: BookMarked, tone: "#2563eb" },
  "preset-arianrhod2e": { Icon: Shield, tone: "#d97706" },
  "preset-loghorizon": { Icon: Castle, tone: "#059669" },
  "preset-dnd5e": { Icon: Dices, tone: "#dc2626" },
};

/**
 * システムのアイコンタイル。既知のシステムは線画アイコン + 固有色、
 * 未知(自作)は絵文字をタイル内に表示(トーンはブランドのスカイ)。
 * size: sm=最近使ったピル / md=一覧カード / lg=フィーチャーカード。
 */
export function SystemIcon({
  systemId,
  emoji,
  size = "md",
}: {
  systemId: string;
  emoji?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const v = SYSTEM_VISUALS[systemId];
  const style = { "--si-c": v?.tone ?? "#37ace8" } as React.CSSProperties;
  return (
    <span className={`sysic ${size}`} style={style} aria-hidden>
      {v ? <v.Icon /> : <span className="sysic-emoji">{emoji || "🎲"}</span>}
    </span>
  );
}
