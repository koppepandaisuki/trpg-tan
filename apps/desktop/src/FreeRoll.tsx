import { useState } from "react";
import { rollNotation } from "@trpg/core";

/**
 * フリーロール欄(ココフォリアのチャット風)。"2d6+3" や "1d100" などの
 * ダイス記法を入力して振る。CoC 以外のシステムでも“とりあえず振れる”汎用枠。
 * trpg-core の rollNotation を使う。
 */
interface LogEntry {
  id: number;
  notation: string;
  rolls: number[];
  total: number;
}

const PRESETS = ["1D100", "1D6", "2D6", "3D6", "1D10", "1D8", "1D4", "1D20"];

export function FreeRoll() {
  const [input, setInput] = useState("1D100");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  function roll(notation: string) {
    const n = notation.trim();
    if (!n) return;
    try {
      const r = rollNotation(n);
      setLog((l) =>
        [
          { id: Date.now() + Math.random(), notation: n, rolls: r.rolls, total: r.total },
          ...l,
        ].slice(0, 8),
      );
      setError(null);
      setAnimKey((k) => k + 1);
    } catch {
      setError(`「${n}」は振れません(例: 2d6+3 / 1d100)`);
    }
  }

  const latest = log[0];

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>ダイス</strong>
        <span className="muted">記法を入力して振る(例 2d6+3)</span>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 140 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") roll(input);
          }}
          placeholder="2d6+3 / 1d100 …"
          aria-label="ダイス記法"
        />
        <button className="btn btn-primary" onClick={() => roll(input)}>
          振る
        </button>
      </div>

      <div className="row" style={{ marginTop: 8, gap: 4 }}>
        {PRESETS.map((p) => (
          <button
            key={p}
            className="btn mini"
            onClick={() => {
              setInput(p);
              roll(p);
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {error && (
        <p className="tag fail" style={{ marginTop: 8, display: "inline-block" }}>
          {error}
        </p>
      )}

      {latest && (
        <div key={animKey} className="freeroll-result">
          <span className="freeroll-total">{latest.total}</span>
          <span className="muted">
            {latest.notation} → [{latest.rolls.join(", ")}]
          </span>
        </div>
      )}

      {log.length > 1 && (
        <ul className="freeroll-log">
          {log.slice(1).map((e) => (
            <li key={e.id}>
              <span className="muted">{e.notation}</span> ={" "}
              <strong>{e.total}</strong>{" "}
              <span className="muted">[{e.rolls.join(", ")}]</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
