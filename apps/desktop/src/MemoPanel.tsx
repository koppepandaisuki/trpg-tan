import { useEffect, useRef, useState } from "react";
import { Users, Lock, Plus, X } from "lucide-react";
import type { MemoPage } from "@trpg/core";

/**
 * メモ(共有 / 個人)。どちらも名前付きのタブを自由に追加・削除・改名できる。
 *  - 共有: scene.sharedMemos に保存し、卓の全員へ同期する
 *  - 個人: この端末の localStorage のみ(誰にも共有されない手元メモ)
 */
const personalKey = (playId: string) => `trpg.play.memo.v2::${playId}`;
const legacyPersonalKey = (playId: string) => `trpg.play.memo.v1::${playId}`;

const uuid = () => crypto.randomUUID();

function loadPersonal(playId: string): MemoPage[] {
  try {
    const raw = localStorage.getItem(personalKey(playId));
    if (raw) {
      const parsed = JSON.parse(raw) as MemoPage[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
    // 旧形式(単一テキスト)からの移行。
    const legacy = localStorage.getItem(legacyPersonalKey(playId));
    if (legacy) return [{ id: uuid(), name: "メモ", text: legacy }];
  } catch {
    // 読み込み失敗は既定の 1 ページで。
  }
  return [{ id: "p-main", name: "メモ", text: "" }];
}

export function MemoPanel({
  playId,
  sharedMemos,
  onSharedMemosChange,
}: {
  playId: string;
  /** 共有メモのページ(親が旧 sharedMemo から移行済みの配列を渡す)。 */
  sharedMemos: MemoPage[];
  onSharedMemosChange: (pages: MemoPage[]) => void;
}) {
  const [tab, setTab] = useState<"shared" | "personal">("shared");
  const [personal, setPersonal] = useState<MemoPage[]>(() =>
    loadPersonal(playId),
  );

  // 卓が変わったら個人メモを読み直す。
  useEffect(() => {
    setPersonal(loadPersonal(playId));
  }, [playId]);

  function savePersonal(pages: MemoPage[]) {
    setPersonal(pages);
    try {
      localStorage.setItem(personalKey(playId), JSON.stringify(pages));
    } catch {
      // 容量超過などは無視(メモは副次データ)
    }
  }

  return (
    <div className="memo-panel">
      <div className="memo-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "shared"}
          className={`plog-tab ${tab === "shared" ? "active" : ""}`}
          onClick={() => setTab("shared")}
        >
          <Users size={13} /> 共有
        </button>
        <button
          role="tab"
          aria-selected={tab === "personal"}
          className={`plog-tab ${tab === "personal" ? "active" : ""}`}
          onClick={() => setTab("personal")}
        >
          <Lock size={13} /> 個人
        </button>
      </div>

      {tab === "shared" ? (
        <MemoPages
          pages={sharedMemos}
          onChange={onSharedMemosChange}
          placeholder="卓の全員と共有するメモ（.play に保存・全員に同期）"
        />
      ) : (
        <MemoPages
          pages={personal}
          onChange={savePersonal}
          placeholder="自分だけのメモ（この端末にのみ保存・共有されません）"
        />
      )}
    </div>
  );
}

/** 名前付きページのタブ + 本文。タブは追加 / 削除 / 改名できる。 */
function MemoPages({
  pages,
  onChange,
  placeholder,
}: {
  pages: MemoPage[];
  onChange: (pages: MemoPage[]) => void;
  placeholder: string;
}) {
  const [activeId, setActiveId] = useState<string | undefined>(pages[0]?.id);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // 選択中のページ(消えていたら先頭へフォールバック)。
  const active = pages.find((p) => p.id === activeId) ?? pages[0];

  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  function addPage() {
    const id = uuid();
    onChange([...pages, { id, name: `メモ${pages.length + 1}`, text: "" }]);
    setActiveId(id);
  }
  function deletePage(id: string) {
    if (pages.length <= 1) return;
    const next = pages.filter((p) => p.id !== id);
    onChange(next);
    if (activeId === id) setActiveId(next[0]?.id);
  }
  function rename(id: string, name: string) {
    onChange(
      pages.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
    );
  }
  function editText(text: string) {
    if (!active) return;
    onChange(pages.map((p) => (p.id === active.id ? { ...p, text } : p)));
  }

  return (
    <div className="memo-pages">
      <div className="memo-pagetabs" role="tablist" aria-label="メモのタブ">
        {pages.map((p) => (
          <div
            key={p.id}
            className={`memo-pagetab ${active?.id === p.id ? "active" : ""}`}
          >
            {renamingId === p.id ? (
              <input
                ref={renameRef}
                className="memo-rename"
                defaultValue={p.name}
                maxLength={24}
                onBlur={(e) => {
                  rename(p.id, e.target.value);
                  setRenamingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setRenamingId(null);
                }}
              />
            ) : (
              <button
                className="memo-pagename"
                onClick={() => setActiveId(p.id)}
                onDoubleClick={() => setRenamingId(p.id)}
                title="クリックで切替・ダブルクリックで名前変更"
              >
                {p.name || "(無題)"}
              </button>
            )}
            {pages.length > 1 && (
              <button
                className="memo-pagedel"
                onClick={() => deletePage(p.id)}
                title="このタブを削除"
                aria-label="このタブを削除"
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}
        <button
          className="memo-pageadd"
          onClick={addPage}
          title="タブを追加"
          aria-label="タブを追加"
        >
          <Plus size={13} />
        </button>
      </div>
      <textarea
        className="input memo-area"
        value={active?.text ?? ""}
        onChange={(e) => editText(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
