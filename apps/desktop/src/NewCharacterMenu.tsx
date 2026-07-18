import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown, Globe, ClipboardPaste } from "lucide-react";
import {
  genericSheetFromCcfolia,
  type SystemDef,
  type CharacterSheet,
  type GenericSheet,
} from "@trpg/core";
import { getAllSystems } from "./systems-store";
import { importVampireBloodSheet } from "./vampire-import";

/**
 * 「＋ 新規」キャラクター作成メニュー。CoC を特別扱いせず、追加済みの全システム
 * (CoC / ビルダーのプリセット / 自作)を 1 つのフラットな一覧として並べ、どれからでも
 * 対等に作成できる。CoC はエディタ内で 6版/7版 を切替。自作には「自作」タグを付ける。
 *
 * 追加: キャラクター保管所(charasheet.vampire-blood.net)の URL 取り込みと、
 * ココフォリア駒(「コマをコピー」した JSON)の貼り付け取り込み。
 *
 * .chars-list が overflow:auto でクリップするため、メニューは fixed 配置にして
 * ボタンの矩形から座標を出す(クリッピングを回避)。
 */
export function NewCharacterMenu({
  onNewCoC,
  onNewGeneric,
  onImported,
  onImportedGeneric,
}: {
  onNewCoC: () => void;
  onNewGeneric: (def: SystemDef) => void;
  /** 保管所などから取り込んだシートをエディタで開く。 */
  onImported?: (sheet: CharacterSheet) => void;
  /** ココフォリア駒の貼り付けなどから取り込んだ汎用シートをエディタで開く。 */
  onImportedGeneric?: (sheet: GenericSheet) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // 保管所インポートのミニフォーム。
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);

  // ココフォリア駒貼り付けのミニフォーム。
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteErr, setPasteErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        closeAll();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function closeAll() {
    setOpen(false);
    setImportOpen(false);
    setPasteOpen(false);
    setPasteErr(null);
    setImportErr(null);
  }

  function toggle() {
    if (open) {
      closeAll();
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ left: r.left, top: r.bottom + 4 });
    setOpen(true);
  }

  async function runImport() {
    setImportBusy(true);
    setImportErr(null);
    try {
      const sheet = await importVampireBloodSheet(importUrl);
      closeAll();
      setImportUrl("");
      onImported?.(sheet);
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "取り込みに失敗しました");
    } finally {
      setImportBusy(false);
    }
  }

  function runPaste(text: string) {
    const sheet = genericSheetFromCcfolia(text, crypto.randomUUID());
    if (!sheet) {
      setPasteErr(
        "ココフォリア駒の JSON ではないようです（ココフォリアで「コマをコピー」した内容を貼り付けてください）",
      );
      return;
    }
    closeAll();
    setPasteText("");
    onImportedGeneric?.(sheet);
  }

  // 開くたびに最新のシステム一覧(自作の追加・削除を反映)。CoC を先頭に置きつつ、
  // 見た目は他システムと同じ行にして“優遇”しない。自作だけ「自作」タグで識別。
  const items = open
    ? [
        {
          key: "coc",
          icon: "🐙",
          name: "クトゥルフ神話TRPG（6版 / 7版）",
          tag: null as string | null,
          pick: onNewCoC,
        },
        ...getAllSystems().map((s) => ({
          key: s.id,
          icon: s.icon ?? "🎲",
          name: s.name || "(名称未設定)",
          tag: s.preset === false ? "自作" : null,
          pick: () => onNewGeneric(s),
        })),
      ]
    : [];

  return (
    <div className="newchar" ref={wrapRef}>
      <button
        ref={btnRef}
        className="btn mini btn-primary newchar-btn"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={13} /> 新規 <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className="newchar-menu"
          role="menu"
          style={{ left: menuPos.left, top: menuPos.top }}
        >
          <div className="newchar-group">システムを選んで作成</div>
          {items.map((it) => (
            <button
              key={it.key}
              className="newchar-opt"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.pick();
              }}
            >
              <span className="newchar-ic">{it.icon}</span>
              <span className="newchar-name">{it.name}</span>
              {it.tag && <span className="newchar-tag">{it.tag}</span>}
            </button>
          ))}

          {(onImported || onImportedGeneric) && (
            <div className="newchar-group">他サイトから取り込み</div>
          )}

          {onImported && (
            <>
              {!importOpen ? (
                <button
                  className="newchar-opt"
                  role="menuitem"
                  onClick={() => {
                    setImportOpen(true);
                    setPasteOpen(false);
                  }}
                >
                  <span className="newchar-ic">
                    <Globe size={14} />
                  </span>
                  <span className="newchar-name">
                    キャラクター保管所(URL で取り込み)
                  </span>
                </button>
              ) : (
                <div className="newchar-import">
                  <input
                    className="input"
                    autoFocus
                    value={importUrl}
                    placeholder="https://charasheet.vampire-blood.net/12345"
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void runImport()}
                    disabled={importBusy}
                  />
                  <button
                    className="btn mini btn-primary"
                    onClick={() => void runImport()}
                    disabled={importBusy || !importUrl.trim()}
                  >
                    {importBusy ? "取得中…" : "取り込む"}
                  </button>
                  {importErr && (
                    <p className="newchar-import-err">{importErr}</p>
                  )}
                  <p className="muted newchar-import-hint">
                    クトゥルフ6版/7版のシートに対応。取り込み後はエディタで確認して保存してください。
                  </p>
                </div>
              )}
            </>
          )}

          {onImportedGeneric && (
            <>
              {!pasteOpen ? (
                <button
                  className="newchar-opt"
                  role="menuitem"
                  onClick={() => {
                    setPasteOpen(true);
                    setImportOpen(false);
                  }}
                >
                  <span className="newchar-ic">
                    <ClipboardPaste size={14} />
                  </span>
                  <span className="newchar-name">
                    ココフォリア駒を貼り付け
                  </span>
                </button>
              ) : (
                <div className="newchar-import">
                  <textarea
                    className="input"
                    autoFocus
                    rows={4}
                    value={pasteText}
                    placeholder={'{"kind":"character","data":{...}} をここに貼り付け'}
                    onChange={(e) => {
                      setPasteText(e.target.value);
                      setPasteErr(null);
                    }}
                    onPaste={(e) => {
                      // 貼り付けと同時に取り込みまで進める(1 アクション)。
                      const text = e.clipboardData.getData("text");
                      if (text.trim()) {
                        e.preventDefault();
                        setPasteText(text);
                        runPaste(text);
                      }
                    }}
                  />
                  <button
                    className="btn mini btn-primary"
                    onClick={() => runPaste(pasteText)}
                    disabled={!pasteText.trim()}
                  >
                    取り込む
                  </button>
                  {pasteErr && <p className="newchar-import-err">{pasteErr}</p>}
                  <p className="muted newchar-import-hint">
                    ココフォリアや対応キャラ作成サイトの「コマをコピー」の内容を
                    そのまま貼り付けると、キャラシとして取り込みます。
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
