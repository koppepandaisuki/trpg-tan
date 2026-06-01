import "server-only";
import type {
  FeedbackInput,
  FeedbackCategory,
} from "@/lib/validators/feedback";

/**
 * Feedback → Discord webhook の境界を切り分ける純関数。
 *
 * Route Handler は (a) auth / RLS / 入力 validate して(b) この関数で
 * payload を作って(c) fetch で Discord に POST、という分離。
 *
 * 純関数として切り出しているのは、他の webhook ハンドラ(decideCheckout
 * Outcome / decideRefundOutcome / decideAccountOutcome)と同じくテスト
 * しやすくするため。
 */

export type DiscordPayload = {
  embeds: Array<{
    title: string;
    color: number;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    timestamp: string;
    footer: { text: string };
  }>;
};

export type FeedbackOutcome =
  | { type: "send"; payload: DiscordPayload }
  | { type: "skip"; reason: "missing_webhook_url" };

export type FeedbackContext = {
  userId: string;
  email: string;
  displayName: string;
  now: Date;
};

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "🐛 バグ",
  feature_request: "✨ 機能要望",
  question: "❓ 質問",
  other: "📝 その他",
};

// Discord embed color (decimal RGB)。意味の弱い視覚的区別だけ目的。
const CATEGORY_COLOR: Record<FeedbackCategory, number> = {
  bug: 0xef4444, // red-500
  feature_request: 0x3b82f6, // blue-500
  question: 0xeab308, // yellow-500
  other: 0x6b7280, // gray-500
};

/**
 * Build a Discord webhook payload from validated input + user context.
 *
 * webhookUrl 未設定の場合は skip を返す。Route Handler 側は skip でも
 * 200 を返してユーザーに「送信しました」を見せる(α 早期の運用で webhook
 * が未設定でもエラーにせず後追いで届けたいケース向けの猶予)。
 */
export function decideFeedbackOutcome(
  input: FeedbackInput,
  context: FeedbackContext,
  webhookUrl: string | null,
): FeedbackOutcome {
  if (!webhookUrl) {
    return { type: "skip", reason: "missing_webhook_url" };
  }

  const title = `${CATEGORY_LABEL[input.category]} ${truncate(input.body, 80)}`;

  const fields: DiscordPayload["embeds"][number]["fields"] = [
    {
      name: "ユーザー",
      value: `${context.displayName || "(no name)"} (${context.email})`,
      inline: false,
    },
    {
      name: "ページ URL",
      value: input.pageUrl ?? "(不明)",
      inline: false,
    },
    {
      name: "本文",
      value: truncate(input.body, 900),
      inline: false,
    },
  ];

  return {
    type: "send",
    payload: {
      embeds: [
        {
          title,
          color: CATEGORY_COLOR[input.category],
          fields,
          timestamp: context.now.toISOString(),
          footer: { text: `user_id: ${context.userId}` },
        },
      ],
    },
  };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
