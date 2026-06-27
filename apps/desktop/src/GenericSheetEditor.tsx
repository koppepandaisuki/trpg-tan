import { useRef, useState } from "react";
import {
  newGenericSheet,
  renderPaletteTemplate,
  type GenericSheet,
  type SystemDef,
} from "@trpg/core";
import { saveGenericSheet, saveSheetToPath, isTauri } from "./storage";
import { toast } from "./Toasts";

/**
 * 汎用キャラクターシート・エディタ(カスタムシステム用)。
 * SystemDef(能力値・技能・リソース)に沿ったフォームを自動生成する。
 * 保存は CoC と同じ .ccsheet(JSON / kind:"generic")。
 */
export function GenericSheetEditor({
  def,
  initial,
  initialPath,
  onSaved,
}: {
  /** 由来システム(再生成ボタン等で参照。開けないときは null)。 */
  def: SystemDef | null;
  /** 既存シート(null なら def から新規作成)。 */
  initial: GenericSheet | null;
  /** 既存キャラのファイルパス(ライブラリから開いたとき)。上書き保存に使う。 */
  initialPath?: string | null;
  onSaved: (sheet: GenericSheet, path: string) => void;
}) {
  const [sheet, setSheet] = useState<GenericSheet>(() => {
    if (initial) return initial;
    if (def) return newGenericSheet(def, crypto.randomUUID());
    throw new Error("システム定義かシートのどちらかが必要です");
  });
  // 現在の保存先。あれば「保存」で上書き、無ければ別名保存ダイアログを出す。
  const [currentPath, setCurrentPath] = useState<string | null>(
    initialPath ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function patch(p: Partial<GenericSheet>) {
    setSheet((s) => ({ ...s, ...p }));
  }

  function pickPortrait(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patch({ image: String(reader.result) });
    reader.readAsDataURL(file);
  }

  /** 上書き保存。保存先が未確定(新規)なら別名保存にフォールバック。 */
  async function save() {
    if (!isTauri()) {
      setError("保存にはデスクトップアプリが必要です");
      return;
    }
    setError(null);
    try {
      let path = currentPath;
      if (path) {
        await saveSheetToPath(sheet, path);
      } else {
        path = await saveGenericSheet(sheet);
        if (!path) return; // キャンセル
        setCurrentPath(path);
      }
      onSaved(sheet, path);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
      toast(currentPath ? "✓ 上書き保存しました" : "✓ キャラを保存しました");
    } catch (e) {
      setError(`保存に失敗しました: ${String(e)}`);
    }
  }

  /** 別名で保存(常にダイアログ)。以後はその新しいパスへ上書きする。 */
  async function saveAs() {
    if (!isTauri()) {
      setError("保存にはデスクトップアプリが必要です");
      return;
    }
    setError(null);
    try {
      const path = await saveGenericSheet(sheet);
      if (!path) return;
      setCurrentPath(path);
      onSaved(sheet, path);
      toast("✓ 別名で保存しました");
    } catch (e) {
      setError(`保存に失敗しました: ${String(e)}`);
    }
  }

  /** パレットをシステム雛形 + 現在の値から作り直す。 */
  function regeneratePalette() {
    if (!def) return;
    patch({ palette: renderPaletteTemplate(def.palette ?? [], sheet) });
  }

  return (
    <div className="gse">
      <div className="gse-head">
        <span className="gse-sys">
          {def?.icon ?? "🎲"} {sheet.systemName}
        </span>
        <input
          className="input gse-name"
          value={sheet.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="キャラクター名"
        />
        <button
          className="btn"
          onClick={() => void saveAs()}
          title="別の名前/場所に保存"
        >
          別名で保存
        </button>
        <button
          className="btn btn-primary"
          onClick={() => void save()}
          title={
            currentPath
              ? "同じファイルに上書き保存（ダイアログを出しません）"
              : "保存先を選んで保存"
          }
        >
          {savedFlash
            ? "✓ 保存しました"
            : currentPath
              ? "上書き保存"
              : "保存 (.ccsheet)"}
        </button>
      </div>

      {error && <p className="tag fail">{error}</p>}
      {def?.note && <p className="sysb-note">📌 {def.note}</p>}

      <div className="gse-cols">
        {/* 左: ポートレート + リソース + メモ */}
        <section className="gse-sec">
          <h3>🖼 ポートレート</h3>
          <div
            className="gse-portrait"
            onClick={() => fileRef.current?.click()}
            title="クリックで画像を選択"
          >
            {sheet.image ? <img src={sheet.image} alt="" /> : <span>＋ 画像</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => pickPortrait(e.target.files?.[0])}
          />

          <h3>❤️ リソース</h3>
          {sheet.resources.map((r, i) => (
            <div key={i} className="sysb-row">
              <span className="gse-rlabel">{r.label}</span>
              <input
                className="input sysb-num"
                type="number"
                value={r.current}
                onChange={(e) => {
                  const resources = [...sheet.resources];
                  resources[i] = { ...r, current: Number(e.target.value) };
                  patch({ resources });
                }}
                title="現在値"
              />
              <span className="muted">/</span>
              <input
                className="input sysb-num"
                type="number"
                value={r.max}
                onChange={(e) => {
                  const resources = [...sheet.resources];
                  resources[i] = { ...r, max: Number(e.target.value) };
                  patch({ resources });
                }}
                title="最大値"
              />
            </div>
          ))}

          <h3>📝 メモ</h3>
          <textarea
            className="input sysb-ta gse-memo"
            value={sheet.memo ?? ""}
            onChange={(e) => patch({ memo: e.target.value })}
            placeholder="設定・特技表・マニューバなど自由に"
          />
        </section>

        {/* 中: 能力値 + 技能 */}
        <section className="gse-sec">
          <h3>💪 能力値</h3>
          {sheet.attributes.length === 0 && (
            <p className="muted" style={{ fontSize: 12 }}>
              （このシステムに能力値はありません）
            </p>
          )}
          {sheet.attributes.map((a, i) => (
            <div key={i} className="sysb-row">
              <span className="gse-rlabel">{a.label}</span>
              <input
                className="input sysb-num"
                type="number"
                value={a.value}
                onChange={(e) => {
                  const attributes = [...sheet.attributes];
                  attributes[i] = { ...a, value: Number(e.target.value) };
                  patch({ attributes });
                }}
              />
            </div>
          ))}

          <h3>🎯 技能</h3>
          {sheet.skills.map((s, i) => (
            <div key={i} className="sysb-row">
              <input
                className="input"
                value={s.label}
                onChange={(e) => {
                  const skills = [...sheet.skills];
                  skills[i] = { ...s, label: e.target.value };
                  patch({ skills });
                }}
                placeholder="技能名"
              />
              <input
                className="input sysb-num"
                type="number"
                value={s.value}
                onChange={(e) => {
                  const skills = [...sheet.skills];
                  skills[i] = { ...s, value: Number(e.target.value) };
                  patch({ skills });
                }}
              />
              <button
                className="rqa-book-del"
                onClick={() =>
                  patch({ skills: sheet.skills.filter((_, j) => j !== i) })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="btn mini"
            onClick={() =>
              patch({ skills: [...sheet.skills, { label: "", value: 0 }] })
            }
          >
            ＋ 技能を追加
          </button>

          <h3>🎲 判定コマンド雛形</h3>
          <input
            className="input"
            value={sheet.checkTemplate ?? ""}
            onChange={(e) => patch({ checkTemplate: e.target.value })}
            placeholder="例: 2d6+{value}>=?"
          />
          <p className="sysb-help muted">
            卓で能力値/技能をクリックしたときのコマンド。{"{value}"}{" "}
            が値に置き換わります。
          </p>
        </section>

        {/* 右: チャットパレット */}
        <section className="gse-sec">
          <h3>
            💬 チャットパレット
            {def && (
              <button
                className="btn mini"
                style={{ marginLeft: 8 }}
                onClick={regeneratePalette}
                title="システム雛形と現在の値からパレットを作り直す"
              >
                雛形から再生成
              </button>
            )}
          </h3>
          <textarea
            className="input sysb-ta gse-palette"
            value={sheet.palette ?? ""}
            onChange={(e) => patch({ palette: e.target.value })}
            placeholder={"2d6+4>=? 回避判定\n1d6 ダメージ\n# 見出し"}
          />
          <p className="sysb-help muted">
            1 行 1 コマンド。卓に出すとこのままチャットパレットになります
            （クリックで入力欄へ、ダブルクリックで即ロール）。
          </p>
        </section>
      </div>
    </div>
  );
}
