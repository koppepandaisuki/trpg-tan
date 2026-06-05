import { useMemo, useState } from "react";
import {
  coc7,
  generateAllCharacteristics,
  computeCoCDerived,
  rollCoCCheck,
  type CoCCheckResult,
} from "@trpg/core";

/**
 * 動作確認用の最小画面(キャラシ MVP の種)。@trpg/core を実際に呼び、
 * 能力値生成 → 派生値計算 → 技能判定までを通す。ここから本物のシート UI に
 * 育てる。
 */
export function App() {
  const [chars, setChars] = useState<Record<string, number>>(() =>
    generateAllCharacteristics(coc7),
  );
  const [lastCheck, setLastCheck] = useState<CoCCheckResult | null>(null);

  const derived = useMemo(() => computeCoCDerived("7", chars), [chars]);

  const spotHidden = coc7.skills.find((s) => s.key === "spot_hidden")!;

  return (
    <div className="app">
      <div className="hero">
        <h1>TRPG Desktop</h1>
        <span className="tag ok">@trpg/core 接続OK</span>
      </div>
      <p className="muted">
        Tauri + Vite + React の雛形。CoC7 の能力値生成・派生計算・技能判定を
        共有コアから呼び出しています(キャラシ MVP の出発点)。
      </p>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>能力値(クトゥルフ神話TRPG 第7版)</strong>
          <button
            className="btn btn-primary"
            onClick={() => {
              setChars(generateAllCharacteristics(coc7));
              setLastCheck(null);
            }}
          >
            ダイスで再生成
          </button>
        </div>
        <div className="grid">
          {coc7.characteristics.map((c) => (
            <div className="stat" key={c.key}>
              <div className="k">
                {c.key} {c.label}
              </div>
              <div className="v">{chars[c.key] ?? "-"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <strong>派生値</strong>
        <div className="grid">
          {coc7.derived.map((d) => (
            <div className="stat" key={d.key}>
              <div className="k">{d.label}</div>
              <div className="v">{String(derived[d.key] ?? "-")}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>
            技能判定:{spotHidden.label}(初期値 {spotHidden.base}%)
          </strong>
          <button
            className="btn"
            onClick={() => setLastCheck(rollCoCCheck(spotHidden.base, "7"))}
          >
            1D100 を振る
          </button>
        </div>
        {lastCheck && (
          <p className="row" style={{ marginTop: 12 }}>
            <span className="stat">
              <span className="k">出目</span>
              <span className="v">{lastCheck.roll}</span>
            </span>
            <span className={`tag ${lastCheck.isSuccess ? "ok" : "fail"}`}>
              {labelOf(lastCheck)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function labelOf(r: CoCCheckResult): string {
  switch (r.level) {
    case "extreme":
      return "イクストリーム成功";
    case "hard":
      return "ハード成功";
    case "regular":
      return "レギュラー成功";
    case "special":
      return "スペシャル";
    case "fumble":
      return "ファンブル";
    default:
      return "失敗";
  }
}
