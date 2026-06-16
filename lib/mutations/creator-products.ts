import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductInput } from "@/lib/validators/product";
import { randomToken, slugify } from "@/lib/format/slug";

/**
 * Creator-scoped mutations.
 *
 * All writes go through here. Pages and Server Actions never call Supabase
 * directly for write paths. Each function takes userId explicitly so we
 * can re-assert ownership in the SQL filter even when RLS would already
 * deny.
 *
 * Atomicity note: Supabase JS does not expose transactions. Tag replacement
 * is "delete then insert" — partial failures are logged but not rolled
 * back. Phase 5 accepts this risk; Phase 9 may move tag replacement into a
 * SQL function (RPC) for atomicity.
 */

const PENDING = "pending" as const;
const DRAFT = "draft" as const;

/**
 * Creator publish intent.
 *
 *   "draft"  — save as a private draft.
 *   "submit" — submit for review. The product becomes `pending`; an admin
 *              approves it to `published` (see admin_review_product). RLS
 *              forbids creators from setting `published` directly, so this is
 *              the only path a creator can take toward going live.
 */
export type PublishIntent = "draft" | "submit";

export async function createMyProduct(
  userId: string,
  input: ProductInput,
  intent: PublishIntent,
): Promise<{ id: string }> {
  const supabase = createClient();
  const slug = await generateUniqueSlug(input.title);

  // RLS only allows INSERT with status='draft'. We honor that even when the
  // caller intends to submit — we'll UPDATE to 'pending' immediately after.
  const { data: inserted, error } = await supabase
    .from("products")
    .insert({
      creator_id: userId,
      slug,
      title: input.title,
      description: input.description ?? "",
      product_type: input.productType,
      file_format: input.fileFormat,
      price_jpy: input.priceJpy,
      status: DRAFT,
      system_label: nullable(input.systemLabel),
      players: nullable(input.players),
      playtime: nullable(input.playtime),
      recommended_skills: nullable(input.recommendedSkills),
      allow_commercial: input.allowCommercial,
      allow_redistribution: input.allowRedistribution,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`[createMyProduct] insert failed: ${error?.message ?? "unknown"}`);
  }

  await replaceTags(inserted.id, input.tags);

  if (intent === "submit") {
    const { error: pubErr } = await supabase
      .from("products")
      .update({ status: PENDING })
      .eq("id", inserted.id)
      .eq("creator_id", userId);
    if (pubErr) {
      // Leave the product as draft. The user can retry the submission.
      console.error("[createMyProduct] submit update failed", pubErr);
      throw new Error(`[createMyProduct] submit failed: ${pubErr.message}`);
    }
  }

  return { id: inserted.id };
}

export async function updateMyProduct(
  userId: string,
  productId: string,
  input: ProductInput,
  intent: PublishIntent,
): Promise<void> {
  const supabase = createClient();

  // Read current row to confirm ownership.
  const { data: current, error: readErr } = await supabase
    .from("products")
    .select("id, creator_id, status, published_at")
    .eq("id", productId)
    .eq("creator_id", userId)
    .maybeSingle();

  if (readErr || !current) {
    // Treat as not-found; caller surfaces 404.
    throw new Error("NOT_FOUND");
  }

  const updates: Record<string, unknown> = {
    title: input.title,
    description: input.description ?? "",
    product_type: input.productType,
    file_format: input.fileFormat,
    price_jpy: input.priceJpy,
    system_label: nullable(input.systemLabel),
    players: nullable(input.players),
    playtime: nullable(input.playtime),
    recommended_skills: nullable(input.recommendedSkills),
    allow_commercial: input.allowCommercial,
    allow_redistribution: input.allowRedistribution,
  };

  if (intent === "submit") {
    // 審査に出す → pending。admin が承認すると published になる(RLS で
    // creator は published に直接遷移できない)。
    updates.status = PENDING;
  } else {
    updates.status = DRAFT;
    // We deliberately keep published_at if it exists. DB CHECK allows draft
    // with any published_at value. This preserves "first published" history.
  }

  const { error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", productId)
    .eq("creator_id", userId);

  if (error) {
    throw new Error(`[updateMyProduct] update failed: ${error.message}`);
  }

  await replaceTags(productId, input.tags);
}

// ---------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------

async function replaceTags(productId: string, tags: string[]): Promise<void> {
  const supabase = createClient();

  const { error: delErr } = await supabase
    .from("product_tags")
    .delete()
    .eq("product_id", productId);
  if (delErr) {
    console.error("[replaceTags] delete failed", delErr);
    return;
  }

  if (tags.length === 0) return;

  // Defensive dedupe — the schema already enforces uniqueness via PK.
  const unique = Array.from(new Set(tags.map((t) => t.toLowerCase().trim()))).filter(
    (t) => t.length > 0,
  );
  if (unique.length === 0) return;

  const { error: insErr } = await supabase
    .from("product_tags")
    .insert(unique.map((tag) => ({ product_id: productId, tag })));
  if (insErr) {
    console.error("[replaceTags] insert failed", insErr);
  }
}

function nullable(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function generateUniqueSlug(title: string): Promise<string> {
  const supabase = createClient();
  const base = slugify(title);
  let candidate = base;

  for (let i = 2; i < 50; i++) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${i}`;
  }
  // Give up trying to be pretty; append a random token.
  return `${base}-${randomToken()}`;
}
