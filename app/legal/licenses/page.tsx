import { Package } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";
import { LEGAL_UPDATED_AT, SERVICE_NAME } from "@/lib/legal/operator";
import licenses from "@/lib/legal/oss-licenses.json";

export const metadata = { title: "オープンソースライセンス" };

type Entry = {
  name: string;
  versions: string[];
  license: string;
  author?: string;
  homepage?: string;
};

/**
 * 利用している OSS のライセンス一覧(scripts/gen-oss-licenses.mjs で生成)。
 * 各ライセンスの全文は各パッケージの配布物・ホームページに含まれる。
 */
export default function LicensesPage() {
  const list = licenses as Entry[];
  return (
    <LegalLayout
      title="オープンソースライセンス"
      icon={Package}
      lastUpdated={LEGAL_UPDATED_AT}
    >
      <p>
        {SERVICE_NAME}は、以下のオープンソースソフトウェアを利用しています。各ソフトウェアの
        著作権は、それぞれの著作者に帰属します。ライセンスの全文は、各ソフトウェアの
        ホームページまたは配布物に含まれています。
      </p>
      <LegalSection heading={`ウェブ・アプリのフロントエンド(${list.length})`}>
        <ul className="space-y-1 text-xs">
          {list.map((e) => (
            <li key={e.name} className="flex flex-wrap gap-x-2">
              <span className="font-semibold text-foreground">{e.name}</span>
              <span>{e.versions.join(", ")}</span>
              <span>— {e.license}</span>
              {e.author && <span>© {e.author}</span>}
              {e.homepage && (
                <a className="break-all underline" href={e.homepage} rel="noopener noreferrer" target="_blank">
                  {e.homepage}
                </a>
              )}
            </li>
          ))}
        </ul>
      </LegalSection>
      <LegalSection heading="フォント">
        <p>
          Noto Sans JP — SIL Open Font License 1.1(© Google LLC / Adobe)
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
