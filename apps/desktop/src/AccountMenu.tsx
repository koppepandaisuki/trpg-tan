import { useEffect, useState } from "react";
import { ChevronDown, UserRound, ShieldCheck } from "lucide-react";
import { useLocalProfile } from "./local-profile";
import { getMyAccount } from "./account-remote";

/**
 * 右上のアカウントチップ。ログインの本名 / メールではなく、端末ローカルの
 * ニックネーム + アバター(未設定はゲストアイコン)を出す。クリックで設定画面
 * (アカウントタブ)を開く。ログイン操作自体は設定の中に集約した。
 *
 * 管理者(web アカウントが admin)のときは「ADMIN」バッジを出す。管理者は
 * プラン不問で全機能を使える(PLAY ホスト等のゲート免除)。
 */
export function AccountMenu({ onOpen }: { onOpen: () => void }) {
  const { nickname, avatar } = useLocalProfile();
  const label = nickname.trim() || "ゲスト";
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    void getMyAccount().then((a) => {
      if (alive) setIsAdmin(a.isAdmin);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <button
      className="acct-chip"
      onClick={onOpen}
      title={isAdmin ? "管理者 — プロフィール・設定" : "プロフィール・設定"}
    >
      <span className="acct-av">
        {avatar ? <img src={avatar} alt="" /> : <UserRound size={16} aria-hidden />}
      </span>
      <span className="acct-name">{label}</span>
      {isAdmin && (
        <span className="acct-admin" title="管理者（プラン不問で全機能）">
          <ShieldCheck size={12} aria-hidden /> ADMIN
        </span>
      )}
      <ChevronDown size={14} className="acct-caret" />
    </button>
  );
}
