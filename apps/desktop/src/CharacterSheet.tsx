import { Fragment, useMemo, useState } from "react";
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
import { saveSheet, loadSheetViaDialog, isTauri } from "./storage";
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
  /** 保存に成功したとき(ライブラリ索引の更新用)*/
  onSaved?: (sheet: Sheet, path: string) => void;
}

export function CharacterSheet({ initialSheet, onSaved }: CharacterSheetProps) {
  const [systemId, setSystemId] = useState<SystemId>(() =>
    sysIdOf(initialSheet),
  );
  const [id, setId] = useState<string>(() => initialSheet?.id ?? freshId());
  const [createdAt, setCreatedAt] = useState<string>(
    () => initialSheet?.meta?.createdAt ?? new Date().toISOString(),
  );
  const [name, setName] = useState(initialSheet?.name ?? "");
  const [notes, setNotes] = useState(initialSheet?.notes ?? "");
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
    return {
      schemaVersion: CCSHEET_SCHEMA_VERSION,
      id,
      systemId,
      name,
      image,
      characteristics: chars,
      skills,
      occupationId: isCustomOcc ? null : occupationId || null,
      occupationName: isCustomOcc
        ? occupationName.trim() || "オリジナル職業"
        : null,
      allocation: { occupation: occAlloc, interest: intAlloc },
      notes,
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
    setImage(sheet.image ?? null);
    setChars(sheet.characteristics ?? {});
    setOccupationId(
      sheet.occupationId ?? (sheet.occupationName ? CUSTOM_OCC_ID : ""),
    );
    setOccupationName(sheet.occupationName ?? "");
    setOccAlloc(sheet.allocation?.occupation ?? {});
    setIntAlloc(sheet.allocation?.interest ?? {});
  }

  async function onSave() {
    if (!isTauri()) {
      setMessage("保存はデスクトップアプリ(tauri dev/build)でのみ利用できます");
      return;
    }
    try {
      const sheet = buildSheet();
      const path = await saveSheet(sheet);
      if (path) {
        onSaved?.(sheet, path);
        setMessage("保存しました(ライブラリに追加)");
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
        onSaved?.(result.sheet, result.path); // ライブラリにも索引を残す
        setMessage("読み込みました");
      }
    } catch (e) {
      setMessage(`読込に失敗: ${String(e)}`);
    }
  }

  return (
    <div className="app">
      {/* ヘッダー + ツールバー */}
      <div className="hero">
        <h1>キャラクターシート</h1>
        <span className="tag ok">@trpg/core</span>
      </div>
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="tabs">
          {(["coc7", "coc6"] as SystemId[]).map((sid) => (
            <button
              key={sid}
              className={`tab ${systemId === sid ? "active" : ""}`}
              onClick={() => resetCharacter(sid)}
            >
              {getSystem(sid)!.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={onImport}>
          インポート
        </button>
        <button className="btn btn-primary" onClick={onSave}>
          保存(.ccsheet)
        </button>
      </div>
      {message && <p className="muted">{message}</p>}

      {/* 基本情報 + ポートレート */}
      <div className="card">
        <div className="basic">
          <div className="portrait">
            {image ? (
              <img src={image} alt="ポートレート" />
            ) : (
              <span className="portrait-empty">画像なし</span>
            )}
            <div className="portrait-actions">
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
          <label className="field" style={{ flex: 1 }}>
            <span className="k">探索者名</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名前を入力"
            />
          </label>
        </div>
      </div>

      {/* 能力値 */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>
            能力値
            <InfoTip text={abilitySectionHint(edition)} />
          </strong>
          <button
            className="btn"
            onClick={() => setChars(generateAllCharacteristics(system))}
          >
            全部振り直す
          </button>
        </div>
        <div className="grid">
          {system.characteristics.map((c) => (
            <div className="stat" key={c.key}>
              {/* 能力値は英語表記で統一(和名は ? ヒントに退避)。 */}
              <div className="k">
                {c.key}{" "}
                <InfoTip
                  compact
                  text={`${c.label}\n${CHARACTERISTIC_HINT[c.key] ?? ""}\n${abilityScale(edition)}`}
                />
              </div>
              <div className="row" style={{ gap: 4 }}>
                <input
                  className="input num"
                  type="number"
                  value={chars[c.key] ?? 0}
                  onChange={(e) =>
                    setChars({ ...chars, [c.key]: Number(e.target.value) })
                  }
                />
                {c.rollHint && (
                  <button
                    className="btn mini"
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
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 派生値 */}
      <div className="card">
        <strong>
          派生値
          <InfoTip text={DERIVED_SECTION_HINT} />
        </strong>
        <div className="grid">
          {system.derived.map((d) => {
            const val = derived[d.key];
            return (
              <div className="stat" key={d.key}>
                <div className="k">
                  {d.label}{" "}
                  {DERIVED_HINT[d.key] && (
                    <InfoTip compact text={DERIVED_HINT[d.key]} />
                  )}
                </div>
                <div className="v">{String(val ?? "-")}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 職業 */}
      <div className="card">
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
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
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
                  </td>
                  <td className="muted">{base}</td>
                  <td>
                    <input
                      className={`input num sm ${occWarn ? "occ-warn" : ""}`}
                      type="number"
                      min={0}
                      value={occAlloc[s.key] ?? 0}
                      title={
                        occWarn
                          ? "職業技能ではない技能に職業Pを振っています"
                          : undefined
                      }
                      onChange={(e) =>
                        setOccAlloc({
                          ...occAlloc,
                          [s.key]: Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input num sm"
                      type="number"
                      min={0}
                      value={intAlloc[s.key] ?? 0}
                      onChange={(e) =>
                        setIntAlloc({
                          ...intAlloc,
                          [s.key]: Number(e.target.value),
                        })
                      }
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

        {validation && validation.errors.length > 0 && (
          <ul className="errors">
            {validation.errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        )}
      </div>

      {/* メモ */}
      <div className="card">
        <strong>メモ</strong>
        <textarea
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="背景・所持品など"
          style={{ marginTop: 8, width: "100%", resize: "vertical" }}
        />
      </div>
    </div>
  );
}
