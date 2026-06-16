/**
 * AI 事前審査(モデレーション)の判定値。純粋モジュール(Client/Server 両用)。
 *
 * これは admin の審査を**補助**する助言であり、最終判断は人間(admin)が行う。
 * 自動公開・自動却下はしない(誤判定で正当な作品を弾かないため)。
 *
 *   allow   — TRPG 素材として問題なさそう
 *   flag    — 要確認(境界線・軽微な懸念)。admin が目視すべき
 *   block   — 明確に不適切 / ストアの趣旨外の可能性が高い
 *   skipped — AI 未設定(ANTHROPIC_API_KEY なし)などでスキップ
 *   error   — 解析失敗 / タイムアウト等
 */
export type AiVerdict = "allow" | "flag" | "block" | "skipped" | "error";

export const AI_VERDICT_VALUES: readonly AiVerdict[] = [
  "allow",
  "flag",
  "block",
  "skipped",
  "error",
] as const;

export function isAiVerdict(value: unknown): value is AiVerdict {
  return (
    typeof value === "string" &&
    (AI_VERDICT_VALUES as readonly string[]).includes(value)
  );
}

export const AI_VERDICT_LABEL: Record<AiVerdict, string> = {
  allow: "AI: 問題なし",
  flag: "AI: 要確認",
  block: "AI: 不適切の疑い",
  skipped: "AI: 未審査",
  error: "AI: 判定不可",
};

/** Badge variant(badge.tsx の variant に対応)。 */
export function aiVerdictBadgeVariant(
  v: AiVerdict,
): "category" | "warning" | "default" | "muted" {
  switch (v) {
    case "allow":
      return "category";
    case "flag":
      return "warning";
    case "block":
      return "default";
    case "skipped":
    case "error":
    default:
      return "muted";
  }
}

/** 審査キューで「危ないもの」を上に出すための並べ替えウェイト(大きいほど先)。 */
export function aiVerdictPriority(v: AiVerdict): number {
  switch (v) {
    case "block":
      return 3;
    case "flag":
      return 2;
    case "error":
      return 1;
    default:
      return 0;
  }
}
