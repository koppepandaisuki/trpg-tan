"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TAG_MAX_LENGTH,
  TAGS_MAX_COUNT,
  normalizeTag,
} from "@/lib/validators/product";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/**
 * Chip-style tag input.
 *
 * Local state for the in-progress text. Committed tags are kept in the
 * parent (via react-hook-form Controller) as a string[]. trim + lower is
 * applied on add. Duplicates and the max-count limit are silently rejected.
 */
export function TagInput({ value, onChange, disabled }: TagInputProps) {
  const [draft, setDraft] = React.useState("");
  const [info, setInfo] = React.useState<string | null>(null);

  const atMax = value.length >= TAGS_MAX_COUNT;

  function add() {
    const normalized = normalizeTag(draft);
    if (!normalized) {
      setInfo("タグを入力してください");
      return;
    }
    if (value.includes(normalized)) {
      setInfo("同じタグはすでに追加されています");
      return;
    }
    if (atMax) {
      setInfo(`タグは${TAGS_MAX_COUNT}個までです`);
      return;
    }
    onChange([...value, normalized]);
    setDraft("");
    setInfo(null);
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
    setInfo(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      // 入力欄が空のときの Backspace で末尾チップを削除
      remove(value[value.length - 1]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && (
          <p className="text-xs text-muted-foreground">タグはまだ設定されていません</p>
        )}
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="muted"
            className="inline-flex items-center gap-1 px-2 py-1"
          >
            <span>#{tag}</span>
            <button
              type="button"
              onClick={() => remove(tag)}
              disabled={disabled}
              aria-label={`タグ ${tag} を削除`}
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (info) setInfo(null);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            atMax
              ? `タグは${TAGS_MAX_COUNT}個までです`
              : "タグを入力(英数小文字、Enterで追加)"
          }
          disabled={disabled || atMax}
          maxLength={TAG_MAX_LENGTH}
          className="flex-1"
          aria-label="タグを入力"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={disabled || atMax}
        >
          <Plus className="h-4 w-4" />
          追加
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        現在 {value.length} / {TAGS_MAX_COUNT} 件。タグは自動で小文字に変換されます。
        {info && <span className="ml-2 text-destructive">{info}</span>}
      </p>
    </div>
  );
}
