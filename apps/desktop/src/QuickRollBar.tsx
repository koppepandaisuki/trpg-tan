import { useState } from "react";
import { Dices, Star, Plus, X } from "lucide-react";
import {
  getQuickRolls,
  saveQuickRolls,
  QUICK_ROLL_PRESETS,
  QUICK_ROLL_MAX,
  type QuickRoll,
} from "./quick-rolls";

/**
 * クイックロール・バー。
 *
 * プリセット(1d100 / 2d6 …)とユーザー登録の「お気に入りロール」を 1 タップで
 * 振れる。振る操作は親の onRoll に式を渡すだけ — 親は既存の handleSend に流すので、
 * 現在の発言者・シークレット設定・チャンネルがそのまま適用される。
 */
export function QuickRollBar({ onRoll }: { onRoll: (expr: string) => void }) {
  const [favs, setFavs] = useState<QuickRoll[]>(() => getQuickRolls());
  const [editing, setEditing] = useState(false);
  const [expr, setExpr] = useState("");
  const [label, setLabel] = useState("");

  function add() {
    const e = expr.trim();
    if (!e || favs.length >= QUICK_ROLL_MAX) return;
    const next = saveQuickRolls([...favs, { expr: e, label: label.trim() || undefined }]);
    setFavs(next);
    setExpr("");
    setLabel("");
  }

  function remove(i: number) {
    const next = saveQuickRolls(favs.filter((_, j) => j !== i));
    setFavs(next);
  }

  return (
    <div className="qroll">
      <span className="qroll-lead" title="クイックロール">
        <Dices size={13} />
      </span>

      {QUICK_ROLL_PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          className="qroll-chip"
          onClick={() => onRoll(p)}
          title={`${p} を振る`}
        >
          {p}
        </button>
      ))}

      {favs.map((f, i) => (
        <span key={`${f.expr}-${i}`} className="qroll-favwrap">
          <button
            type="button"
            className="qroll-chip fav"
            onClick={() => onRoll(f.expr)}
            title={`${f.expr} を振る`}
          >
            {f.label || f.expr}
          </button>
          {editing && (
            <button
              type="button"
              className="qroll-del"
              onClick={() => remove(i)}
              title="削除"
              aria-label={`お気に入り「${f.label || f.expr}」を削除`}
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}

      <button
        type="button"
        className={`qroll-toggle ${editing ? "on" : ""}`}
        onClick={() => setEditing((v) => !v)}
        title="お気に入りロールを編集"
        aria-pressed={editing}
      >
        <Star size={12} />
        {editing ? "完了" : "お気に入り"}
      </button>

      {editing && (
        <span className="qroll-add">
          <input
            className="input qroll-in"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="2d6+1 / CCB<=70 目星 など"
            aria-label="ダイス式"
          />
          <input
            className="input qroll-in short"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="ラベル(任意)"
            aria-label="ラベル"
          />
          <button
            type="button"
            className="btn mini"
            onClick={add}
            disabled={!expr.trim() || favs.length >= QUICK_ROLL_MAX}
          >
            <Plus size={12} /> 追加
          </button>
        </span>
      )}
    </div>
  );
}
