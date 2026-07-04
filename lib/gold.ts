/**
 * ゴールド(アプリ内通貨)の共通定義。
 *
 * ポリシー:
 *  - 1 ゴールド ≒ ¥1 の感覚で価格設定(パックは等価)。
 *  - 用途: PLAY の AI 従量課金 / 作品のゴールド購入 / スーパーサンクス。
 *  - 現金化(払い出し)はできない。クリエイターが受け取ったゴールドも
 *    アプリ内でのみ利用できる。
 */

/** Stripe で購入できるゴールドパック。 */
export const GOLD_PACKS = {
  p300: { gold: 300, jpy: 300, label: "300 ゴールド" },
  p1000: { gold: 1000, jpy: 1000, label: "1,000 ゴールド" },
  p3000: { gold: 3000, jpy: 3000, label: "3,000 ゴールド" },
} as const;

export type GoldPackId = keyof typeof GOLD_PACKS;

export function isGoldPackId(v: unknown): v is GoldPackId {
  return typeof v === "string" && v in GOLD_PACKS;
}

/**
 * AI 1 回あたりの消費ゴールド(env で調整可。既定 2)。
 *
 * 根拠: claude-haiku-4-5 は $1/$5 per MTok(入力/出力)。抜粋+質問+
 * max_tokens=1024 の実コストは軽量な質問で ¥0.3、抜粋5件程度の中量な
 * 質問で ¥0.8 程度(¥150/$1 換算)。1 ゴールド=¥1 の等価レートのため
 * 既定 2 にすることで軽量〜中量は黒字を確保しつつプレイヤー負担は
 * 実質無視できる水準(300ゴールドパックで150回分)に抑える。
 */
export function aiGoldCost(): number {
  const raw = Number(process.env.AI_GOLD_COST ?? "2");
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 2;
}

/** RPC の raise exception メッセージ → 利用者向け文言。 */
export function goldErrorMessage(raw: string): {
  status: number;
  reason: string;
  message: string;
} {
  if (raw.includes("insufficient_gold"))
    return {
      status: 402,
      reason: "insufficient_gold",
      message: "ゴールドが不足しています",
    };
  if (raw.includes("already_purchased"))
    return {
      status: 409,
      reason: "already_purchased",
      message: "すでに購入済みです",
    };
  if (raw.includes("free_product"))
    return {
      status: 400,
      reason: "free_product",
      message: "無料作品はそのまま入手できます",
    };
  if (raw.includes("product_not_found"))
    return {
      status: 404,
      reason: "product_not_found",
      message: "作品が見つかりません",
    };
  if (raw.includes("own_product"))
    return {
      status: 400,
      reason: "own_product",
      message: "自分の作品は購入できません",
    };
  if (raw.includes("invalid_recipient"))
    return {
      status: 400,
      reason: "invalid_recipient",
      message: "送り先が不正です",
    };
  if (raw.includes("recipient_not_found"))
    return {
      status: 404,
      reason: "recipient_not_found",
      message: "送り先が見つかりません",
    };
  if (raw.includes("invalid_amount"))
    return {
      status: 400,
      reason: "invalid_amount",
      message: "金額が不正です",
    };
  if (raw.includes("not_authenticated"))
    return {
      status: 401,
      reason: "not_authenticated",
      message: "ログインが必要です",
    };
  return { status: 500, reason: "unknown", message: "処理に失敗しました" };
}
