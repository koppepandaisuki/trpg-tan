import { useEffect, useState } from "react";

/**
 * 端末ローカルの「表示プロフィール」(ニックネーム + アバター画像)。
 *
 * ねらい: ログインアカウントの本名 / メールをアプリ内に出さず、ユーザーが
 * 自分で決めたニックネームと画像だけを表示・共有する。サーバー保存はせず
 * localStorage に閉じる(端末ローカル)。
 *
 * - ニックネームは既存の「プレイヤー名」(trpg.net.name.v1)をそのまま流用。
 *   これにより卓(PLAY)へ参加するときの名前と一元化される。
 * - アバターは 128px 正方に縮めた data URL を保存(localStorage 圧迫を回避)。
 * - 画像未設定のときは呼び出し側でゲストアイコンを出す(avatar = null)。
 *
 * 変更は CustomEvent("trpg:profile-changed") と storage イベントで各所
 * (右上チップ / 設定)に伝播する。
 */

const NAME_KEY = "trpg.net.name.v1";
const AVATAR_KEY = "trpg.profile.avatar.v1";
const EVENT = "trpg:profile-changed";

export interface LocalProfile {
  /** 表示名 兼 卓の参加名。未設定は空文字。 */
  nickname: string;
  /** アバター画像(data URL)。未設定は null。 */
  avatar: string | null;
}

export function getLocalProfile(): LocalProfile {
  let nickname = "";
  let avatar: string | null = null;
  try {
    nickname = localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    /* localStorage 不可は無視 */
  }
  try {
    avatar = localStorage.getItem(AVATAR_KEY) || null;
  } catch {
    /* 同上 */
  }
  return { nickname, avatar };
}

function notify(): void {
  try {
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* 無視 */
  }
}

export function setLocalNickname(value: string): void {
  try {
    localStorage.setItem(NAME_KEY, value);
  } catch {
    /* 無視 */
  }
  notify();
}

export function setLocalAvatar(dataUrl: string | null): void {
  try {
    if (dataUrl) localStorage.setItem(AVATAR_KEY, dataUrl);
    else localStorage.removeItem(AVATAR_KEY);
  } catch {
    /* 無視(容量超過など) */
  }
  notify();
}

/**
 * ローカルプロフィールを購読するフック。右上チップ・設定の両方で使う。
 * 同一ウィンドウ内の変更は CustomEvent、別ウィンドウ(分離ウィジェット)の
 * 変更は storage イベントで拾う。
 */
export function useLocalProfile(): LocalProfile {
  const [p, setP] = useState<LocalProfile>(getLocalProfile);
  useEffect(() => {
    const onChange = () => setP(getLocalProfile());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return p;
}

/**
 * 画像ファイルを 128px 正方(中央クロップ)の JPEG data URL に変換する。
 * アバターは小さくてよいので、localStorage を圧迫しないよう縮小する。
 */
export async function fileToAvatarDataUrl(
  file: File,
  size = 128,
): Promise<string> {
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("read failed"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("decode failed"));
    im.src = sourceUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceUrl;

  // 中央を正方にクロップして size×size へ描画。
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}
