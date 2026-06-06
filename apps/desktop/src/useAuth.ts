import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";

/**
 * 現在のセッションを購読する React フック。
 * supabase 未設定(env なし)のときは ready=true / session=null を返し、
 * 認証UIは「未設定」表示にフォールバックできる。
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready };
}
