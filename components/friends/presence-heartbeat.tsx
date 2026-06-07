"use client";

import { useEffect } from "react";
import { touchPresenceAction } from "@/app/(app)/friends/actions";

/**
 * 在席の心拍。ログイン中ユーザーの last_seen_at を定期更新する。
 * TopHeader 内(全ページ)でマウントされる。描画はしない。
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    let alive = true;
    const beat = () => {
      if (alive && document.visibilityState === "visible") {
        void touchPresenceAction();
      }
    };
    beat();
    const timer = setInterval(beat, 120_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
  return null;
}
