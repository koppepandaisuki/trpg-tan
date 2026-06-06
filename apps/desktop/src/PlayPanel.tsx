import type { Panel, PanelResource, PanelStat } from "@trpg/core";

/**
 * 卓上のキャラ駒(パネル)1 枚。ポートレート + 名前 + リソース(HP/SAN/MP の
 * 増減) + 判定ボタン(能力値/技能をクリックで 1D100)。
 */
export function PlayPanel({
  panel,
  onRoll,
  onResource,
  onRemove,
}: {
  panel: Panel;
  onRoll: (panel: Panel, stat: PanelStat) => void;
  onResource: (panel: Panel, resource: PanelResource, delta: number) => void;
  onRemove: (panel: Panel) => void;
}) {
  const characteristics = panel.stats.filter((s) => s.kind === "characteristic");
  const skills = panel.stats.filter((s) => s.kind === "skill");

  return (
    <div className="ppanel" style={{ borderTopColor: panel.color }}>
      <div className="ppanel-head">
        <div className="ppanel-portrait" style={{ background: panel.color }}>
          {panel.portrait ? <img src={panel.portrait} alt="" /> : <span>◆</span>}
        </div>
        <div className="ppanel-id">
          <strong className="ppanel-name">{panel.name}</strong>
          <span className="ppanel-sys">
            {panel.source === "token"
              ? "トークン"
              : panel.systemId === "coc6"
                ? "CoC 6版"
                : "CoC 7版"}
          </span>
        </div>
        <button
          className="ppanel-del"
          title="卓から外す"
          onClick={() => onRemove(panel)}
        >
          ×
        </button>
      </div>

      {panel.resources.length > 0 && (
        <div className="ppanel-res">
          {panel.resources.map((r) => (
            <div key={r.key} className="pres">
              <span className="pres-label">{r.label}</span>
              <button
                className="pres-btn"
                onClick={() => onResource(panel, r, -1)}
                title="-1"
              >
                −
              </button>
              <span className="pres-val">
                {r.current}
                <span className="pres-max">/{r.max}</span>
              </span>
              <button
                className="pres-btn"
                onClick={() => onResource(panel, r, 1)}
                title="+1"
              >
                ＋
              </button>
            </div>
          ))}
        </div>
      )}

      {characteristics.length > 0 && (
        <div className="ppanel-stats">
          {characteristics.map((s) => (
            <button
              key={s.key}
              className="pstat"
              onClick={() => onRoll(panel, s)}
              title={`${s.label} で 1D100 判定（目標 ${s.target}）`}
            >
              <span className="pstat-label">{s.label}</span>
              <span className="pstat-val">{s.target}</span>
            </button>
          ))}
        </div>
      )}

      {skills.length > 0 && (
        <div className="ppanel-skills">
          {skills.map((s) => (
            <button
              key={s.key}
              className="pskill"
              onClick={() => onRoll(panel, s)}
              title={`${s.label} 判定（${s.target}）`}
            >
              {s.label} <b>{s.target}</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
