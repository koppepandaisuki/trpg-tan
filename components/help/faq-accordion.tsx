import { ChevronDown } from "lucide-react";

/**
 * FAQ アコーディオン。ネイティブの <details>/<summary> を使うので
 * JavaScript なし(Server Component)で開閉が動く。アクセシビリティも
 * ブラウザ標準でカバーされる。
 *
 * カテゴリごとに FaqGroup でまとめ、各 Q&A を FaqItem で表現。
 */
export interface FaqEntry {
  question: string;
  /** 改行を含められるよう string[] で段落配列 */
  answer: string[];
}

export function FaqGroup({
  title,
  items,
}: {
  title: string;
  items: FaqEntry[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {items.map((item, i) => (
          <FaqItem key={i} item={item} />
        ))}
      </div>
    </section>
  );
}

function FaqItem({ item }: { item: FaqEntry }) {
  return (
    <details className="group bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition hover:bg-muted/50">
        <span>{item.question}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
        {item.answer.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </details>
  );
}
