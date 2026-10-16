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
 * システム選択 UI のビジュアル(線画アイコン)。
 *
 * データ層(SystemDef.icon = 絵文字)には手を入れず、表示側だけを
 * 「タイル + 線画アイコン」に差し替えるためのマッピング。色はどのシステムも同じ
 * (墨の線画、触れたら紅。decisions.md D-105)。自作システム(ビルダー製)は
 * ユーザーが選んだ絵文字をタイル内に出す。
 */

export type SystemVisual = { Icon: LucideIcon };

export const SYSTEM_VISUALS: Record<string, SystemVisual> = {
  // CoC(専用エディタ)
  coc7: { Icon: Skull },
  coc6: { Icon: Skull },
  // ビルダーのプリセット
  "preset-sw25": { Icon: Swords },
  "preset-dx3": { Icon: Dna },
  "preset-shinobigami": { Icon: Moon },
  "preset-paranoia": { Icon: Cpu },
  "preset-tnova": { Icon: WalletCards },
  "preset-yuyake": { Icon: Sunset },
  "preset-nechronica": { Icon: HeartCrack },
  "preset-emoklore": { Icon: Eye },
  "preset-insane": { Icon: Brain },
  "preset-magicalogia": { Icon: BookMarked },
  "preset-arianrhod2e": { Icon: Shield },
  "preset-loghorizon": { Icon: Castle },
  "preset-dnd5e": { Icon: Dices },
};

/**
 * システムのアイコンタイル。既知のシステムは線画アイコン、
 * 未知(自作)は絵文字をタイル内に表示。
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
  return (
    <span className={`sysic ${size}`} aria-hidden>
      {v ? <v.Icon /> : <span className="sysic-emoji">{emoji || "🎲"}</span>}
    </span>
  );
}
