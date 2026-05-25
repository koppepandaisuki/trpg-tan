import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FileFormat } from "@/lib/queries/types";
import { mimeToCoverExt, mimeToProductFileExt } from "@/lib/format/upload";

/**
 * Authorization layer for the upload feature (Ph-γ).
 *
 * Single responsibility: given a user, a productId, and the file's
 * Content-Type, decide if the upload may proceed and return the
 * Storage path (`{creator_id}/{product_id}.{ext}`) on success.
 *
 * Defense layers (decisions Q5 / Q6 / Q8):
 *   1. UUID format check (cheap, no DB)
 *   2. DB read of `products` filtered by `(id, creator_id)` — own only
 *   3. status != 'suspended' — admin-suspended cannot accept uploads
 *   4. MIME allow-list — cover types fixed, file types gated on the
 *      product's declared `file_format` so a "pdf" product cannot have
 *      its body replaced with a mp3
 *
 * RLS and Storage RLS provide the secondary defenses; this layer
 * surfaces a user-friendly error before those silently reject.
 */

export type UploadOk = { ok: true; ext: string; path: string };
export type UploadDenial = {
  ok: false;
  reason: "not_found" | "suspended" | "invalid_mime";
  status: 400 | 403 | 404;
  message: string;
};
export type UploadDecision = UploadOk | UploadDenial;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): UploadDenial {
  return {
    ok: false,
    reason: "not_found",
    status: 404,
    message: "作品が見つかりません",
  };
}

function suspended(): UploadDenial {
  return {
    ok: false,
    reason: "suspended",
    status: 403,
    message: "この作品は配布停止中のため変更できません",
  };
}

function invalidMime(): UploadDenial {
  return {
    ok: false,
    reason: "invalid_mime",
    status: 400,
    message: "対応していないファイル形式です",
  };
}

export async function canUploadCover(
  userId: string,
  productId: string,
  contentType: string,
): Promise<UploadDecision> {
  if (!UUID_RE.test(productId)) return notFound();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, status")
    .eq("id", productId)
    .eq("creator_id", userId)
    .maybeSingle();

  if (error || !data) return notFound();
  if (data.status === "suspended") return suspended();

  const ext = mimeToCoverExt(contentType);
  if (!ext) return invalidMime();

  return {
    ok: true,
    ext,
    path: `${userId}/${productId}.${ext}`,
  };
}

export async function canUploadProductFile(
  userId: string,
  productId: string,
  contentType: string,
): Promise<UploadDecision> {
  if (!UUID_RE.test(productId)) return notFound();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, status, file_format")
    .eq("id", productId)
    .eq("creator_id", userId)
    .maybeSingle();

  if (error || !data) return notFound();
  if (data.status === "suspended") return suspended();

  const ext = mimeToProductFileExt(
    contentType,
    data.file_format as FileFormat,
  );
  if (!ext) return invalidMime();

  return {
    ok: true,
    ext,
    path: `${userId}/${productId}.${ext}`,
  };
}
