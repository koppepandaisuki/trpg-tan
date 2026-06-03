import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * admin 配下の子ページ用 hero header。admin index ページの NavCard と
 * 同じトーンマッピング(users=slate / products=indigo / orders=emerald)で、
 * どのページに居るかを視覚的に分かりやすくする。
 *
 * 各子ページの先頭で本コンポーネントを呼ぶことで、サイト全体の hero と
 * 同じ視覚言語(グラデ + 装飾ブラー + 円形アイコン)になる。
 *
 * Server Component。
 */
export type AdminTone = "slate" | "indigo" | "emerald";

const TONE_GRADIENTS: Record<AdminTone, string> = {
  slate: "from-slate-500/8 via-transparent to-slate-500/5",
  indigo: "from-indigo-500/8 via-transparent to-violet-500/8",
  emerald: "from-emerald-500/8 via-transparent to-emerald-500/5",
};

const TONE_BLOB_A: Record<AdminTone, string> = {
  slate: "bg-slate-500/10",
  indigo: "bg-violet-500/10",
  emerald: "bg-emerald-500/10",
};

const TONE_BLOB_B: Record<AdminTone, string> = {
  slate: "bg-slate-400/10",
  indigo: "bg-indigo-500/10",
  emerald: "bg-emerald-400/10",
};

const TONE_BADGE: Record<AdminTone, string> = {
  slate: "border-slate-300 bg-slate-50 text-slate-700",
  indigo: "border-indigo-300 bg-indigo-50 text-indigo-700",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

interface AdminPageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: AdminTone;
  /** 件数表示(任意)。例: `total` を渡すと `12 件` のバッジが出る */
  count?: number;
}

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  tone,
  count,
}: AdminPageHeaderProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-border bg-gradient-to-br shadow-sm",
        TONE_GRADIENTS[tone],
      )}
    >
      <CardContent className="relative py-5 sm:py-6">
        {/* 装飾ブラー(サイト全体の hero と統一) */}
        <div
          className={cn(
            "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl",
            TONE_BLOB_A[tone],
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full blur-3xl",
            TONE_BLOB_B[tone],
          )}
        />

        <div className="relative z-10 flex items-start gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
              TONE_BADGE[tone],
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h1>
              {typeof count === "number" && (
                <Badge variant="muted" className="text-[10px]">
                  {count} 件
                </Badge>
              )}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
