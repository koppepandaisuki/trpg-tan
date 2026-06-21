import { randomBytes } from "crypto";

/**
 * 推測不可能な URL-safe トークン(base64url)。
 * 公開トークン(閲覧・投票)と管理トークン(編集・確定・削除)の両方に使う。
 * 16 バイト = 約 22 文字。サーバ専用(route handler)で生成する。
 */
export function newToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}
