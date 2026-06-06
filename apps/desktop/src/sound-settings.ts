/**
 * 効果音の設定(localStorage)。判定成功時に鳴らす成功音の on/off と種類。
 */

export type SuccessSoundType = "chime" | "fanfare" | "sparkle";

export interface SoundSettings {
  /** 判定成功時に成功音を鳴らすか。 */
  successEnabled: boolean;
  /** 成功音の種類。 */
  successType: SuccessSoundType;
}

const KEY = "trpg.sound.v1";

const DEFAULT: SoundSettings = {
  successEnabled: true,
  successType: "chime",
};

export const SUCCESS_SOUND_TYPES: {
  id: SuccessSoundType;
  label: string;
  desc: string;
}[] = [
  { id: "chime", label: "チャイム", desc: "明るいベルの和音" },
  { id: "fanfare", label: "ファンファーレ", desc: "短い上昇ファンファーレ" },
  { id: "sparkle", label: "きらめき", desc: "高音のきらきら" },
];

export function getSoundSettings(): SoundSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      successEnabled:
        typeof parsed.successEnabled === "boolean"
          ? parsed.successEnabled
          : DEFAULT.successEnabled,
      successType: isType(parsed.successType)
        ? parsed.successType
        : DEFAULT.successType,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function setSoundSettings(patch: Partial<SoundSettings>): SoundSettings {
  const next = { ...getSoundSettings(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 容量超過等は無視。
  }
  return next;
}

function isType(v: unknown): v is SuccessSoundType {
  return v === "chime" || v === "fanfare" || v === "sparkle";
}
