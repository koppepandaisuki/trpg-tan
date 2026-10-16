import { createClient } from "@/lib/supabase/client";
import {
  clonePlayScene,
  parsePlayFile,
  serializePlayFile,
  playFileName,
  type PlayScene,
} from "@trpg/core";

/**
 * Web 版 PLAY の卓の保存(クライアント側)。
 *
 * 卓は遊んでいる間ずっと変化する(駒の移動・ダイス・シーン切替…)ので、
 * 保存は Server Action ではなくブラウザの Supabase クライアントから直接
 * 行う(RLS で所有者のみ書ける)。数十 KB の scene を Next のサーバへ
 * 二度運ばずに済み、オートセーブの往復も軽い。
 *
 * 画像/音声の実体は scene に data URL で持たず、`play` バケット(0022)へ
 * 上げた URL を参照する運用(= scene 本体は小さく保つ)。
 */

/** ロビーのカードに出す付随情報(scene から導けないもの)。 */
export interface PlaySessionMeta {
  systemLabel?: string | null;
  thumbnail?: string | null;
}

/**
 * 卓を保存(新規なら作成、既存なら更新)。id は PlayScene.id をそのまま使う。
 * 失敗時は例外を投げる(呼び出し側でトースト表示する想定)。
 */
export async function savePlayScene(
  scene: PlayScene,
  meta?: PlaySessionMeta,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { error } = await supabase.from("play_sessions").upsert(
    {
      id: scene.id,
      owner_id: user.id,
      title: scene.title || "(無題の卓)",
      system_id: scene.systemId ?? "",
      system_label: meta?.systemLabel ?? null,
      tags: scene.tags && scene.tags.length > 0 ? scene.tags : [],
      thumbnail: meta?.thumbnail ?? null,
      panel_count: scene.panels.length,
      scene,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`卓の保存に失敗しました: ${error.message}`);
}

/** 卓を削除。RLS により自分の卓しか消せない。 */
export async function deletePlaySession(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("play_sessions").delete().eq("id", id);
  if (error) throw new Error(`卓の削除に失敗しました: ${error.message}`);
}

/**
 * 卓を開くためのシーン取得(クライアント側)。RLS で他人の卓は null。
 * サーバー側で取る場合は lib/queries/play-sessions.ts の getMyPlayScene。
 */
export async function loadPlayScene(id: string): Promise<PlayScene | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("play_sessions")
    .select("scene")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { scene: PlayScene }).scene;
}

/**
 * 卓を複製する(ログ・ターンは消して「同じ準備の新しい卓」にする)。
 * ココフォリアでは有料(PRO)の機能だが、Re-dice では無料。新しい卓の id を返す。
 */
export async function duplicatePlaySession(id: string): Promise<string> {
  const src = await loadPlayScene(id);
  if (!src) throw new Error("複製元の卓が見つかりませんでした");
  const copy = clonePlayScene(src, {
    id: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  await savePlayScene(copy);
  return copy.id;
}

/**
 * 卓ファイル(.play。デスクトップ版と共通の形式)を読み込んで新しい卓として保存する。
 * 既存の卓を上書きしないよう、常に新しい id を振る。新しい卓の id を返す。
 */
export async function importPlayFile(file: File): Promise<string> {
  const scene = parsePlayFile(await file.text());
  const copy = clonePlayScene(scene, {
    id: crypto.randomUUID(),
    now: new Date().toISOString(),
    title: scene.title,
    keepLog: true,
  });
  await savePlayScene(copy);
  return copy.id;
}

/** 卓を .play ファイルとしてダウンロードさせる(ブラウザ)。 */
export function downloadPlayFile(scene: PlayScene): void {
  const blob = new Blob([serializePlayFile(scene)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = playFileName(scene);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
