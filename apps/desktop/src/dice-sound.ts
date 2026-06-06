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

/** 単音(オシレータ + エンベロープ)。成功音の部品。 */
function tone(
  ac: AudioContext,
  o: {
    freq: number;
    at: number;
    dur: number;
    gain: number;
    type?: OscillatorType;
    to?: number;
  },
): void {
  const osc = ac.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, o.at);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, o.at + o.dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(o.gain, o.at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.02);
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

/* ===== 成功音(3 種)===== */

function chime(ac: AudioContext): void {
  const t = ac.currentTime + 0.01;
  const notes = [784, 988, 1175]; // G5 B5 D6(明るい和音)
  notes.forEach((f, i) => {
    tone(ac, { freq: f, at: t + i * 0.08, dur: 0.55, gain: 0.2, type: "sine" });
    tone(ac, { freq: f * 2, at: t + i * 0.08, dur: 0.4, gain: 0.05, type: "sine" });
  });
}

function fanfare(ac: AudioContext): void {
  const t = ac.currentTime + 0.01;
  tone(ac, { freq: 587, at: t, dur: 0.16, gain: 0.2, type: "triangle" });
  tone(ac, { freq: 587, at: t, dur: 0.16, gain: 0.05, type: "square" });
  tone(ac, { freq: 880, at: t + 0.13, dur: 0.42, gain: 0.22, type: "triangle" });
  tone(ac, { freq: 880, at: t + 0.13, dur: 0.42, gain: 0.06, type: "square" });
}

function sparkle(ac: AudioContext): void {
  const t = ac.currentTime + 0.01;
  const fs = [1568, 1976, 2349, 2637, 3136];
  fs.forEach((f, i) =>
    tone(ac, { freq: f, at: t + i * 0.05, dur: 0.24, gain: 0.13, type: "sine" }),
  );
}

/** 成功音を鳴らす(設定で選ばれた種類)。 */
export function playSuccess(type: "chime" | "fanfare" | "sparkle"): void {
  try {
    const ac = ensure();
    if (type === "fanfare") fanfare(ac);
    else if (type === "sparkle") sparkle(ac);
    else chime(ac);
  } catch {
    // 無視。
  }
}

/* ===== クリティカル / ファンブル専用音 ===== */

/** クリティカル(イクストリーム/スペシャル): 上昇アルペジオ + 高い和音 + きらめき。 */
function critical(ac: AudioContext): void {
  const t = ac.currentTime + 0.01;
  const run = [523, 659, 784, 1047]; // C5 E5 G5 C6
  run.forEach((f, i) =>
    tone(ac, { freq: f, at: t + i * 0.06, dur: 0.18, gain: 0.18, type: "triangle" }),
  );
  const chord = [1047, 1319, 1568]; // C6 E6 G6
  chord.forEach((f) =>
    tone(ac, { freq: f, at: t + 0.26, dur: 0.6, gain: 0.15, type: "sine" }),
  );
  [2093, 2637, 3136].forEach((f, i) =>
    tone(ac, { freq: f, at: t + 0.3 + i * 0.06, dur: 0.3, gain: 0.08, type: "sine" }),
  );
}

/** ファンブル: 下降する“サッドトロンボーン”(各音ピッチが垂れる) + 低い尾。 */
function fumble(ac: AudioContext): void {
  const t = ac.currentTime + 0.01;
  const notes = [311, 277, 233]; // Eb4 Db4 Bb3
  notes.forEach((f, i) => {
    const at = t + i * 0.18;
    tone(ac, { freq: f, at, dur: 0.2, gain: 0.2, type: "sawtooth", to: f * 0.94 });
  });
  tone(ac, { freq: 196, at: t + 0.54, dur: 0.55, gain: 0.22, type: "sawtooth", to: 116 });
}

export function playCritical(): void {
  try {
    critical(ensure());
  } catch {
    // 無視。
  }
}

export function playFumble(): void {
  try {
    fumble(ensure());
  } catch {
    // 無視。
  }
}
