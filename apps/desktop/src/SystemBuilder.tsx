import { useState } from "react";
import { Package } from "lucide-react";
import {
  DICE_BOTS,
  SYSTEM_PRESETS,
  buildPack,
  type SystemDef,
  type PlayScene,
  type GenericSheet,
} from "@trpg/core";
import {
  getCustomSystems,
  upsertCustomSystem,
  removeCustomSystem,
} from "./systems-store";
import { exportPackToFile } from "./pack";
import { getPlayIndex, readPlayFromPath } from "./play-storage";
import { getLibrary } from "./library";
import { readSheetFromPath, isGenericSheet, isTauri } from "./storage";
import { toast } from "./Toasts";

/**
 * システムビルダー(ノーコード)。
 * 能力値・技能・リソース・判定コマンド雛形・チャットパレット雛形を
 * フォームで組み立てるだけで、CoC 以外のシステムのキャラシ作成と
 * PLAY(卓)が使えるようになる。
 *
 * 左: プリセット(SW2.5 / DX3rd / シノビガミ / パラノイア / N◎VA /
 *     ゆうやけこやけ / ネクロニカ / エモクロア) + 保存したカスタム。
 * 右: 選択中システムの編集フォーム。プリセットは「複製して編集」。
 */
export function SystemBuilder({
  onCreateCharacter,
}: {
  /** 「このシステムでキャラ作成」押下(App がエディタを開く)。 */
  onCreateCharacter: (def: SystemDef) => void;
}) {
  const [customs, setCustoms] = useState<SystemDef[]>(() => getCustomSystems());
  // 編集中の定義(null = 未選択)。プリセット選択時は読み取り専用表示。
  const [draft, setDraft] = useState<SystemDef | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [exporting, setExporting] = useState(false);

  /**
   * このシステム + 同システムの卓(シナリオ)・プリジェネを 1 つの .paradice に
   * 固めて書き出す(配布パッケージ。ストアに上げて売れる)。
   */
  async function handleExport() {
    if (!draft) return;
    setExporting(true);
    try {
      const scenarios: PlayScene[] = [];
      for (const e of getPlayIndex().filter((x) => x.systemId === draft.id)) {
        try {
          scenarios.push(await readPlayFromPath(e.path));
        } catch {
          // 欠損ファイルは飛ばす
        }
      }
      const sheets: GenericSheet[] = [];
      for (const e of getLibrary().filter((x) => x.systemId === draft.id)) {
        try {
          const s = await readSheetFromPath(e.path);
          if (isGenericSheet(s)) sheets.push(s);
        } catch {
          // 飛ばす
        }
      }
      const pack = buildPack({
        id: crypto.randomUUID(),
        name: draft.name.trim() || "無題のゲーム",
        now: new Date().toISOString(),
        system: draft,
        scenarios,
        sheets,
      });
      const path = await exportPackToFile(pack);
      if (path) {
        toast(
          `📦 「${pack.name}」を書き出しました（シナリオ${scenarios.length} / プリジェネ${sheets.length}）`,
        );
      }
    } catch (e) {
      toast(`書き出しに失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  const isPreset = !!draft?.preset;

  function select(def: SystemDef) {
    // 編集はコピーに対して行う(リスト側を直接書き換えない)。
    setDraft(JSON.parse(JSON.stringify(def)) as SystemDef);
    setSavedFlash(false);
  }

  function newBlank() {
    setDraft({
      id: crypto.randomUUID(),
      name: "",
      icon: "🎲",
      checkTemplate: "",
      defaultRoll: "1d100",
      attributes: [],
      skills: [],
      resources: [{ key: "hp", label: "HP", max: 10 }],
      palette: [],
      note: "",
      preset: false,
    });
  }

  /** プリセットを複製してカスタムとして編集を始める。 */
  function duplicate() {
    if (!draft) return;
    setDraft({
      ...draft,
      id: crypto.randomUUID(),
      name: `${draft.name} (カスタム)`,
      preset: false,
    });
  }

  function save() {
    if (!draft || isPreset) return;
    const next = upsertCustomSystem({
      ...draft,
      name: draft.name.trim() || "(名称未設定システム)",
    });
    setCustoms(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  function remove() {
    if (!draft || isPreset) return;
    setCustoms(removeCustomSystem(draft.id));
    setDraft(null);
  }

  /** draft の一部を書き換えるヘルパ。 */
  function patch(p: Partial<SystemDef>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  const paletteText = (draft?.palette ?? []).join("\n");

  return (
    <div className="sysb">
      {/* ===== 左: システム一覧 ===== */}
      <aside className="sysb-side">
        <div className="sidebar-head">
          <strong>システム</strong>
          <button className="btn mini btn-primary" onClick={newBlank}>
            ＋ 空から作る
          </button>
        </div>

        {customs.length > 0 && (
          <>
            <p className="sysb-group">カスタム</p>
            {customs.map((s) => (
              <button
                key={s.id}
                className={`sysb-item ${draft?.id === s.id ? "active" : ""}`}
                onClick={() => select(s)}
              >
                <span className="sysb-item-icon">{s.icon ?? "🎲"}</span>
                {s.name || "(名称未設定)"}
              </button>
            ))}
          </>
        )}

        <p className="sysb-group">プリセット（複製して編集）</p>
        {SYSTEM_PRESETS.map((s) => (
          <button
            key={s.id}
            className={`sysb-item ${draft?.id === s.id ? "active" : ""}`}
            onClick={() => select(s)}
          >
            <span className="sysb-item-icon">{s.icon ?? "🎲"}</span>
            {s.name}
          </button>
        ))}
      </aside>

      {/* ===== 右: 編集フォーム ===== */}
      <main className="sysb-main">
        {!draft ? (
          <div className="sysb-welcome">
            <h2>🛠 システムビルダー</h2>
            <p className="muted">
              プログラム不要で、CoC 以外のシステムのキャラシと PLAY
              を作れます。左のプリセットを選ぶか、「＋空から作る」で
              はじめてください。
            </p>
            <ol className="sysb-steps muted">
              <li>能力値・技能・リソースを決める</li>
              <li>
                判定コマンド雛形を書く（例: <code>2d6+{"{value}"}&gt;=?</code>
                。<code>{"{value}"}</code> がクリックした能力値に置き換わり、
                <code>?</code> は送信前に目標値へ書き換えます）
              </li>
              <li>チャットパレット雛形を書く（<code>{"{能力値名}"}</code> 参照可）</li>
              <li>保存 → 「このシステムでキャラ作成」</li>
            </ol>
          </div>
        ) : (
          <div className="sysb-form">
            <div className="sysb-form-head">
              <input
                className="input sysb-icon"
                value={draft.icon ?? ""}
                onChange={(e) => patch({ icon: e.target.value })}
                placeholder="🎲"
                title="アイコン(絵文字)"
                disabled={isPreset}
              />
              <input
                className="input sysb-name"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="システム名"
                disabled={isPreset}
              />
              {isPreset ? (
                <button className="btn btn-primary" onClick={duplicate}>
                  複製して編集
                </button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={save}>
                    {savedFlash ? "✓ 保存しました" : "保存"}
                  </button>
                  <button
                    className="btn mini share-stop"
                    onClick={remove}
                    title="このカスタムシステムを削除"
                  >
                    削除
                  </button>
                  {isTauri() && (
                    <button
                      className="btn mini ibtn"
                      onClick={() => void handleExport()}
                      disabled={exporting}
                      title="このシステム＋同システムの卓・プリジェネを .paradice に書き出す（配布用）"
                    >
                      <Package size={14} />{" "}
                      {exporting ? "書き出し中…" : "パッケージ書き出し"}
                    </button>
                  )}
                </>
              )}
              <span className="ptable-spacer" />
              <button
                className="btn btn-primary"
                onClick={() => onCreateCharacter(draft)}
              >
                👤 このシステムでキャラ作成 →
              </button>
            </div>

            {draft.note && <p className="sysb-note">📌 {draft.note}</p>}
            {isPreset && (
              <p className="sysb-note">
                プリセットは読み取り専用です。「複製して編集」で自分の
                カスタムとして調整できます（キャラ作成はそのままでも可）。
              </p>
            )}

            <div className="sysb-cols">
              {/* 判定とダイス */}
              <section className="sysb-sec">
                <h3>🎲 判定</h3>
                <label className="sysb-label">
                  ダイスボット（システム別のダイス処理）
                  <select
                    className="input"
                    value={draft.diceBot ?? "generic"}
                    onChange={(e) => patch({ diceBot: e.target.value })}
                    disabled={isPreset}
                  >
                    {DICE_BOTS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}（例: {b.help}）
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sysb-label">
                  判定コマンド雛形（能力値/技能クリック時）
                  <input
                    className="input"
                    value={draft.checkTemplate ?? ""}
                    onChange={(e) => patch({ checkTemplate: e.target.value })}
                    placeholder="例: 2d6+{value}>=?"
                    disabled={isPreset}
                  />
                </label>
                <p className="sysb-help muted">
                  {"{value}"} がクリックした値に置換され、末尾に技能名が付きます。
                  「?」は送信前に手で目標値に書き換える想定（CCFOLIA 流）。
                  空欄ならパレットだけで遊びます。
                </p>
                <label className="sysb-label">
                  基本ダイス
                  <input
                    className="input"
                    value={draft.defaultRoll ?? ""}
                    onChange={(e) => patch({ defaultRoll: e.target.value })}
                    placeholder="例: 2d6"
                    disabled={isPreset}
                  />
                </label>
                <label className="sysb-label">
                  メモ（ルールの注意書き）
                  <textarea
                    className="input sysb-ta"
                    value={draft.note ?? ""}
                    onChange={(e) => patch({ note: e.target.value })}
                    disabled={isPreset}
                  />
                </label>
              </section>

              {/* 能力値 */}
              <section className="sysb-sec">
                <h3>💪 能力値</h3>
                {draft.attributes.map((a, i) => (
                  <div key={i} className="sysb-row">
                    <input
                      className="input"
                      value={a.label}
                      onChange={(e) => {
                        const attributes = [...draft.attributes];
                        attributes[i] = { ...a, label: e.target.value };
                        patch({ attributes });
                      }}
                      placeholder="ラベル（例: 敏捷度B）"
                      disabled={isPreset}
                    />
                    <input
                      className="input sysb-num"
                      type="number"
                      value={a.initial}
                      onChange={(e) => {
                        const attributes = [...draft.attributes];
                        attributes[i] = { ...a, initial: Number(e.target.value) };
                        patch({ attributes });
                      }}
                      title="初期値"
                      disabled={isPreset}
                    />
                    {!isPreset && (
                      <button
                        className="rqa-book-del"
                        onClick={() =>
                          patch({
                            attributes: draft.attributes.filter((_, j) => j !== i),
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {!isPreset && (
                  <button
                    className="btn mini"
                    onClick={() =>
                      patch({
                        attributes: [
                          ...draft.attributes,
                          { key: `A${draft.attributes.length + 1}`, label: "", initial: 0 },
                        ],
                      })
                    }
                  >
                    ＋ 能力値を追加
                  </button>
                )}
              </section>

              {/* 技能 */}
              <section className="sysb-sec">
                <h3>🎯 技能</h3>
                {draft.skills.map((s, i) => (
                  <div key={i} className="sysb-row">
                    <input
                      className="input"
                      value={s.label}
                      onChange={(e) => {
                        const skills = [...draft.skills];
                        skills[i] = { ...s, label: e.target.value };
                        patch({ skills });
                      }}
                      placeholder="技能名"
                      disabled={isPreset}
                    />
                    <input
                      className="input sysb-num"
                      type="number"
                      value={s.initial}
                      onChange={(e) => {
                        const skills = [...draft.skills];
                        skills[i] = { ...s, initial: Number(e.target.value) };
                        patch({ skills });
                      }}
                      title="初期値"
                      disabled={isPreset}
                    />
                    {!isPreset && (
                      <button
                        className="rqa-book-del"
                        onClick={() =>
                          patch({ skills: draft.skills.filter((_, j) => j !== i) })
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {!isPreset && (
                  <button
                    className="btn mini"
                    onClick={() =>
                      patch({ skills: [...draft.skills, { label: "", initial: 0 }] })
                    }
                  >
                    ＋ 技能を追加
                  </button>
                )}
              </section>

              {/* リソース */}
              <section className="sysb-sec">
                <h3>❤️ リソース（HP など）</h3>
                {draft.resources.map((r, i) => (
                  <div key={i} className="sysb-row">
                    <input
                      className="input"
                      value={r.label}
                      onChange={(e) => {
                        const resources = [...draft.resources];
                        resources[i] = { ...r, label: e.target.value };
                        patch({ resources });
                      }}
                      placeholder="ラベル（例: HP / 侵蝕率）"
                      disabled={isPreset}
                    />
                    <input
                      className="input sysb-num"
                      type="number"
                      value={r.max}
                      onChange={(e) => {
                        const resources = [...draft.resources];
                        resources[i] = { ...r, max: Number(e.target.value) };
                        patch({ resources });
                      }}
                      title="最大値"
                      disabled={isPreset}
                    />
                    {!isPreset && (
                      <button
                        className="rqa-book-del"
                        onClick={() =>
                          patch({
                            resources: draft.resources.filter((_, j) => j !== i),
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {!isPreset && (
                  <button
                    className="btn mini"
                    onClick={() =>
                      patch({
                        resources: [
                          ...draft.resources,
                          {
                            key: `r${draft.resources.length + 1}`,
                            label: "",
                            max: 10,
                          },
                        ],
                      })
                    }
                  >
                    ＋ リソースを追加
                  </button>
                )}
              </section>

              {/* チャットパレット雛形 */}
              <section className="sysb-sec sysb-sec-wide">
                <h3>💬 チャットパレット雛形（1 行 1 コマンド）</h3>
                <textarea
                  className="input sysb-ta sysb-palette"
                  value={paletteText}
                  onChange={(e) => patch({ palette: e.target.value.split("\n") })}
                  placeholder={"2d6+{敏捷度B}>=? 回避判定\n1d6 ダメージ\n# 見出し行"}
                  disabled={isPreset}
                />
                <p className="sysb-help muted">
                  {"{能力値名}"} や {"{技能名}"}{" "}
                  は、キャラ作成時にそのキャラの値へ置き換わります。
                </p>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
