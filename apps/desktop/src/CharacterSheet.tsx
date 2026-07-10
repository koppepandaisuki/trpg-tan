import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Heart,
  Droplets,
  Brain,
  Sword,
  Dumbbell,
  Footprints,
  Lightbulb,
  Clover,
  BookOpen,
  Diamond,
} from "lucide-react";
import { NumStepper } from "./NumStepper";
import {
  getSystem,
  generateAllCharacteristics,
  rollCharacteristicValue,
  computeCoCDerived,
  validateSkillAllocation,
  skillBaseValue,
  CCSHEET_SCHEMA_VERSION,
  type CoCEdition,
  type CharacterSheet as Sheet,
  type SystemDefinition,
  type OccupationDef,
} from "@trpg/core";
import {
  saveSheet,
  saveSheetToPath,
  loadSheetViaDialog,
  isTauri,
} from "./storage";
import { OccupationIcon } from "./OccupationIcon";
import { InfoTip } from "./InfoTip";
import {
  CHARACTERISTIC_HINT,
  DERIVED_HINT,
  abilityScale,
  abilitySectionHint,
  SKILL_SECTION_HINT,
  DERIVED_SECTION_HINT,
} from "./beginner-hints";

type SystemId = "coc7" | "coc6";
const editionOf = (id: SystemId): CoCEdition => (id === "coc7" ? "7" : "6");

function freshId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const sysIdOf = (s?: Sheet | null): SystemId =>
  s?.systemId === "coc6" ? "coc6" : "coc7";

/** 派生値タイルのアイコン(参考: ステータス画面風の枠付きプレート)。 */
const DERIVED_ICONS: Record<string, ReactNode> = {
  HP: <Heart size={13} />,
  MP: <Droplets size={13} />,
  SAN: <Brain size={13} />,
  DB: <Sword size={13} />,
  BUILD: <Dumbbell size={13} />,
  MOV: <Footprints size={13} />,
  IDEA: <Lightbulb size={13} />,
  LUCK: <Clover size={13} />,
  KNOW: <BookOpen size={13} />,
};

/** 技能カテゴリの表示順(いあきゃら風)。未分類は「その他」として最後。 */
const SKILL_CAT_ORDER = ["戦闘", "探索", "行動", "技術", "対人", "知識"];

function groupSkillsByCategory(skills: SystemDefinition["skills"]) {
  const map = new Map<string, SystemDefinition["skills"]>();
  for (const s of skills) {
    const cat =
      s.category && SKILL_CAT_ORDER.includes(s.category) ? s.category : "その他";
    const arr = map.get(cat);
    if (arr) arr.push(s);
    else map.set(cat, [s]);
  }
  return [...SKILL_CAT_ORDER, "その他"]
    .filter((c) => map.has(c))
    .map((c) => ({ cat: c, skills: map.get(c)! }));
}

/** オリジナル(自由記入)職業を表すセッション内センチネル。保存時は id=null。*/
const CUSTOM_OCC_ID = "__custom__";

/**
 * オリジナル職業の合成 OccupationDef。職業技能は全技能、職業Pは版の標準式
 * (7e: EDU×4 / 6e: EDU×20)を目安に。あくまで自由割り振り用の足場。
 */
function makeCustomOccupation(
  system: SystemDefinition,
  name: string,
): OccupationDef {
  return {
    id: CUSTOM_OCC_ID,
    name: name.trim() || "オリジナル職業",
    description: "オリジナル職業（自由記入）。職業技能は自由、職業Pの目安は標準式。",
    skillPointsFormula: system.edition === "7" ? "EDU*4" : "EDU*20",
    occupationSkills: system.skills.map((s) => s.key), // どの技能にも職業Pを振れる
    creditRating: { min: 0, max: 99 },
  };
}

interface CharacterSheetProps {
  /** 既存キャラを開くときの初期シート(新規なら null/未指定)*/
  initialSheet?: Sheet | null;
  /** 新規作成時の版(システムピッカーで選択)。initialSheet があればそちら優先。*/
  initialSystemId?: SystemId;
  /** 既存キャラのファイルパス(ライブラリから開いたとき)。上書き保存に使う。*/
  initialPath?: string | null;
  /** 保存に成功したとき(ライブラリ索引の更新用)*/
  onSaved?: (sheet: Sheet, path: string) => void;
  /** 「← システム選択」に戻る。*/
  onBack?: () => void;
}

export function CharacterSheet({
  initialSheet,
  initialSystemId,
  initialPath,
  onSaved,
  onBack,
}: CharacterSheetProps) {
  // 現在の保存先。あれば「保存」で上書き、無ければ別名保存ダイアログを出す。
  const [currentPath, setCurrentPath] = useState<string | null>(
    initialPath ?? null,
  );
  const [systemId, setSystemId] = useState<SystemId>(() =>
    initialSheet ? sysIdOf(initialSheet) : (initialSystemId ?? "coc7"),
  );
  const [id, setId] = useState<string>(() => initialSheet?.id ?? freshId());
  const [createdAt, setCreatedAt] = useState<string>(
    () => initialSheet?.meta?.createdAt ?? new Date().toISOString(),
  );
  const [name, setName] = useState(initialSheet?.name ?? "");
  const [notes, setNotes] = useState(initialSheet?.notes ?? "");
  const [backstory, setBackstory] = useState(initialSheet?.backstory ?? "");
  const [image, setImage] = useState<string | null>(
    initialSheet?.image ?? null,
  );
  const [chars, setChars] = useState<Record<string, number>>(
    () =>
      initialSheet?.characteristics ??
      generateAllCharacteristics(getSystem(sysIdOf(initialSheet))!),
  );
  const [occupationId, setOccupationId] = useState(
    initialSheet?.occupationId ?? (initialSheet?.occupationName ? CUSTOM_OCC_ID : ""),
  );
  const [occupationName, setOccupationName] = useState(
    initialSheet?.occupationName ?? "",
  );
  const [occAlloc, setOccAlloc] = useState<Record<string, number>>(
    initialSheet?.allocation?.occupation ?? {},
  );
  const [intAlloc, setIntAlloc] = useState<Record<string, number>>(
    initialSheet?.allocation?.interest ?? {},
  );
  // 専門化技能の専門名(運転〈自動車〉等)。技能キー → 名称。
  const [skillSpec, setSkillSpec] = useState<Record<string, string>>(
    initialSheet?.skillSpecialties ?? {},
  );
  // オリジナル(自由追加)技能。名前 + 値(%)を直接入力する。
  const [customSkills, setCustomSkills] = useState<
    { key: string; label: string; value: number }[]
  >(initialSheet?.customSkills ?? []);
  const [message, setMessage] = useState<string | null>(null);

  const system = getSystem(systemId) as SystemDefinition;
  const edition = editionOf(systemId);
  const derived = useMemo(
    () => computeCoCDerived(edition, chars),
    [edition, chars],
  );

  const isCustomOcc = occupationId === CUSTOM_OCC_ID;
  const occupation = useMemo<OccupationDef | null>(() => {
    if (isCustomOcc) return makeCustomOccupation(system, occupationName);
    return system.occupations.find((o) => o.id === occupationId) ?? null;
  }, [system, occupationId, occupationName, isCustomOcc]);

  const validation = useMemo(() => {
    if (!occupation) return null;
    return validateSkillAllocation(system, occupation, chars, {
      occupation: occAlloc,
      interest: intAlloc,
    });
  }, [system, occupation, chars, occAlloc, intAlloc]);

  function resetCharacter(nextSystem: SystemId) {
    const sys = getSystem(nextSystem)!;
    setSystemId(nextSystem);
    setChars(generateAllCharacteristics(sys));
    setOccupationId("");
    setOccupationName("");
    setOccAlloc({});
    setIntAlloc({});
    setSkillSpec({});
    setCustomSkills([]);
    setImage(null);
    setId(freshId());
    setCreatedAt(new Date().toISOString());
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    e.target.value = ""; // 同じファイルを再選択できるように
  }

  function finalValue(skillKey: string, base: number): number {
    return base + (occAlloc[skillKey] ?? 0) + (intAlloc[skillKey] ?? 0);
  }

  function buildSheet(): Sheet {
    const skills: Record<string, number> = {};
    for (const s of system.skills)
      skills[s.key] = finalValue(s.key, skillBaseValue(s, chars));
    const specialties: Record<string, string> = {};
    for (const [k, v] of Object.entries(skillSpec)) {
      const t = v.trim();
      if (t) specialties[k] = t;
    }
    const cleanCustom = customSkills
      .filter((c) => c.label.trim())
      .map((c) => ({ key: c.key, label: c.label.trim(), value: c.value }));
    for (const c of cleanCustom) skills[c.key] = c.value; // PLAY 消費側も見られるように
    return {
      schemaVersion: CCSHEET_SCHEMA_VERSION,
      id,
      systemId,
      name,
      image,
      characteristics: chars,
      skills,
      skillSpecialties: Object.keys(specialties).length ? specialties : undefined,
      customSkills: cleanCustom.length ? cleanCustom : undefined,
      occupationId: isCustomOcc ? null : occupationId || null,
      occupationName: isCustomOcc
        ? occupationName.trim() || "オリジナル職業"
        : null,
      allocation: { occupation: occAlloc, interest: intAlloc },
      notes,
      backstory,
      meta: { createdAt, updatedAt: new Date().toISOString() },
    };
  }

  function applySheet(sheet: Sheet) {
    const sysId: SystemId = sheet.systemId === "coc6" ? "coc6" : "coc7";
    setSystemId(sysId);
    setId(sheet.id || freshId());
    setCreatedAt(sheet.meta?.createdAt ?? new Date().toISOString());
    setName(sheet.name ?? "");
    setNotes(sheet.notes ?? "");
    setBackstory(sheet.backstory ?? "");
    setImage(sheet.image ?? null);
    setChars(sheet.characteristics ?? {});
    setOccupationId(
      sheet.occupationId ?? (sheet.occupationName ? CUSTOM_OCC_ID : ""),
    );
    setOccupationName(sheet.occupationName ?? "");
    setOccAlloc(sheet.allocation?.occupation ?? {});
    setIntAlloc(sheet.allocation?.interest ?? {});
    setSkillSpec(sheet.skillSpecialties ?? {});
    setCustomSkills(sheet.customSkills ?? []);
  }

  /** 上書き保存。保存先が未確定(新規)なら別名保存にフォールバック。
   *  ブラウザ(PWA)では storage.ts が localStorage に保存する。 */
  async function onSave() {
    try {
      const sheet = buildSheet();
      if (currentPath) {
        await saveSheetToPath(sheet, currentPath);
        onSaved?.(sheet, currentPath);
        setMessage("上書き保存しました");
        return;
      }
      const path = await saveSheet(sheet);
      if (path) {
        setCurrentPath(path);
        onSaved?.(sheet, path);
        setMessage("保存しました(ライブラリに追加)");
      } else {
        setMessage("保存をキャンセルしました");
      }
    } catch (e) {
      setMessage(`保存に失敗: ${String(e)}`);
    }
  }

  /** 別名で保存(Tauri はダイアログ / ブラウザは新規保存)。以後はその新しいパスへ上書き。 */
  async function onSaveAs() {
    try {
      const sheet = buildSheet();
      const path = await saveSheet(sheet);
      if (path) {
        setCurrentPath(path);
        onSaved?.(sheet, path);
        setMessage("別名で保存しました");
      } else {
        setMessage("保存をキャンセルしました");
      }
    } catch (e) {
      setMessage(`保存に失敗: ${String(e)}`);
    }
  }

  async function onImport() {
    if (!isTauri()) {
      setMessage("読込はデスクトップアプリ(tauri dev/build)でのみ利用できます");
      return;
    }
    try {
      const result = await loadSheetViaDialog();
      if (result) {
        applySheet(result.sheet);
        setCurrentPath(result.path); // 以後はこのファイルへ上書きできる
        onSaved?.(result.sheet, result.path); // ライブラリにも索引を残す
        setMessage("読み込みました");
      }
    } catch (e) {
      setMessage(`読込に失敗: ${String(e)}`);
    }
  }

  // Ctrl+S / Cmd+S で保存(WebView 既定の動作を抑止)。
  // 依存を持たせず毎レンダーで貼り直し、常に最新の onSave を呼ぶ。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void onSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app cs-editor">
      {/* sticky ツールバー: 戻る / システム / 保存系。スクロールしても常に手元に。 */}
      <div className="sheet-topbar">
        {onBack && (
          <button
            className="btn mini sheet-back"
            onClick={onBack}
            title="システム選択に戻る"
          >
            <ArrowLeft size={14} /> システム選択
          </button>
        )}
        <span className="sheet-sysbadge">🐙 {system.label}</span>
        <div className="tabs sheet-edtabs">
          {(["coc7", "coc6"] as SystemId[]).map((sid) => (
            <button
              key={sid}
              className={`tab ${systemId === sid ? "active" : ""}`}
              onClick={() => resetCharacter(sid)}
              title="版を切り替える(入力はリセットされます)"
            >
              {sid === "coc7" ? "7版" : "6版"}
            </button>
          ))}
        </div>
        <span className="sheet-name-preview" title={name || "(名前未設定)"}>
          {name || "(名前未設定)"}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn mini" onClick={onImport}>
          インポート
        </button>
        <button
          className="btn mini"
          onClick={onSaveAs}
          title="別の名前/場所に保存"
        >
          別名で保存
        </button>
        <button
          className="btn mini btn-primary"
          onClick={onSave}
          title={
            currentPath
              ? "同じファイルに上書き保存 (Ctrl+S)"
              : "保存先を選んで保存 (Ctrl+S)"
          }
        >
          {currentPath ? "上書き保存" : "保存"}
        </button>
      </div>

      {/* セクションへのジャンプ */}
      <nav className="sheet-nav" aria-label="シート内の移動">
        {[
          ["cs-basic", "基本"],
          ["cs-stats", "ステータス"],
          ["cs-occ", "職業"],
          ["cs-skills", "技能"],
          ["cs-memo", "メモ"],
        ].map(([sid, label]) => (
          <button
            key={sid}
            className="sheet-nav-chip"
            onClick={() =>
              document
                .getElementById(sid)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            {label}
          </button>
        ))}
      </nav>

      {message && <p className="muted">{message}</p>}

      {/* ヒーロー: 職業チップ + 探索者名(コスチューム画面風の大見出し) */}
      <div className="cs-hero" id="cs-basic">
        <div className="cs-hero-row">
          <button
            type="button"
            className={`cs-occ-chip ${occupation ? "" : "empty"}`}
            onClick={() =>
              document
                .getElementById("cs-occ")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            title="クリックで職業の選択へ"
          >
            {occupation ? (
              <>
                <span className="cs-occ-ic">
                  {isCustomOcc ? "✏️" : <OccupationIcon id={occupation.id} />}
                </span>
                {occupation.name}
              </>
            ) : (
              "職業未選択"
            )}
          </button>
          <input
            className="cs-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="探索者名を入力"
            aria-label="探索者名"
          />
        </div>
        <div className="cs-hero-rule" />
        <p className="cs-hero-sub">
          {system.label} — 左のステータスと下の技能を割り振って完成させましょう。
        </p>
      </div>

      <div className="cs-layout">
        {/* 左カラム: ステータス(派生値) + 能力値 */}
        <div className="cs-col-stats" id="cs-stats">
          <h4 className="cs-sec-title">
            <span>ステータス</span>
            <InfoTip compact text={DERIVED_SECTION_HINT} />
            <i className="csl" />
          </h4>
          <div className="nstat-list">
            {system.derived.map((d) => (
              <div className="nstat" key={d.key}>
                <span className="nk">
                  <span className="nk-ic">
                    {DERIVED_ICONS[d.key] ?? <Diamond size={13} />}
                  </span>
                  {d.label}
                  {DERIVED_HINT[d.key] && (
                    <InfoTip compact text={DERIVED_HINT[d.key]} />
                  )}
                </span>
                <span className="nv">{String(derived[d.key] ?? "–")}</span>
              </div>
            ))}
          </div>

          <h4 className="cs-sec-title">
            <span>能力値</span>
            <InfoTip compact text={abilitySectionHint(edition)} />
            <i className="csl" />
            <button
              className="btn mini"
              onClick={() => setChars(generateAllCharacteristics(system))}
              title="全能力値をダイスで振り直す"
            >
              🎲 全部振り直す
            </button>
          </h4>
          <div className="nstat-list">
            {system.characteristics.map((c) => (
              <div className="nstat editable" key={c.key}>
                <span className="nk">
                  <span className="nk-key">{c.key}</span>
                  <span className="nk-jp">{c.label}</span>
                  <InfoTip
                    compact
                    text={`${CHARACTERISTIC_HINT[c.key] ?? ""}\n${abilityScale(edition)}`}
                  />
                </span>
                <span className="nstat-edit">
                  {c.rollHint && (
                    <button
                      type="button"
                      className="nstat-dice"
                      title={`${c.rollHint} で振り直す`}
                      onClick={() =>
                        setChars({
                          ...chars,
                          [c.key]: rollCharacteristicValue(c.rollHint!),
                        })
                      }
                    >
                      🎲
                    </button>
                  )}
                  <NumStepper
                    big
                    value={chars[c.key] ?? 0}
                    min={c.min ?? 0}
                    max={c.max ?? 99}
                    onChange={(v) => setChars({ ...chars, [c.key]: v })}
                    ariaLabel={c.label}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 中央カラム: 職業 / 技能 / メモ */}
        <div className="cs-col-main">
      {/* 職業 */}
      <div className="card" id="cs-occ">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>職業</strong>
          {occupationId && (
            <button className="btn mini" onClick={() => setOccupationId("")}>
              選択解除
            </button>
          )}
        </div>
        <div className="occ-grid">
          {system.occupations.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`occ-card ${occupationId === o.id ? "active" : ""}`}
              onClick={() => setOccupationId(o.id)}
              title={o.name}
            >
              <span className="occ-ic">
                <OccupationIcon id={o.id} />
              </span>
              <span className="occ-name">{o.name}</span>
            </button>
          ))}
          {/* オリジナル(自由記入)職業 */}
          <button
            type="button"
            className={`occ-card occ-card-custom ${isCustomOcc ? "active" : ""}`}
            onClick={() => setOccupationId(CUSTOM_OCC_ID)}
            title="オリジナル職業（自由記入）"
          >
            <span className="occ-ic">✏️</span>
            <span className="occ-name">オリジナル</span>
          </button>
        </div>

        {isCustomOcc && (
          <div className="occ-custom-input">
            <input
              className="input"
              value={occupationName}
              onChange={(e) => setOccupationName(e.target.value)}
              placeholder="職業名を自由に入力（例: 退魔師、サイバー探偵…）"
              maxLength={40}
              autoFocus
            />
          </div>
        )}

        {occupation && (
          <div className="occ-detail">
            <p className="muted">{occupation.description}</p>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <span className="chip">
                技能P式 {occupation.skillPointsFormula}
              </span>
              <span className="chip">
                信用 {occupation.creditRating.min}–
                {occupation.creditRating.max}
              </span>
              <span className="chip">
                職業技能{" "}
                {isCustomOcc
                  ? "自由（どの技能にも職業Pを振れます）"
                  : occupation.occupationSkills
                      .map(
                        (k) =>
                          system.skills.find((s) => s.key === k)?.label ?? k,
                      )
                      .join("・")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 技能割り振り */}
      <div className="card" id="cs-skills">
        {/* 長い技能表をスクロールしても残ポイントが見えるよう sticky */}
        <div className="cs-skills-head row" style={{ justifyContent: "space-between" }}>
          <strong>
            技能
            <InfoTip text={SKILL_SECTION_HINT} />
          </strong>
          {validation && (
            <div className="row" style={{ gap: 8 }}>
              <span
                className={`tag ${validation.remainingOccupation < 0 ? "fail" : "ok"}`}
              >
                職業P 残 {validation.remainingOccupation}/
                {validation.occupationBudget}
              </span>
              <span
                className={`tag ${validation.remainingInterest < 0 ? "fail" : "ok"}`}
              >
                興味P 残 {validation.remainingInterest}/
                {validation.interestBudget}
              </span>
            </div>
          )}
        </div>

        <table className="skills">
          <thead>
            <tr>
              <th>技能</th>
              <th>初期</th>
              <th>職業P</th>
              <th>興味P</th>
              <th>合計</th>
            </tr>
          </thead>
          <tbody>
            {groupSkillsByCategory(system.skills).map((group) => (
              <Fragment key={group.cat}>
                <tr className="skill-cat">
                  <td colSpan={5}>{group.cat}技能</td>
                </tr>
                {group.skills.map((s) => {
                  const isOcc = occupation?.occupationSkills.includes(s.key);
                  const base = skillBaseValue(s, chars);
                  const total = finalValue(s.key, base);
                  // 職業技能外への職業P割り振りは禁止ではなくハイライトで注意喚起
                  // (ハウスルールや追加取得に対応するため厳格ロックはしない)。
                  const occWarn = !isOcc && (occAlloc[s.key] ?? 0) > 0;
                  return (
                <tr key={s.key} className={isOcc ? "skill-occ" : undefined}>
                  <td>
                    {s.label}
                    {isOcc && <span className="dot" title="職業技能" />}
                    {s.specializable && (
                      <input
                        className="input skill-spec"
                        value={skillSpec[s.key] ?? ""}
                        onChange={(e) =>
                          setSkillSpec({ ...skillSpec, [s.key]: e.target.value })
                        }
                        placeholder="〈専門〉"
                        title="専門名（例: 自動車 / 拳銃 / 絵画 / フランス語）"
                      />
                    )}
                  </td>
                  <td className="muted">{base}</td>
                  <td>
                    <NumStepper
                      value={occAlloc[s.key] ?? 0}
                      min={0}
                      max={99}
                      warn={occWarn}
                      title={
                        occWarn
                          ? "職業技能ではない技能に職業Pを振っています"
                          : undefined
                      }
                      onChange={(v) =>
                        setOccAlloc({ ...occAlloc, [s.key]: v })
                      }
                      ariaLabel={`${s.label}の職業ポイント`}
                    />
                  </td>
                  <td>
                    <NumStepper
                      value={intAlloc[s.key] ?? 0}
                      min={0}
                      max={99}
                      onChange={(v) =>
                        setIntAlloc({ ...intAlloc, [s.key]: v })
                      }
                      ariaLabel={`${s.label}の興味ポイント`}
                    />
                  </td>
                  <td>
                    <strong>{total}</strong>
                  </td>
                </tr>
              );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>

        {/* オリジナル技能(自由追加)。名前 + 値(%)を直接入力する。 */}
        <div className="custom-skills">
          <div className="custom-skills-head">
            <strong>オリジナル技能</strong>
            <button
              className="btn mini"
              onClick={() =>
                setCustomSkills([
                  ...customSkills,
                  { key: `custom_${crypto.randomUUID()}`, label: "", value: 0 },
                ])
              }
            >
              ＋ 技能を追加
            </button>
          </div>
          {customSkills.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, margin: "4px 2px" }}>
              ルールに無い技能を自由に追加できます（名前と値を入力）。
            </p>
          ) : (
            <div className="custom-skills-list">
              {customSkills.map((c, i) => (
                <div key={c.key} className="custom-skill-row">
                  <input
                    className="input"
                    value={c.label}
                    placeholder="技能名"
                    onChange={(e) => {
                      const next = [...customSkills];
                      next[i] = { ...c, label: e.target.value };
                      setCustomSkills(next);
                    }}
                  />
                  <NumStepper
                    value={c.value}
                    min={0}
                    max={99}
                    onChange={(v) => {
                      const next = [...customSkills];
                      next[i] = { ...c, value: v };
                      setCustomSkills(next);
                    }}
                    ariaLabel={`${c.label || "オリジナル技能"}の値`}
                  />
                  <span className="muted">%</span>
                  <button
                    className="btn mini"
                    onClick={() =>
                      setCustomSkills(customSkills.filter((x) => x.key !== c.key))
                    }
                    title="削除"
                    aria-label="この技能を削除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {validation && validation.errors.length > 0 && (
          <ul className="errors">
            {validation.errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        )}
      </div>

      {/* メモ(短いプレイ用メモ。背景は下のバックストーリー欄へ) */}
      <div className="card" id="cs-memo">
        <strong>メモ</strong>
        <textarea
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="所持品・行動指針など短いメモ"
          style={{ marginTop: 8, width: "100%", resize: "vertical" }}
        />
      </div>

      {/* バックストーリー(人物背景。長文・ロール用) */}
      <div className="card">
        <strong>バックストーリー</strong>
        <p className="muted" style={{ fontSize: 11, margin: "4px 0 0" }}>
          家族・経歴・信念・過去の出来事など、読み物として残す人物設定。
        </p>
        <textarea
          className="input"
          rows={8}
          value={backstory}
          onChange={(e) => setBackstory(e.target.value)}
          placeholder="例: 田舎町で生まれ育った..."
          style={{ marginTop: 8, width: "100%", resize: "vertical" }}
        />
      </div>
        </div>

        {/* 右カラム: 立ち絵(コスチューム画面の立ち絵ポジション) */}
        <div className="cs-col-art">
          <div className="cs-art">
            {image ? (
              <img src={image} alt="ポートレート" />
            ) : (
              <div className="cs-art-empty">
                <span className="big">NO IMAGE</span>
                立ち絵・ポートレートを設定できます
              </div>
            )}
            <div className="cs-art-actions">
              <label className="btn mini">
                画像を選択
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPickImage}
                  style={{ display: "none" }}
                />
              </label>
              {image && (
                <button className="btn mini" onClick={() => setImage(null)}>
                  削除
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
