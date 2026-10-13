"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 卓の音声(BGM ループ / SE 単発)を鳴らすフック。GM・参加者の双方が使う。
 *
 * ブラウザはユーザー操作前のメディア再生をブロックするので、入室後の最初の
 * クリック/キー/タッチで一度だけ「解錠」する。解錠前に GM から BGM が届いた
 * 場合は鳴らさずに覚えておき、解錠と同時に鳴らし始める(途中入室でも曲が
 * 揃う)。desktop の PlayClient と同じ挙動。
 *
 * `handleAudio` は Realtime の onMessage 内(接続時に固定される closure)から
 * 呼ばれるため、状態はすべて ref に持ち関数の同一性を保つ。
 */

const VOL_KEY = "redice.play.vol.v1";
/** BGM は「会話の邪魔にならない」を優先して控えめが既定(実効 0.45^2 ≈ 0.20)。 */
const DEFAULT_VOL = 0.45;

/**
 * スライダ値(0..1)→ 実効ゲイン。
 * 人間の音量知覚は対数的で、値をそのまま `audio.volume` に入れると
 * 「一番下げてもまだ大きい」ままになるため二乗カーブで下側を広げる。
 * desktop の volume-settings.ts `perceptualGain` と同じ式(音量を揃えるため)。
 */
export function perceptualGain(v: number): number {
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c * c;
}

export interface PlayAudio {
  /** GM から配信された音声を反映する。src=null は BGM 停止。 */
  handleAudio: (
    channel: "bgm" | "se",
    src: string | null,
    loop?: boolean,
  ) => void;
  /** 自動再生がブロックされている(ユーザー操作待ち)。 */
  blocked: boolean;
  volume: number;
  setVolume: (v: number) => void;
}

export function usePlayAudio(): PlayAudio {
  const [blocked, setBlocked] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOL);

  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const curBgm = useRef<{ src: string | null }>({ src: null });
  const readyRef = useRef(false);
  const volRef = useRef(DEFAULT_VOL);

  // 端末に保存した音量を復元。
  useEffect(() => {
    const saved = Number(localStorage.getItem(VOL_KEY));
    if (Number.isFinite(saved) && saved >= 0 && saved <= 1) {
      volRef.current = saved;
      setVolumeState(saved);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    volRef.current = v;
    setVolumeState(v);
    if (bgmRef.current) bgmRef.current.volume = perceptualGain(v);
    try {
      localStorage.setItem(VOL_KEY, String(v));
    } catch {
      /* プライベートモード等では保存できないが再生には影響しない */
    }
  }, []);

  /** 現在の BGM を冪等に再生する(同じ曲が鳴っていれば頭出ししない)。 */
  const playBgm = useCallback(() => {
    const src = curBgm.current.src;
    if (!src) return;
    let a = bgmRef.current;
    if (!a) {
      a = new Audio();
      a.preload = "auto"; // 先読みして途切れにくくする
      bgmRef.current = a;
    }
    a.loop = true;
    a.volume = perceptualGain(volRef.current);
    if (a.src === src && !a.paused) return; // 既に同じ曲を再生中
    if (a.src !== src) a.src = src;
    void a.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  }, []);

  const handleAudio = useCallback(
    (channel: "bgm" | "se", src: string | null) => {
      if (channel === "bgm") {
        curBgm.current = { src };
        if (!src) {
          bgmRef.current?.pause();
          return;
        }
        // 未解錠: 最初の操作で鳴らすので、合図だけ出して保持しておく。
        if (!readyRef.current) {
          setBlocked(true);
          return;
        }
        playBgm();
        return;
      }
      // SE は単発。未解錠なら鳴らせないので捨てる(BGM と違い状態を持たない)。
      if (!src) return;
      if (!readyRef.current) {
        setBlocked(true);
        return;
      }
      const a = new Audio(src);
      a.volume = perceptualGain(volRef.current);
      a.play().catch(() => setBlocked(true));
    },
    [playBgm],
  );

  // 最初のユーザー操作で一度だけ解錠し、GM が既に流している BGM を再開する。
  useEffect(() => {
    const prime = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      setBlocked(false);
      playBgm();
    };
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", prime, opts);
    window.addEventListener("keydown", prime, opts);
    window.addEventListener("touchstart", prime, opts);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
      window.removeEventListener("touchstart", prime);
    };
  }, [playBgm]);

  // 退室/アンマウントで BGM を止める(次の卓へ持ち越さない)。
  useEffect(() => {
    return () => {
      bgmRef.current?.pause();
      bgmRef.current = null;
    };
  }, []);

  return { handleAudio, blocked, volume, setVolume };
}
