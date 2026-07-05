import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiGoldCost, goldErrorMessage } from "@/lib/gold";
import {
  checkRateLimit,
  RATE_LIMITS,
  tooManyRequestsResponse,
} from "@/lib/api/rate-limit";

/**
 * POST /api/ai/complete — PLAY の AI(ルールブック Q&A 等)を運営 API キーで実行。
 *
 * 従量課金: 1 回につき AI_GOLD_COST ゴールド(既定 1)を spend_gold RPC で
 * 先に消費し、モデル呼び出しが失敗したら credit_gold で返金する。
 * ユーザーが自分の API キーを設定している場合、デスクトップはこのルートを
 * 使わず直接 Anthropic を叩く(BYOK は無料のまま)。
 *
 * body: { question: string, passages?: { book: string, text: string }[] }
 * 200: { ok: true, text, goldBalance, cost }
 * 402: { ok: false, reason: "insufficient_gold", cost }
 * 503: { ok: false, reason: "not_configured" }(運営キー未設定)
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 45_000;
const MAX_QUESTION = 2_000;
const MAX_PASSAGES = 8;
const MAX_PASSAGE_TEXT = 4_000;

function serverModel(): string {
  return process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
}

async function resolveUserClient(
  request: NextRequest,
): Promise<{ userId: string; client: SupabaseClient } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (bearer) {
    const client = createBearerClient(bearer);
    const {
      data: { user },
    } = await client.auth.getUser();
    return user ? { userId: user.id, client } : null;
  }
  if (!isSameOriginRequest(request)) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  return { userId: user.id, client: createClient() };
}

const SYSTEM_PROMPT =
  "あなたは TRPG のルール解説アシスタントです。" +
  "与えられたルールブックの抜粋だけを根拠に、GM の質問へ日本語で簡潔に答えてください。" +
  "抜粋に書かれていない内容は推測せず「抜粋からは判断できません」と述べること。" +
  "回答の最後に、根拠にした出典(抜粋番号とルールブック名)を必ず明記してください。";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "not_configured", message: "AI は準備中です" },
      { status: 503 },
    );
  }

  const auth = await resolveUserClient(request);
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  // Anthropic 実費のコスト攻撃・並列連打の抑止(ゴールド消費に加えた保険)。
  if (!(await checkRateLimit(`ai:${auth.userId}`, RATE_LIMITS.ai))) {
    return tooManyRequestsResponse();
  }

  let body: { question?: unknown; passages?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }
  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_QUESTION) {
    return NextResponse.json(
      { ok: false, message: "質問が不正です" },
      { status: 400 },
    );
  }
  const passages = (Array.isArray(body.passages) ? body.passages : [])
    .slice(0, MAX_PASSAGES)
    .map((p) => ({
      book:
        typeof (p as { book?: unknown }).book === "string"
          ? ((p as { book: string }).book || "").slice(0, 200)
          : "",
      text:
        typeof (p as { text?: unknown }).text === "string"
          ? ((p as { text: string }).text || "").slice(0, MAX_PASSAGE_TEXT)
          : "",
    }))
    .filter((p) => p.text);

  // 先に消費(不足なら 402)。失敗時は下で返金する。
  const cost = aiGoldCost();
  const refId = crypto.randomUUID();
  let balance = 0;
  if (cost > 0) {
    const { data, error } = await auth.client.rpc("spend_gold", {
      p_amount: cost,
      p_kind: "ai_usage",
      p_ref: refId,
      p_note: "ルールブック Q&A",
    });
    if (error) {
      const mapped = goldErrorMessage(error.message ?? "");
      return NextResponse.json(
        { ok: false, reason: mapped.reason, message: mapped.message, cost },
        { status: mapped.status },
      );
    }
    balance = typeof data === "number" ? data : 0;
  }

  const context = passages
    .map((p, i) => `【抜粋${i + 1}・出典: ${p.book || "?"}】\n${p.text}`)
    .join("\n\n");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverModel(),
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `# ルールブックの抜粋\n${context || "(抜粋なし)"}\n\n# 質問\n${question}`,
          },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`anthropic_status_${res.status}`);
    }
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
    if (!text) throw new Error("empty_completion");

    return NextResponse.json(
      { ok: true, text, goldBalance: balance, cost },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // 消費済みゴールドを返金(冪等: refund は都度 uuid)。
    if (cost > 0) {
      try {
        await createAdminClient().rpc("credit_gold", {
          p_user: auth.userId,
          p_amount: cost,
          p_kind: "refund",
          p_ref: refId,
          p_note: "AI 呼び出し失敗の返金",
        });
      } catch (refundErr) {
        console.error("[ai/complete] refund failed", refundErr);
      }
    }
    console.error("[ai/complete] completion failed", err);
    return NextResponse.json(
      {
        ok: false,
        message:
          "AI の呼び出しに失敗しました(消費したゴールドは返金されました)",
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
