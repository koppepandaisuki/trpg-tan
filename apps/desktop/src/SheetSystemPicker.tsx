import { useState } from "react";
import { Globe, FilePlus2, Sparkles, History } from "lucide-react";
import type { SystemDef, CharacterSheet } from "@trpg/core";
import { getAllSystems } from "./systems-store";
import { importVampireBloodSheet } from "./vampire-import";
import { SystemIcon } from "./system-visuals";

/** 最近使ったシステム(id 配列, 先頭が最新)。coc7/coc6 or 自作システムの id。 */
const RECENT_KEY = "paradice.sheet.recentSystems";
const RECENT_MAX = 4;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const next = [id, ...readRecents().filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // 保存失敗は無視(履歴は副次的)
  }
}

/**
 * キャラシ作成の入口: まず「どのシステムのキャラを作るか」を選ぶ画面。
 * カードをクリックするとそのシステムのエディタへ直行する。
 *
 * 並び: CoC 第7版 / 第6版(定番を先頭・大きめ) → ビルダーのプリセット/自作 →
 * 他サイト取り込み(キャラクター保管所)。
 */
export function SheetSystemPicker({
  onPickCoC,
  onPickGeneric,
  onImported,
}: {
  /** CoC の版を選んで新規作成。 */
  onPickCoC: (systemId: "coc7" | "coc6") => void;
  /** ビルダー系システムで新規作成。 */
  onPickGeneric: (def: SystemDef) => void;
  /** 保管所などから取り込んだシートをエディタで開く。 */
  onImported: (sheet: CharacterSheet) => void;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);

  async function runImport() {
    setImportBusy(true);
    setImportErr(null);
    try {
      const sheet = await importVampireBloodSheet(importUrl);
      setImportUrl("");
      setImportOpen(false);
      onImported(sheet);
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "取り込みに失敗しました");
    } finally {
      setImportBusy(false);
    }
  }

  const systems = getAllSystems();

  // 選択を記録してから遷移(次回ピッカーの先頭に出す)。
  function pickCoC(sid: "coc7" | "coc6") {
    pushRecent(sid);
    onPickCoC(sid);
  }
  function pickGeneric(def: SystemDef) {
    pushRecent(def.id);
    onPickGeneric(def);
  }

  // 最近使ったシステムを表示用に解決(消された自作システムはスキップ)。
  const recents = readRecents()
    .map((id) => {
      if (id === "coc7")
        return { id, emoji: null, name: "クトゥルフ神話TRPG 第7版", pick: () => pickCoC("coc7") };
      if (id === "coc6")
        return { id, emoji: null, name: "クトゥルフ神話TRPG 第6版", pick: () => pickCoC("coc6") };
      const def = systems.find((s) => s.id === id);
      return def
        ? { id, emoji: def.icon, name: def.name || "(名称未設定)", pick: () => pickGeneric(def) }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="syspick">
      <div className="syspick-hero">
        <span className="syspick-spark">
          <Sparkles size={20} aria-hidden />
        </span>
        <h2>キャラクターを作る</h2>
        <p>
          まず遊ぶシステムを選んでください。クリックするとそのシステムの
          キャラクターシートが開きます。
        </p>
      </div>

      {/* 最近使ったシステム(ワンクリックで再開) */}
      {recents.length > 0 && (
        <>
          <h3 className="syspick-sec">
            <History size={12} aria-hidden /> 最近使った
          </h3>
          <div className="syspick-recents">
            {recents.map((r) => (
              <button key={r.id} className="syspick-recent" onClick={r.pick}>
                <SystemIcon systemId={r.id} emoji={r.emoji} size="sm" />
                <span className="sp-name">{r.name}</span>
                <span className="sp-go">→</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* 定番: クトゥルフ(大きめの2枚) */}
      <div className="syspick-grid featured">
        <button
          className="syspick-card featured sp-coc7"
          onClick={() => pickCoC("coc7")}
        >
          <SystemIcon systemId="coc7" size="lg" />
          <span className="sp-name">クトゥルフ神話TRPG</span>
          <span className="sp-sub">第7版(新クトゥルフ)</span>
          <span className="sp-desc">
            能力値ロール・職業・技能割り振りまでガイド付き。いちばん遊ばれている定番。
          </span>
          <span className="sp-go">作成する →</span>
        </button>
        <button
          className="syspick-card featured sp-coc6"
          onClick={() => pickCoC("coc6")}
        >
          <SystemIcon systemId="coc6" size="lg" />
          <span className="sp-name">クトゥルフ神話TRPG</span>
          <span className="sp-sub">第6版</span>
          <span className="sp-desc">
            長く遊ばれてきたクラシック版。既存シナリオの多くはこちら。
          </span>
          <span className="sp-go">作成する →</span>
        </button>
      </div>

      {/* その他のシステム(ビルダーのプリセット + 自作) */}
      {systems.length > 0 && (
        <>
          <h3 className="syspick-sec">その他のシステム</h3>
          <div className="syspick-grid">
            {systems.map((s) => (
              <button
                key={s.id}
                className="syspick-card"
                onClick={() => pickGeneric(s)}
              >
                <SystemIcon systemId={s.id} emoji={s.icon} />
                <span className="sp-name">{s.name || "(名称未設定)"}</span>
                {s.preset === false && <span className="sp-tag">自作</span>}
                <span className="sp-go">作成する →</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* 他サイトから取り込み */}
      <h3 className="syspick-sec">他サイトから取り込み</h3>
      <div className="syspick-grid">
        {!importOpen ? (
          <button
            className="syspick-card sp-import"
            onClick={() => setImportOpen(true)}
          >
            <span
              className="sysic md"
              style={{ "--si-c": "#37ace8" } as React.CSSProperties}
              aria-hidden
            >
              <Globe />
            </span>
            <span className="sp-name">キャラクター保管所</span>
            <span className="sp-desc">
              シートの URL を貼るだけで取り込み(クトゥルフ6版/7版対応)。
            </span>
            <span className="sp-go">URL を入力 →</span>
          </button>
        ) : (
          <div className="syspick-card sp-import open">
            <span className="sp-name">
              <Globe size={15} /> キャラクター保管所から取り込み
            </span>
            <input
              className="input"
              autoFocus
              value={importUrl}
              placeholder="https://charasheet.vampire-blood.net/12345"
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runImport()}
              disabled={importBusy}
            />
            <div className="sp-import-actions">
              <button
                className="btn mini"
                onClick={() => {
                  setImportOpen(false);
                  setImportErr(null);
                }}
              >
                キャンセル
              </button>
              <button
                className="btn mini btn-primary"
                onClick={() => void runImport()}
                disabled={importBusy || !importUrl.trim()}
              >
                {importBusy ? "取得中…" : "取り込む"}
              </button>
            </div>
            {importErr && <p className="sp-import-err">{importErr}</p>}
          </div>
        )}
      </div>

      <p className="syspick-foot muted">
        <FilePlus2 size={12} aria-hidden /> 保存済みのキャラは左の一覧から開けます。
        新しいシステムは「ビルダー」で自作すると、ここに並びます。
      </p>
    </div>
  );
}
