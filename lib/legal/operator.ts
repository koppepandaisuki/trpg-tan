/**
 * 運営者情報(規約・プライバシーポリシー・特商法表記で共通に使う)。
 *
 * 実際の値は環境変数で入れる(コードに個人情報を書かない)。未設定の項目は
 * 「請求があった場合に遅滞なく開示します」と表示する(特定商取引法 11 条ただし書・
 * 個人情報保護法 32 条の「本人の求めに応じて遅滞なく回答する場合を含む」に基づく形)。
 * ※ 開示の請求が来たら、実際に遅滞なく開示する必要がある。
 *
 * 設定する env(Vercel の Environment Variables。.env.example 参照):
 *   OPERATOR_NAME            事業者名(個人なら戸籍上の氏名。屋号のみは不可)
 *   OPERATOR_REPRESENTATIVE  運営責任者(個人なら本人の氏名)
 *   OPERATOR_ADDRESS         所在地
 *   OPERATOR_PHONE           電話番号
 *   CONTACT_EMAIL            お問い合わせ・開示請求・権利侵害の申告を受けるメール
 */

export const SERVICE_NAME = "Re-dice";
export const SERVICE_FULL_NAME = "Re-dice(リダイス)";

/** 規約類の制定日・最終改定日(表示用)。改定したらここを更新する。 */
export const LEGAL_UPDATED_AT = "2026-10-14";

function env(key: string): string | null {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : null;
}

export interface OperatorInfo {
  name: string | null;
  representative: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export function getOperator(): OperatorInfo {
  return {
    name: env("OPERATOR_NAME"),
    representative: env("OPERATOR_REPRESENTATIVE"),
    address: env("OPERATOR_ADDRESS"),
    phone: env("OPERATOR_PHONE"),
    email: env("CONTACT_EMAIL"),
  };
}

/** 未設定時の表示。 */
export const DISCLOSE_ON_REQUEST =
  "請求があった場合には遅滞なく開示いたします(下記お問い合わせ先までご連絡ください)。";
