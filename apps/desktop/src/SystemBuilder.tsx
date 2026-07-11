import { useState } from "react";
import { Package, Store } from "lucide-react";
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
import { exportPackToFile, publishPack } from "./pack";
import { openExternalUrl as openUrl, WEB_BASE } from "./platform";

// WEB_BASE は platform.ts(Tauri=env / ブラウザ=同一オリジン相対)
import { getPlayIndex, readPlayFromPath } from "./play-storage";
import { getLibrary } from "./library";
import { readSheetFromPath, isGenericSheet, isTauri } from "./storage";
import { toast } from "./Toasts";
import { supabaseConfigured } from "./supabase";
import { useAuth } from "./useAuth";

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
/** 出品確認画面で見せるパッケージのプレビュー(gatherPack の結果)。 */
type PackPreview = {
  pack: ReturnType<typeof buildPack>;
  scenarios: number;
  sheets: number;
};

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
  const [pubOpen, setPubOpen] = useState(false);
  const [pubPrice, setPubPrice] = useState(0);
  const [publishing, setPublishing] = useState(false);
  // 出品は 2 段階。"form"(価格入力) → "confirm"(内容確認)。誤作動での未完成品
  // 投稿を防ぐため、確認画面を必ず一段階挟む。
  const [pubPhase, setPubPhase] = useState<"form" | "confirm">("form");
  const [pubPreview, setPubPreview] = useState<PackPreview | null>(null);
  const [preparing, setPreparing] = useState(false);
  const { session } = useAuth();

  /** 出品ダイアログを閉じてフェーズもリセット。 */
  function closePublish() {
    setPubOpen(false);
    setPubPhase("form");
    setPubPreview(null);
  }

  /**
   * 出品できる最低基準。満たさない項目の説明文を配列で返す(空なら出品可)。
   * 誤作動・未完成品の出品を防ぐための最小限のチェック。
   */
  function publishIssues(): string[] {
    if (!draft) return ["システムが選択されていません。"];
    const errs: string[] = [];
    const name = draft.name.trim();
    if (name.length < 2) errs.push("システム名を 2 文字以上にしてください。");
    const fields =
      draft.attributes.length + draft.skills.length + draft.resources.length;
    if (fields === 0)
      errs.push("能力値・技能・リソースを合わせて 1 つ以上設定してください。");
    return errs;
  }

  /** 価格入力 → 内容確認へ。パッケージを集めてプレビューを作る。 */
  async function goConfirm() {
    if (!draft) return;
    setPreparing(true);
    try {
      const g = await gatherPack();
      if (!g) return;
      setPubPreview(g);
      setPubPhase("confirm");
    } catch (e) {
      toast(`準備に失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPreparing(false);
    }
  }

  /** このシステム + 同システムの卓・プリジェネを集めてパッケージ化する。 */
  async function gatherPack(): Promise<{
    pack: ReturnType<typeof buildPack>;
    scenarios: number;
    sheets: number;
  } | null> {
    if (!draft) return null;
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
    return { pack, scenarios: scenarios.length, sheets: sheets.length };
  }

  /** .paradice ファイルに書き出す(ローカル配布用)。 */
  async function handleExport() {
    if (!draft) return;
    setExporting(true);
    try {
      const g = await gatherPack();
      if (!g) return;
      const path = await exportPackToFile(g.pack);
      if (path) {
        toast(
          `📦 「${g.pack.name}」を書き出しました（シナリオ${g.scenarios} / プリジェネ${g.sheets}）`,
        );
      }
    } catch (e) {
      toast(`書き出しに失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  /**
   * 確認画面からの最終出品(下書き作成 + .paradice アップロード)。公開は web で
   * 確認後。確認画面で作ったプレビューをそのまま使う(再集計しない)。
   */
  async function handlePublish() {
    if (!draft || !pubPreview) return;
    // 最低基準を満たさないものはここでも弾く(二重の防御)。
    if (publishIssues().length > 0) return;
    setPublishing(true);
    try {
      const r = await publishPack(pubPreview.pack, {
        title: pubPreview.pack.name,
        priceJpy: pubPrice,
      });
      closePublish();
      toast(
        "🛒 下書きを作成しました。ブラウザで表紙を設定して公開してください。",
      );
      // 仕上げ(表紙・価格確認・公開)の web ページを直接開く。
      void openUrl(`${WEB_BASE}/creator/products/${r.productId}/edit`);
    } catch (e) {
      toast(`出品に失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPublishing(false);
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
                  {isTauri() && supabaseConfigured && session && (
                    <button
                      className="btn mini ibtn"
                      onClick={() => setPubOpen((v) => !v)}
                      title="このパッケージをストアに出品（下書き作成＋アップロード）"
                    >
                      <Store size={14} /> 出品
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

            {pubOpen && pubPhase === "form" && (
              <div className="sysb-publish">
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  このシステム＋同システムの卓・プリジェネを{" "}
                  <b>フルパッケージ</b>として<b>下書き出品</b>します。次の画面で
                  内容を確認してから出品します。公開は web のクリエイターページで
                  表紙・価格を確認してから行ってください。
                </p>
                <div className="sysb-publish-row">
                  <label className="sysb-label" style={{ maxWidth: 220 }}>
                    価格（円。0 = 無料）
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      value={pubPrice}
                      onChange={(e) =>
                        setPubPrice(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </label>
                  <span style={{ flex: 1 }} />
                  <button className="btn mini" onClick={closePublish}>
                    キャンセル
                  </button>
                  <button
                    className="btn mini btn-primary ibtn"
                    onClick={() => void goConfirm()}
                    disabled={preparing}
                  >
                    {preparing ? "準備中…" : "内容を確認する →"}
                  </button>
                </div>
              </div>
            )}

            {pubOpen && pubPhase === "confirm" && pubPreview && (
              <div className="sysb-publish">
                <p style={{ fontSize: 13, margin: 0, fontWeight: 700 }}>
                  この内容で下書き出品します。よろしいですか？
                </p>
                <ul className="sysb-confirm-list">
                  <li>
                    <span>システム</span>
                    <b>{pubPreview.pack.name}</b>
                  </li>
                  <li>
                    <span>同梱シナリオ（卓）</span>
                    <b>{pubPreview.scenarios} 件</b>
                  </li>
                  <li>
                    <span>同梱プリジェネ</span>
                    <b>{pubPreview.sheets} 件</b>
                  </li>
                  <li>
                    <span>価格</span>
                    <b>
                      {pubPrice === 0
                        ? "無料"
                        : `¥${pubPrice.toLocaleString("ja-JP")}`}
                    </b>
                  </li>
                </ul>

                {publishIssues().length > 0 ? (
                  <div className="sysb-issues">
                    <p style={{ margin: "0 0 4px", fontWeight: 700 }}>
                      ⚠ 出品の前に次を直してください
                    </p>
                    <ul>
                      {publishIssues().map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
                    出品すると<b>下書き</b>が作られ、ブラウザのクリエイターページが
                    開きます。表紙・説明・価格を整えてから「公開」してください
                    （この時点ではまだ販売されません）。
                  </p>
                )}

                <div className="sysb-publish-row">
                  <button
                    className="btn mini"
                    onClick={() => setPubPhase("form")}
                  >
                    ← 戻る
                  </button>
                  <span style={{ flex: 1 }} />
                  <button className="btn mini" onClick={closePublish}>
                    キャンセル
                  </button>
                  <button
                    className="btn mini btn-primary ibtn"
                    onClick={() => void handlePublish()}
                    disabled={publishing || publishIssues().length > 0}
                  >
                    <Store size={14} />{" "}
                    {publishing ? "出品中…" : "この内容で下書き出品"}
                  </button>
                </div>
              </div>
            )}

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
