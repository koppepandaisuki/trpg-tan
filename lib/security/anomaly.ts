import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { postOperatorAlert } from "@/lib/security/operator-alert";

/**
 * 運営向け異常検知の日次ダイジェスト。
 *
 * anomaly_report RPC(0046)で直近 N 時間のゴールド活動・リデーム状況を集計し、
 * 気になる兆候(AI連打・大量購入・サンクス集中・コード漏洩)があれば Discord に
 * 流す。Vercel Cron(app/api/cron/anomaly-check)から呼ぶ。
 */

export type AnomalyFlag =
  | { type: "heavy_ai"; user_id: string; cnt: number }
  | { type: "bulk_purchase"; user_id: string; cnt: number }
  | { type: "tip_concentration"; user_id: string; total: number }
  | { type: "code_leak"; code: string; users: number };

export type AnomalyReport = {
  hours: number;
  gold_by_kind: { kind: string; cnt: number; total: number }[];
  redeems_total: number;
  top_codes: { code: string; users: number }[];
  flags: AnomalyFlag[];
};

const KIND_LABEL: Record<string, string> = {
  redeem: "リデーム付与",
  stripe_pack: "パック購入",
  ai_usage: "AI利用",
  purchase: "作品購入",
  tip_sent: "サンクス送信",
  tip_received: "サンクス受取",
  admin: "運営調整",
  refund: "返金",
};

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

/** フラグ 1 件を人間可読な 1 行に。 */
function flagLine(f: AnomalyFlag): string {
  switch (f.type) {
    case "heavy_ai":
      return `🤖 AI連打: ${shortId(f.user_id)} が ${f.cnt} 回`;
    case "bulk_purchase":
      return `🛒 大量購入: ${shortId(f.user_id)} が ${f.cnt} 件`;
    case "tip_concentration":
      return `💝 サンクス集中: ${shortId(f.user_id)} が ${f.total.toLocaleString()}G 受取`;
    case "code_leak":
      return `🔑 コード漏洩疑い: 「${f.code}」を ${f.users} 人が引き換え`;
  }
}

/**
 * ダイジェスト本文(Discord 用プレーンテキスト)を組み立てる純関数。
 * 兆候(flags)があれば見出しを ⚠️ に、無ければ ✅ に。
 */
export function formatAnomalyDigest(report: AnomalyReport): string {
  const hasFlags = report.flags.length > 0;
  const head = hasFlags
    ? `⚠️ 異常検知ダイジェスト(直近${report.hours}時間) — 要確認 ${report.flags.length} 件`
    : `✅ 日次ダイジェスト(直近${report.hours}時間) — 異常なし`;

  const lines: string[] = [head, ""];

  if (hasFlags) {
    for (const f of report.flags) lines.push(flagLine(f));
    lines.push("");
  }

  const goldSummary =
    report.gold_by_kind.length > 0
      ? report.gold_by_kind
          .map(
            (g) =>
              `${KIND_LABEL[g.kind] ?? g.kind} ${g.cnt}件/${g.total.toLocaleString()}G`,
          )
          .join(" · ")
      : "(なし)";
  lines.push(`💰 ゴールド: ${goldSummary}`);
  lines.push(`🎟 リデーム: ${report.redeems_total} 件`);

  if (report.top_codes.length > 0) {
    const codes = report.top_codes
      .map((c) => `${c.code}(${c.users}人)`)
      .join(" · ");
    lines.push(`　多く使われたコード: ${codes}`);
  }

  // Discord の 2000 字上限に対する保険。
  return lines.join("\n").slice(0, 1900);
}

export type AnomalyRunResult =
  | { ok: true; posted: boolean; flags: number }
  | { ok: false; message: string };

/**
 * 集計 → Discord 送信までを実行。webhook 未設定なら posted:false(集計だけ返す)。
 */
export async function runAnomalyReport(
  hours = 24,
): Promise<AnomalyRunResult> {
  let report: AnomalyReport;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("anomaly_report", {
      p_hours: hours,
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    report = data as AnomalyReport;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "unknown" };
  }

  const posted = await postOperatorAlert(formatAnomalyDigest(report));
  return { ok: true, posted, flags: report.flags.length };
}
