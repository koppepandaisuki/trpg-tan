import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteKey, isR2Configured, listKeys } from "@/lib/storage/r2";

/**
 * 退会したユーザーのアップロードファイル(Storage)を消す。
 *
 * DB の行は auth.users の削除で cascade されるが、Storage のファイルは残るため、
 * 退会後に `<user_id>/` 配下を削除する(プライバシーポリシー §9 の約束)。
 * 対象: play(卓の画像・音声)、avatars(アバター)。
 *
 * ベストエフォート: 失敗しても退会自体は成功として扱い、ログだけ残す
 * (残ったファイルは運営が手動で消せる)。service_role のクライアントで呼ぶこと。
 */
const BUCKETS = ["play", "avatars"] as const;
const PAGE = 1000;

export async function purgeUserStorage(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return; // 想定外の id では何もしない
  for (const bucket of BUCKETS) {
    try {
      // 1 回で消し切れない量に備えて、空になるまで繰り返す(上限付き)。
      for (let round = 0; round < 50; round++) {
        const { data, error } = await admin.storage
          .from(bucket)
          .list(userId, { limit: PAGE });
        if (error) throw error;
        const files = (data ?? []).filter((f) => f.name && f.id);
        if (files.length === 0) break;
        const { error: rmErr } = await admin.storage
          .from(bucket)
          .remove(files.map((f) => `${userId}/${f.name}`));
        if (rmErr) throw rmErr;
        if (files.length < PAGE) break;
      }
    } catch (e) {
      console.error(`[purgeUserStorage] ${bucket}/${userId} の削除に失敗`, e);
    }
  }
  // R2(卓の素材の置き場を R2 にしている場合)。
  if (isR2Configured()) {
    try {
      for (let round = 0; round < 50; round++) {
        const keys = await listKeys(`${userId}/`);
        if (keys.length === 0) break;
        for (const k of keys) await deleteKey(k);
        if (keys.length < 1000) break;
      }
    } catch (e) {
      console.error(`[purgeUserStorage] R2 ${userId} の削除に失敗`, e);
    }
  }
}
