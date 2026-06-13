import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude API 連携(ルールブック Q&A の AI 回答)。
 *
 * 設計方針:
 *  - GM が自分の API キーを設定する「Bring Your Own Key」方式。キーは
 *    この端末の localStorage にのみ保存し、外部送信しない。
 *  - 送信するのは「ローカル検索でヒットした抜粋 + 質問」だけ(RAG)。
 *    ルールブックの全文は送らない(著作物への配慮 + トークン節約)。
 *  - デスクトップ(Tauri WebView)からブラウザ direct access で直接叩く。
 */

const KEY_KEY = "trpg.llm.apikey.v1";
const MODEL_KEY = "trpg.llm.model.v1";

export const LLM_MODELS: { id: string; label: string }[] = [
  { id: "claude-opus-4-8", label: "Opus 4.8（最も賢い・高コスト）" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6（バランス）" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5（高速・低コスト）" },
];

export function getApiKey(): string {
  return localStorage.getItem(KEY_KEY) ?? "";
}
export function setApiKey(key: string): void {
  localStorage.setItem(KEY_KEY, key.trim());
}
export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}
export function getModel(): string {
  return localStorage.getItem(MODEL_KEY) ?? LLM_MODELS[0].id;
}
export function setModel(id: string): void {
  localStorage.setItem(MODEL_KEY, id);
}

export interface Passage {
  book: string;
  text: string;
}

/**
 * ルールブックの抜粋 + 質問から回答を生成し、トークンを逐次コールバック。
 * 失敗時は例外を投げる(呼び出し側で typed error を判別)。
 */
export async function askRulebookLLM(
  question: string,
  passages: Passage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API キーが設定されていません");

  const client = new Anthropic({
    apiKey,
    // デスクトップアプリ(ユーザー自身のキー)なので直接アクセスを許可。
    dangerouslyAllowBrowser: true,
  });

  const context = passages
    .map((p, i) => `【抜粋${i + 1}・出典: ${p.book}】\n${p.text}`)
    .join("\n\n");

  const system =
    "あなたは TRPG のルール解説アシスタントです。" +
    "与えられたルールブックの抜粋だけを根拠に、GM の質問へ日本語で簡潔に答えてください。" +
    "抜粋に書かれていない内容は推測せず「抜粋からは判断できません」と述べること。" +
    "回答の最後に、根拠にした出典(抜粋番号とルールブック名)を必ず明記してください。";

  const stream = client.messages.stream(
    {
      model: getModel(),
      max_tokens: 1024,
      system,
      messages: [
        {
          role: "user",
          content: `# ルールブックの抜粋\n${context}\n\n# 質問\n${question}`,
        },
      ],
    },
    { signal },
  );

  stream.on("text", (delta) => onDelta(delta));
  await stream.finalMessage();
}

/** SDK のエラーを日本語の一文に整える。 */
export function describeLLMError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) {
    return "API キーが正しくありません。設定を確認してください。";
  }
  if (e instanceof Anthropic.RateLimitError) {
    return "レート制限に達しました。少し待って再試行してください。";
  }
  if (e instanceof Anthropic.APIError) {
    return `API エラー(${e.status ?? "?"}): ${e.message}`;
  }
  return String(e);
}
