import { NextResponse, type NextRequest } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createProductFileUploadUrl,
  createCoverUploadUrl,
} from "@/lib/storage/signed-upload-url";
import {
  mimeToCoverExt,
  mimeToProductFileExt,
} from "@/lib/format/upload";
import { slugify, randomToken } from "@/lib/format/slug";
import { salePriceJpy } from "@/lib/format/price";
import type { FileFormat, ProductType } from "@/lib/queries/types";

/**
 * POST /api/creator/product/publish
 *
 * デスクトップアプリから「単一ファイル作品」(PDF シナリオ / ZIP マップ・立ち絵 /
 * 音声 BGM)を web と同等に出品するための API。サーバアクションは外部から
 * 呼べないので Bearer JWT で叩ける経路を用意する(pack/publish の一般化版)。
 *
 * フロー:
 *   1. Bearer でクリエイターを認証(RLS-as-user)。
 *   2. 指定カテゴリの **下書き**商品を作成(status=draft)。
 *   3. product-files への署名付きアップロード token を発行し file_path を確定。
 *      表紙を同時に出すなら covers 用 token も発行。
 *   4. { productId, slug, path, token, coverPath?, coverToken? } を返す。
 *      アプリは token で本体ファイルを直接アップロードする。
 *
 * full_package(.paradice)は専用ビルダー経由の /api/creator/pack/publish を
 * 使う。ここではファイルを丸ごとアップロードする5カテゴリのみ受け付ける。
 *
 * 公開(published)はここでは行わない(誤爆・未完成品対策。作者が web の
 * クリエイターページで表紙・価格を確認して公開する)。
 */

/** ファイルアップロード型の5カテゴリ ⇔ file_format の対応(full_package は対象外)。 */
const TYPE_TO_FORMATS: Record<
  Exclude<ProductType, "full_package">,
  readonly FileFormat[]
> = {
  scenario: ["pdf"],
  rulebook: ["pdf"],
  map: ["image_zip"],
  character_art: ["image_zip"],
  bgm_audio: ["audio"],
};

function isUploadableType(
  t: string,
): t is Exclude<ProductType, "full_package"> {
  return Object.prototype.hasOwnProperty.call(TYPE_TO_FORMATS, t);
}

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
    productType?: string;
    fileFormat?: string;
    /** 本体ファイルの MIME(application/pdf, application/zip, audio/mpeg, audio/wav)。 */
    fileContentType?: string;
    /** 割引(任意)。率は 0..100(100=無料配布)、期間は ISO 文字列。 */
    discountPercent?: number;
    discountStartsAt?: string | null;
    discountEndsAt?: string | null;
    /** 任意メタ。 */
    systemLabel?: string;
    players?: string;
    playtime?: string;
    recommendedSkills?: string;
    tags?: unknown;
    /** 表紙をアプリ内で同時アップロードするときの MIME(image/png 等)。 */
    coverContentType?: string;
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

  const productType = body.productType ?? "";
  if (!isUploadableType(productType)) {
    return NextResponse.json(
      { ok: false, message: "対応していないカテゴリです" },
      { status: 400 },
    );
  }

  const fileFormat = (body.fileFormat ?? "") as FileFormat;
  if (!TYPE_TO_FORMATS[productType].includes(fileFormat)) {
    return NextResponse.json(
      { ok: false, message: "カテゴリとファイル形式が一致しません" },
      { status: 400 },
    );
  }

  // 本体ファイルの拡張子を MIME + file_format から確定(不正なら弾く)。
  const fileExt = mimeToProductFileExt(body.fileContentType ?? "", fileFormat);
  if (!fileExt) {
    return NextResponse.json(
      { ok: false, message: "対応していないファイル形式です" },
      { status: 400 },
    );
  }

  const priceJpy =
    typeof body.priceJpy === "number" && Number.isFinite(body.priceJpy)
      ? Math.max(0, Math.min(10_000_000, Math.floor(body.priceJpy)))
      : 0;

  // 割引(web の BuilderForm と同じ制約)。
  const discountPercent =
    typeof body.discountPercent === "number" &&
    Number.isFinite(body.discountPercent)
      ? Math.max(0, Math.min(100, Math.floor(body.discountPercent)))
      : 0;
  const parseIso = (v: unknown): string | null => {
    if (typeof v !== "string" || !v.trim()) return null;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };
  const discountStartsAt = parseIso(body.discountStartsAt);
  const discountEndsAt = parseIso(body.discountEndsAt);
  if (
    discountStartsAt &&
    discountEndsAt &&
    Date.parse(discountEndsAt) <= Date.parse(discountStartsAt)
  ) {
    return NextResponse.json(
      { ok: false, message: "セール終了は開始より後にしてください" },
      { status: 400 },
    );
  }
  // Stripe の JPY 最低決済額は ¥50。割引後 1〜49 円は決済不能なので弾く。
  const sale = salePriceJpy(priceJpy, discountPercent);
  if (sale > 0 && sale < 50) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "割引後の価格が¥50未満になります(決済不可)。割引率を下げるか、100%(無料配布)にしてください",
      },
      { status: 400 },
    );
  }

  const slug = `${slugify(title) || "product"}-${randomToken()}`.slice(0, 80);

  const clip = (s: string | undefined, n: number) =>
    s && s.trim() ? s.trim().slice(0, n) : null;

  // 下書き商品を作成(RLS: クリエイター本人の draft のみ INSERT 可)。
  const { data: inserted, error } = await client
    .from("products")
    .insert({
      creator_id: user.id,
      slug,
      title,
      description: (body.description ?? "").slice(0, 10_000),
      product_type: productType,
      file_format: fileFormat,
      price_jpy: priceJpy,
      discount_percent: discountPercent,
      discount_starts_at: discountStartsAt,
      discount_ends_at: discountEndsAt,
      status: "draft",
      system_label: clip(body.systemLabel, 100),
      players: clip(body.players, 50),
      playtime: clip(body.playtime, 50),
      recommended_skills: clip(body.recommendedSkills, 200),
    })
    .select("id, slug")
    .single();

  if (error || !inserted) {
    console.error("[product/publish] insert failed", error?.message);
    return NextResponse.json(
      { ok: false, message: "出品に失敗しました（クリエイター登録が必要です）" },
      { status: 403 },
    );
  }

  // タグ(任意・最大20件・重複除去)。失敗しても本体作成は成立済みなので握りつぶす。
  const tags = Array.isArray(body.tags)
    ? Array.from(
        new Set(
          body.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim())
            .filter((t) => t.length > 0 && t.length <= 30),
        ),
      ).slice(0, 20)
    : [];
  if (tags.length > 0) {
    const { error: tagErr } = await client
      .from("product_tags")
      .insert(tags.map((tag) => ({ product_id: inserted.id, tag })));
    if (tagErr) console.warn("[product/publish] tag insert failed", tagErr.message);
  }

  // 本体ファイルの署名付きアップロード token を発行し file_path を確定。
  const path = `${user.id}/${inserted.id}.${fileExt}`;
  let token: string;
  try {
    const signedUrl = await createProductFileUploadUrl(path);
    const t = new URL(signedUrl).searchParams.get("token");
    if (!t) throw new Error("no token in signed url");
    token = t;
  } catch (e) {
    console.error("[product/publish] signed url failed", e);
    return NextResponse.json(
      { ok: false, message: "アップロードの準備に失敗しました" },
      { status: 500 },
    );
  }

  // 表紙(任意)。MIME 不正なら表紙はスキップして本体だけ続行。
  let coverPath: string | null = null;
  let coverToken: string | null = null;
  const coverExt = body.coverContentType
    ? mimeToCoverExt(body.coverContentType)
    : null;
  if (coverExt) {
    const cp = `${user.id}/${inserted.id}.${coverExt}`;
    try {
      const signed = await createCoverUploadUrl(cp);
      const t = new URL(signed).searchParams.get("token");
      if (t) {
        coverPath = cp;
        coverToken = t;
      }
    } catch (e) {
      console.error("[product/publish] cover signed url failed", e);
    }
  }

  const admin = createAdminClient();
  await admin
    .from("products")
    .update({ file_path: path, ...(coverPath ? { cover_path: coverPath } : {}) })
    .eq("id", inserted.id);

  return NextResponse.json({
    ok: true,
    productId: inserted.id,
    slug: inserted.slug,
    path,
    token,
    coverPath,
    coverToken,
  });
}
