import "server-only";
import { isAiVerdict, type AiVerdict } from "./verdict";

/**
 * 出品内容(タイトル / 説明 / タグ)の AI 事前審査。
 *
 * 目的: ストアの趣旨(TRPG 素材)に合わない投稿・不適切な投稿を、admin の
 * 審査前に一次判定して**トリアージを助ける**。最終判断は人間(admin)が行い、
 * ここでは自動公開・自動却下はしない。
 *
 * 構成:
 *   - buildModerationInput / parseModerationResponse は純粋関数(テスト可能)。
 *   - screenProductContent が Anthropic API を叩く(env 未設定なら skipped)。
 *
 * 失敗に強く作る: API キーが無い・通信失敗・解析失敗のいずれでも例外を投げず、
 * skipped / error を返す。出品フロー(申請)を AI で止めないため。
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 12_000;
const REASON_MAX = 280;

export interface ModerationInput {
  title: string;
  description: string;
  tags: string[];
}

export interface ModerationResult {
  verdict: AiVerdict;
  reason: string;
}

const SYSTEM_PROMPT = [
  "あなたは TRPG(テーブルトークRPG)素材のマーケットプレイス「パラDa-iCE」の",
  "出品モデレーターです。出品の「タイトル・説明・タグ」を読み、ストアに掲載して",
  "よいかを一次判定します。",
  "",
  "ALLOW(問題なし): TRPG のシナリオ / ルールブック / キャラクターシート /",
  "  マップ / イラスト / BGM・効果音 / GM 支援ツール など、TRPG 遊びに資する素材。",
  "FLAG(要確認): 判断が難しい・軽微な懸念・情報不足など、人間が目視すべきもの。",
  "BLOCK(不適切): TRPG と無関係な商品、違法・規約違反、ヘイト、未成年に対する",
  "  性的内容、その他マーケットの趣旨に明確に反するもの。",
  "",
  "迷ったら BLOCK ではなく FLAG にしてください(誤って正当な作品を弾かないため)。",
  '出力は JSON のみ: {"verdict":"allow|flag|block","reason":"日本語で簡潔に(200字以内)"}',
].join("\n");

/** モデルへ渡すユーザーメッセージ本文を組み立てる(純粋関数)。 */
export function buildModerationInput(input: ModerationInput): string {
  const tags = input.tags.length > 0 ? input.tags.join(", ") : "(なし)";
  return [
    "次の出品を判定してください。",
    "",
    `# タイトル\n${input.title || "(空)"}`,
    `# タグ\n${tags}`,
    `# 説明\n${input.description || "(空)"}`,
  ].join("\n");
}

/**
 * モデル応答テキストから {verdict, reason} を取り出す(純粋関数)。
 * コードフェンスや前後の文章が混じっても、最初の JSON オブジェクトを拾う。
 * 解析できない / verdict が不正なら error を返す。
 */
export function parseModerationResponse(text: string): ModerationResult {
  const raw = (text ?? "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { verdict: "error", reason: "AI 応答を解析できませんでした" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { verdict: "error", reason: "AI 応答を解析できませんでした" };
  }
  const obj = parsed as { verdict?: unknown; reason?: unknown };
  if (!isAiVerdict(obj.verdict) || obj.verdict === "skipped" || obj.verdict === "error") {
    return { verdict: "error", reason: "AI 応答の判定値が不正でした" };
  }
  const reason =
    typeof obj.reason === "string" ? obj.reason.slice(0, REASON_MAX) : "";
  return { verdict: obj.verdict, reason };
}

/**
 * 出品内容を AI で審査する。env(ANTHROPIC_API_KEY)未設定なら skipped。
 * 例外は投げない。
 */
export async function screenProductContent(
  input: ModerationInput,
): Promise<ModerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { verdict: "skipped", reason: "AI 審査は未設定です" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildModerationInput(input) }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("[ai-screen] API error", res.status);
      return { verdict: "error", reason: `AI 審査に失敗しました (${res.status})` };
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text =
      data.content?.find((b) => b.type === "text")?.text ??
      data.content?.[0]?.text ??
      "";
    return parseModerationResponse(text);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { verdict: "error", reason: "AI 審査がタイムアウトしました" };
    }
    console.error("[ai-screen] unexpected", e);
    return { verdict: "error", reason: "AI 審査に失敗しました" };
  } finally {
    clearTimeout(timer);
  }
}
