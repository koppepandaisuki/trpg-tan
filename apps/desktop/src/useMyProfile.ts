import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase, supabaseConfigured } from "./supabase";

export interface MyProfile {
  ready: boolean;
  loggedIn: boolean;
  name: string;
  email: string;
  avatarUrl: string | null;
  initial: string;
}

/**
 * 現在のユーザーの表示用プロフィール(表示名 + アイコン)。
 * web の public_profiles(display_name / avatar_path)を優先し、無ければ Google の
 * user_metadata、最後にメールのローカル部にフォールバックする。
 * 右上のチップ(AccountMenu)と設定画面のアカウントタブで共用。
 */
export function useMyProfile(): MyProfile {
  const { session, ready } = useAuth();
  const [p, setP] = useState<{ name: string | null; avatarUrl: string | null }>({
    name: null,
    avatarUrl: null,
  });
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !supabaseConfigured) {
      setP({ name: null, avatarUrl: null });
      return;
    }
    let active = true;
    void supabase
      .from("public_profiles")
      .select("display_name, avatar_path")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const avatarUrl = data.avatar_path
          ? supabase.storage.from("avatars").getPublicUrl(data.avatar_path).data
              .publicUrl
          : null;
        setP({ name: data.display_name ?? null, avatarUrl });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const meta = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = session?.user.email ?? "";
  const name =
    p.name ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    email.split("@")[0] ||
    "ユーザー";
  const avatarUrl =
    p.avatarUrl ||
    (typeof meta.avatar_url === "string" ? meta.avatar_url : null) ||
    (typeof meta.picture === "string" ? meta.picture : null);

  return {
    ready,
    loggedIn: !!session,
    name,
    email,
    avatarUrl,
    initial: name.slice(0, 1).toUpperCase(),
  };
}
