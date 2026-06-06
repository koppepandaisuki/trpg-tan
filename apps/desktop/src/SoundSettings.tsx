import { useState } from "react";
import {
  getSoundSettings,
  setSoundSettings,
  SUCCESS_SOUND_TYPES,
  type SoundSettings as Settings,
  type SuccessSoundType,
} from "./sound-settings";
import { playSuccess } from "./dice-sound";

/**
 * 効果音の設定モーダル。判定成功音の on/off と種類(3 種)を選べる。
 * 種類は選択時・▶ で試聴できる。
 */
export function SoundSettings({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Settings>(() => getSoundSettings());

  function toggle(enabled: boolean) {
    setS(setSoundSettings({ successEnabled: enabled }));
  }

  function choose(type: SuccessSoundType) {
    setS(setSoundSettings({ successType: type }));
    playSuccess(type); // 選択時に試聴
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <strong>効果音の設定</strong>
          <button className="btn mini" onClick={onClose}>
            閉じる
          </button>
        </header>

        <label className="set-row">
          <input
            type="checkbox"
            checked={s.successEnabled}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span>判定が成功したら成功音を鳴らす</span>
        </label>

        <div className={`set-types ${s.successEnabled ? "" : "disabled"}`}>
          <p className="set-caption">成功音の種類</p>
          {SUCCESS_SOUND_TYPES.map((t) => (
            <div
              key={t.id}
              className={`set-type ${s.successType === t.id ? "active" : ""}`}
              onClick={() => s.successEnabled && choose(t.id)}
            >
              <input
                type="radio"
                name="successType"
                checked={s.successType === t.id}
                onChange={() => choose(t.id)}
                disabled={!s.successEnabled}
              />
              <div className="set-type-meta">
                <span className="set-type-label">{t.label}</span>
                <span className="set-type-desc">{t.desc}</span>
              </div>
              <button
                className="btn mini"
                disabled={!s.successEnabled}
                onClick={(e) => {
                  e.stopPropagation();
                  playSuccess(t.id);
                }}
                title="試聴"
              >
                ▶ 試聴
              </button>
            </div>
          ))}
        </div>

        <p className="muted set-note">
          成功音は判定（能力値・技能）が成功したときだけ鳴ります。ダイスの
          転がり音は常に鳴ります。
        </p>
      </div>
    </div>
  );
}
