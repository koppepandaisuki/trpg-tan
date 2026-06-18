import { audioUrl } from "./audio-url";

/**
 * SE(効果音)の単発再生ユーティリティ。UI は SoundPanel(BGM と統合)に
 * まとまっており、ここは音を鳴らす関数と音量だけを持つ。
 *  - playSeFile: その場で 1 発鳴らす(直前の SE は止める)。BGM とは別要素
 *    なので BGM を流したまま重ねられる。
 *  - 定型文の [SE:名前] / カットインの ♪ もこの関数を通る。
 */

const VOL_KEY = "trpg.se.volume.v1";

/** SE 音量(localStorage 永続。playSeFile が毎回参照する)。 */
export function getSeVolume(): number {
  const v = Number(localStorage.getItem(VOL_KEY));
  return Number.isFinite(v) && v > 0 ? v : 0.8;
}

export function setSeVolume(v: number): void {
  localStorage.setItem(VOL_KEY, String(v));
  if (current) current.volume = v;
}

let current: HTMLAudioElement | null = null;

/** SE を単発再生する(直前の SE は停止)。失敗時は null。 */
export async function playSeFile(
  path: string,
): Promise<HTMLAudioElement | null> {
  try {
    const url = await audioUrl(path);
    current?.pause();
    const a = new Audio(url);
    a.volume = getSeVolume();
    current = a;
    void a.play();
    return a;
  } catch {
    return null;
  }
}
