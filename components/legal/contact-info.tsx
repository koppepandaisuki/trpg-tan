import Link from "next/link";
import type { Route } from "next";
import { getOperator } from "@/lib/legal/operator";

/**
 * 規約類の「お問い合わせ先」。メール(env: CONTACT_EMAIL)があればメールを、
 * 無ければ不具合報告フォーム + Discord を案内する。
 */
export function ContactInfo({ purpose }: { purpose?: string }) {
  const { email } = getOperator();
  const discord = process.env.NEXT_PUBLIC_ALPHA_DISCORD_INVITE_URL;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {email && (
        <li>
          メール:{" "}
          <a className="underline" href={`mailto:${email}`}>
            {email}
          </a>
          {purpose ? `(${purpose})` : ""}
        </li>
      )}
      <li>
        サイト内の
        <Link className="underline" href={"/help" as Route}>
          ヘルプ
        </Link>
        にある「不具合・ご意見を送る」フォーム
      </li>
      {discord && (
        <li>
          公式 Discord コミュニティ(
          <a className="underline" href={discord} target="_blank" rel="noopener noreferrer">
            参加する
          </a>
          )
        </li>
      )}
    </ul>
  );
}
