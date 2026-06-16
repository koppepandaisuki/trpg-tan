import { NextResponse, type NextRequest } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProductFileUploadUrl } from "@/lib/storage/signed-upload-url";
import { slugify, randomToken } from "@/lib/format/slug";

/**
 * POST /api/creator/pack/publish
 *
 * デスクトップアプリから「フルパッケージ(.paradice)」を出品するための API。
 * サーバアクションは外部から呼べないので、Bearer JWT で叩ける経路を用意する。
 *
 * フロー:
 *   1. Bearer でクリエイターを認証(RLS-as-user)。
 *   2. full_package / pack の **下書き**商品を作成(status=draft。公開は別途・審査前提)。
 *   3. product-files バケットへの署名付きアップロード token を発行し、file_path を確定。
 *   4. { productId, slug, path, token } を返す。アプリは token で .paradice を直接 PUT。
 *
 * 公開(published)はここでは行わない(不適切投稿対策。作者がクリエイターページで
 * 表紙・価格を確認して公開する)。
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!bearer) {
    return NextResponse.json(
      { ok: false, message: "認証が必要です" },
      { status: 401 },
    );
  }

  const client = createBearerClient(bearer);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "認証に失敗しました" },
      { status: 401 },
    );
  }

  let body: {
    title?: string;
    priceJpy?: number;
    description?: string;
    systemLabel?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }

  const title = (body.title ?? "").trim();
  if (!title || title.length > 100) {
    return NextResponse.json(
      { ok: false, message: "タイトルを 1〜100 文字で入力してください" },
      { status: 400 },
    );
  }
  const priceJpy =
    typeof body.priceJpy === "number" && Number.isFinite(body.priceJpy)
      ? Math.max(0, Math.min(10_000_000, Math.floor(body.priceJpy)))
      : 0;
  const slug = `${slugify(title) || "pack"}-${randomToken()}`.slice(0, 80);

  // 下書き商品を作成(RLS: クリエイター本人の draft のみ INSERT 可)。
  const { data: inserted, error } = await client
    .from("products")
    .insert({
      creator_id: user.id,
      slug,
      title,
      description: (body.description ?? "").slice(0, 10_000),
      product_type: "full_package",
      file_format: "pack",
      price_jpy: priceJpy,
      status: "draft",
      system_label: body.systemLabel?.slice(0, 100) || null,
    })
    .select("id, slug")
    .single();

  if (error || !inserted) {
    console.error("[pack/publish] insert failed", error?.message);
    return NextResponse.json(
      { ok: false, message: "出品に失敗しました（クリエイター登録が必要です）" },
      { status: 403 },
    );
  }

  // 署名付きアップロード token を発行し、file_path を確定。
  const path = `${user.id}/${inserted.id}.paradice`;
  let token: string;
  try {
    const signedUrl = await createProductFileUploadUrl(path);
    const t = new URL(signedUrl).searchParams.get("token");
    if (!t) throw new Error("no token in signed url");
    token = t;
  } catch (e) {
    console.error("[pack/publish] signed url failed", e);
    return NextResponse.json(
      { ok: false, message: "アップロードの準備に失敗しました" },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  await admin.from("products").update({ file_path: path }).eq("id", inserted.id);

  return NextResponse.json({
    ok: true,
    productId: inserted.id,
    slug: inserted.slug,
    path,
    token,
  });
}
