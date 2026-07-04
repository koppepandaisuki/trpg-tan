import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlan, type UserPlan } from "@/lib/plan";

/**
 * POST /api/redeem — リデームコードの引き換え。
 *
 * body: { code: string }
 * 効果: plan_play/plan_pro(プラン付与・ダウングレードなし) or gold(残高加算)。
 *
 * 認証は download ルートと同じ二経路(Bearer=desktop / Cookie+Origin=web)。
 * コードの存在・期限・残回数は admin client で検証し、無効理由は
 * 「コードが無効です」に collapse する(コードの探索を助けない)。
 * 1人1回は code_redemptions の unique(code, user_id) が DB レベルで保証。
 */

const INVALID = "コードが無効です";

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (bearer) {
    const client = createBearerClient(bearer);
    const {
      data: { user },
    } = await client.auth.getUser();
    return user?.id ?? null;
  }
  if (!isSameOriginRequest(request)) return null;
  const user = await getCurrentUser();
  return user?.id ?? null;
}

const PLAN_RANK: Record<UserPlan, number> = { basic: 0, play: 1, pro: 2 };

export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code || code.length > 64) {
    return NextResponse.json({ ok: false, message: INVALID }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. コードを取得して有効性を検証(理由は collapse)。
  const { data: rc } = await admin
    .from("redeem_codes")
    .select("code, kind, amount, max_uses, used_count, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (!rc) {
    return NextResponse.json({ ok: false, message: INVALID }, { status: 400 });
  }
  if (rc.expires_at && Date.parse(rc.expires_at) < Date.now()) {
    return NextResponse.json({ ok: false, message: INVALID }, { status: 400 });
  }
  if (rc.used_count >= rc.max_uses) {
    return NextResponse.json({ ok: false, message: INVALID }, { status: 400 });
  }

  // 2. 使用記録(1人1回は unique 制約が保証。23505 = 使用済み)。
  const { error: insErr } = await admin
    .from("code_redemptions")
    .insert({ code, user_id: userId });
  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json(
        { ok: false, message: "このコードは既に使用済みです" },
        { status: 409 },
      );
    }
    console.error("[redeem] insert failed", insErr);
    return NextResponse.json(
      { ok: false, message: "引き換えに失敗しました" },
      { status: 500 },
    );
  }

  // 3. 使用回数をカウントアップ(検証との僅かな race は許容 — 個人配布規模)。
  await admin
    .from("redeem_codes")
    .update({ used_count: rc.used_count + 1 })
    .eq("code", code);

  // 4. 効果を適用。
  try {
    if (rc.kind === "tester_access") {
      const { error } = await admin
        .from("profiles")
        .update({ is_tester: true })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return NextResponse.json(
        {
          ok: true,
          kind: "tester_access",
          message: "テスター権限を付与しました。Stripe を介さずプランを切り替えられます",
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (rc.kind === "gold") {
      const { data: prof } = await admin
        .from("profiles")
        .select("gold_balance")
        .eq("id", userId)
        .maybeSingle();
      const next = (prof?.gold_balance ?? 0) + rc.amount;
      const { error } = await admin
        .from("profiles")
        .update({ gold_balance: next })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return NextResponse.json(
        {
          ok: true,
          kind: "gold",
          amount: rc.amount,
          goldBalance: next,
          message: `${rc.amount.toLocaleString("ja-JP")} ゴールドを受け取りました`,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // plan_play / plan_pro: 現在より上のときだけ付与(pro を play に落とさない)。
    const target: UserPlan = rc.kind === "plan_pro" ? "pro" : "play";
    const { data: prof } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();
    const current = normalizePlan(prof?.plan);
    const next = PLAN_RANK[target] > PLAN_RANK[current] ? target : current;
    if (next !== current) {
      const { error } = await admin
        .from("profiles")
        .update({ plan: next })
        .eq("id", userId);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json(
      {
        ok: true,
        kind: rc.kind,
        plan: next,
        message:
          next !== current
            ? `${target === "pro" ? "Pro" : "プレイ"}プランが有効になりました`
            : "コードを使用しました(現在のプランの方が上位のため変更はありません)",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[redeem] apply failed", e);
    return NextResponse.json(
      { ok: false, message: "引き換えの適用に失敗しました" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
