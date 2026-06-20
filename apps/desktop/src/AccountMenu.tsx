import { ChevronDown, UserRound } from "lucide-react";
import { useLocalProfile } from "./local-profile";

/**
 * 右上のアカウントチップ。ログインの本名 / メールではなく、端末ローカルの
 * ニックネーム + アバター(未設定はゲストアイコン)を出す。クリックで設定画面
 * (アカウントタブ)を開く。ログイン操作自体は設定の中に集約した。
 */
export function AccountMenu({ onOpen }: { onOpen: () => void }) {
  const { nickname, avatar } = useLocalProfile();
  const label = nickname.trim() || "ゲスト";

  return (
    <button className="acct-chip" onClick={onOpen} title="プロフィール・設定">
      <span className="acct-av">
        {avatar ? (
          <img src={avatar} alt="" />
        ) : (
          <UserRound size={16} aria-hidden />
        )}
      </span>
      <span className="acct-name">{label}</span>
      <ChevronDown size={14} className="acct-caret" />
    </button>
  );
}
