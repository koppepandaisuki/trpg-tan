import { audioUrl } from "./audio-url";
import {
  getEffectiveSeVolume,
  getVolumeSettings,
  setVolumeSettings,
  onVolumeChange,
} from "./volume-settings";

/**
 * SE(効果音)の単発再生ユーティリティ。UI は SoundPanel(BGM と統合)に
 * まとまっており、ここは音を鳴らす関数と音量だけを持つ。
 *  - playSeFile: その場で 1 発鳴らす(直前の SE は止める)。BGM とは別要素
 *    なので BGM を流したまま重ねられる。
 *  - 定型文の [SE:名前] / カットインの ♪ もこの関数を通る。
 *
 * 音量設定の正本は volume-settings.ts(master × se を実効値とする)。
 * 旧 API `getSeVolume` / `setSeVolume` は既存呼び出しのために残し、
 * 内部で新モジュールに委譲する。
 */

/** SE 音量(0..1)。実効値=master × se(muted のときは 0)。 */
export function getSeVolume(): number {
  return getEffectiveSeVolume();
}

/** SE カテゴリの音量を設定する(volume-settings の se を更新)。 */
export function setSeVolume(v: number): void {
  setVolumeSettings({ se: v });
  // 直近の SE が再生中なら音量を即時反映する。
  if (current) current.volume = getEffectiveSeVolume();
}

/** カテゴリ値(master を掛けない、UI スライダ表示用)。 */
export function getSeCategoryVolume(): number {
  return getVolumeSettings().se;
}

let current: HTMLAudioElement | null = null;

// 設定変更時に再生中の SE の音量を追従させる。
onVolumeChange(() => {
  if (current) current.volume = getEffectiveSeVolume();
});

/** SE を単発再生する(直前の SE は停止)。失敗時は null。 */
export async function playSeFile(
  path: string,
): Promise<HTMLAudioElement | null> {
  try {
    const url = await audioUrl(path);
    current?.pause();
    const a = new Audio(url);
    a.volume = getEffectiveSeVolume();
    current = a;
    void a.play();
    return a;
  } catch {
    return null;
  }
}
