"use client";

import { Save, Send, Eye, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BuilderToolbarProps {
  mode: "create" | "edit";
  isSubmitting: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
}

/**
 * Top toolbar above the builder form.
 *
 * Buttons mirror the user-confirmed Phase 5 design:
 *   create mode: 主「下書き保存」 / 副「公開して保存」
 *   edit   mode: 主「変更を下書き保存」 / 副「公開して保存」
 *
 * 「プレビュー」「公開設定」 are placeholders (disabled).
 */
export function BuilderToolbar({
  mode,
  isSubmitting,
  onSaveDraft,
  onPublish,
}: BuilderToolbarProps) {
  const draftLabel = mode === "create" ? "下書き保存" : "変更を下書き保存";

  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {mode === "create" ? "TRPG コンテンツを作成" : "TRPG コンテンツを編集"}
          </span>
          <Badge variant="muted">P5</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled aria-label="プレビュー(準備中)">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">プレビュー</span>
          </Button>
          <Button variant="outline" size="sm" disabled aria-label="公開設定(準備中)">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">公開設定</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={isSubmitting}
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{draftLabel}</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onPublish}
            disabled={isSubmitting}
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">公開して保存</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
