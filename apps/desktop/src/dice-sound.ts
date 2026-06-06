/**
 * ダイスの転がり音を Web Audio で合成する(音声ファイル不要)。
 *
 * 実際のサイコロを参考に「からから…ころ ころ…トン」を作る:
 *   - 転がり: 帯域通過したノイズの短いクラックを、密→疎(減速)に多数撒く。
 *     ピッチ/パンをランダムにして“跳ね回る”感じを出す。
 *   - 着地:   低めの「トン」をダイスの個数だけ。
 *
 * AudioContext はユーザー操作(判定ボタン/Enter)起点で生成・resume するので
 * 自動再生ポリシーに引っかからない。失敗しても演出は壊さない。
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function ensure(): AudioContext {
  if (!ctx) {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AC();
    const len = Math.floor(ctx.sampleRate * 0.4);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 1 回のクラック(帯域通過ノイズ + 速い減衰)。 */
function clack(
  ac: AudioContext,
  at: number,
  o: { freq: number; gain: number; dur: number; pan: number; q?: number },
): void {
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.6;

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = o.freq;
  bp.Q.value = o.q ?? 6;

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(o.gain, at + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);

  const pan = ac.createStereoPanner();
  pan.pan.value = Math.max(-1, Math.min(1, o.pan));

  src.connect(bp);
  bp.connect(g);
  g.connect(pan);
  pan.connect(ac.destination);
  src.start(at);
  src.stop(at + o.dur + 0.02);
}

/** 転がり音を鳴らす。durationSec はモーションの転がり時間に合わせる。 */
export function playDiceRoll(durationSec = 1.1, count = 1): void {
  try {
    const ac = ensure();
    const t0 = ac.currentTime + 0.01;

    // 転がり: 高めのクラックを密→疎(減速)。
    let t = t0;
    while (t < t0 + durationSec * 0.82) {
      const p = (t - t0) / durationSec;
      clack(ac, t, {
        freq: 1100 + Math.random() * 2400,
        gain: (0.16 + Math.random() * 0.14) * (1 - p * 0.45),
        dur: 0.025 + Math.random() * 0.03,
        pan: Math.random() * 1.4 - 0.7,
        q: 5 + Math.random() * 6,
      });
      t += 0.018 + p * 0.075 + Math.random() * 0.025;
    }

    // 着地: 低めの「トン」をダイスの数だけ。
    for (let i = 0; i < count; i++) {
      clack(ac, t0 + durationSec * 0.88 + i * 0.05, {
        freq: 300 + Math.random() * 180,
        gain: 0.32,
        dur: 0.09,
        pan: Math.random() * 0.5 - 0.25,
        q: 3,
      });
    }
  } catch {
    // 音が出せない環境でも無視。
  }
}
