/**
 * 音量設定の単一ソース(localStorage `trpg.volume.v2`)。
 *
 * カテゴリ:
 *   - master : すべての音量に掛かる(0 で完全無音)。
 *   - bgm    : サウンドライブラリの ▶BGM(ループ)に適用。
 *   - se     : サウンドライブラリの 🔔SE(単発) / 定型文 [SE:…] に適用。
 *   - dice   : ダイスの転がり音 + 成功 / クリティカル / ファンブル音(Web Audio 合成)。
 *
 * 実効音量は `master * category`。`muted=true` のときは一括で 0(マスターのみで
 * ミュート / ミュート解除できるよう独立フラグにしてある)。
 *
 * 値の変更は CustomEvent `trpg-volume-changed` で同 window 内に通知する。
 * SoundPanel(再生中の <audio>)や dice-sound.ts(masterGain)はこれを購読して
 * 即座に反映する。
 *
 * 旧キー(`trpg.bgm.volume.v1` / `trpg.se.volume.v1`)からの一度きりの移行も
 * ここで行う(初回 getVolumeSettings 時にだけ参照、書き込み時は新キーへ統一)。
 */

export interface VolumeSettings {
  /** 0..1。全体に掛かるマスター音量。 */
  master: number;
  /** 0..1。BGM(ループ再生)の音量。 */
  bgm: number;
  /** 0..1。SE(単発再生)の音量。 */
  se: number;
  /** 0..1。ダイス・判定音(成功 / クリ / ファンブル)の音量。 */
  dice: number;
  /** マスターミュート(true なら全カテゴリ実効 0)。 */
  muted: boolean;
}

const KEY = "trpg.volume.v2";
const LEGACY_BGM = "trpg.bgm.volume.v1";
const LEGACY_SE = "trpg.se.volume.v1";

const DEFAULT: VolumeSettings = {
  master: 1,
  bgm: 0.6,
  se: 0.8,
  dice: 1,
  muted: false,
};

const EVENT = "trpg-volume-changed";

function clamp01(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function getVolumeSettings(): VolumeSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VolumeSettings>;
      return {
        master:
          typeof parsed.master === "number"
            ? clamp01(parsed.master)
            : DEFAULT.master,
        bgm:
          typeof parsed.bgm === "number"
            ? clamp01(parsed.bgm)
            : DEFAULT.bgm,
        se:
          typeof parsed.se === "number" ? clamp01(parsed.se) : DEFAULT.se,
        dice:
          typeof parsed.dice === "number"
            ? clamp01(parsed.dice)
            : DEFAULT.dice,
        muted: parsed.muted === true,
      };
    }
  } catch {
    // 破損していたら既定にフォールバック。
  }

  // 旧キーからの移行(初回のみ反映)。値が有効なら採用、なければ既定。
  const legacyBgm = Number(localStorage.getItem(LEGACY_BGM));
  const legacySe = Number(localStorage.getItem(LEGACY_SE));
  return {
    master: DEFAULT.master,
    bgm:
      Number.isFinite(legacyBgm) && legacyBgm > 0
        ? clamp01(legacyBgm)
        : DEFAULT.bgm,
    se:
      Number.isFinite(legacySe) && legacySe > 0
        ? clamp01(legacySe)
        : DEFAULT.se,
    dice: DEFAULT.dice,
    muted: DEFAULT.muted,
  };
}

export function setVolumeSettings(
  patch: Partial<VolumeSettings>,
): VolumeSettings {
  const cur = getVolumeSettings();
  const next: VolumeSettings = {
    master:
      patch.master !== undefined ? clamp01(patch.master) : cur.master,
    bgm: patch.bgm !== undefined ? clamp01(patch.bgm) : cur.bgm,
    se: patch.se !== undefined ? clamp01(patch.se) : cur.se,
    dice: patch.dice !== undefined ? clamp01(patch.dice) : cur.dice,
    muted: patch.muted !== undefined ? !!patch.muted : cur.muted,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    // 旧キーも揃えておく(他コンポーネントが個別に参照していた場合の保険)。
    localStorage.setItem(LEGACY_BGM, String(next.bgm));
    localStorage.setItem(LEGACY_SE, String(next.se));
  } catch {
    // 容量超過等は無視。
  }
  try {
    window.dispatchEvent(new CustomEvent<VolumeSettings>(EVENT, { detail: next }));
  } catch {
    // CustomEvent 不可な環境では無視。
  }
  return next;
}

/** 実効 BGM 音量(0..1)。muted=true なら 0。 */
export function getEffectiveBgmVolume(): number {
  const s = getVolumeSettings();
  return s.muted ? 0 : clamp01(s.master * s.bgm);
}

/** 実効 SE 音量(0..1)。 */
export function getEffectiveSeVolume(): number {
  const s = getVolumeSettings();
  return s.muted ? 0 : clamp01(s.master * s.se);
}

/** 実効ダイス・判定音音量(0..1)。 */
export function getEffectiveDiceVolume(): number {
  const s = getVolumeSettings();
  return s.muted ? 0 : clamp01(s.master * s.dice);
}

/**
 * 設定変更を購読する。返り値で購読解除。
 * SoundPanel / dice-sound.ts / Settings の各スライダが同期するために使う。
 */
export function onVolumeChange(
  cb: (v: VolumeSettings) => void,
): () => void {
  const handler = (e: Event) => {
    const ce = e as CustomEvent<VolumeSettings>;
    cb(ce.detail);
  };
  window.addEventListener(EVENT, handler as EventListener);
  return () => window.removeEventListener(EVENT, handler as EventListener);
}
