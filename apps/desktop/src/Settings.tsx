import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  UserCog,
  Monitor,
  Volume2,
  Dices,
  Info,
  Settings as Gear,
  X,
  LogOut,
  ExternalLink,
  Sun,
  Moon,
  Trash2,
} from "lucide-react";
import { useMyProfile } from "./useMyProfile";
import { signInWithGoogle, signOut } from "./auth";
import { supabaseConfigured } from "./supabase";
import {
  getSoundSettings,
  setSoundSettings,
  SUCCESS_SOUND_TYPES,
  type SoundSettings as Sound,
  type SuccessSoundType,
} from "./sound-settings";
import { playSuccess, playCritical, playFumble } from "./dice-sound";
import { getQuickRolls, saveQuickRolls } from "./quick-rolls";

const WEB_BASE = (
  import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const NET_NAME_KEY = "trpg.net.name.v1";

export type SettingsTab = "account" | "display" | "sound" | "play" | "about";

const TABS: { key: SettingsTab; label: string; icon: typeof UserCog }[] = [
  { key: "account", label: "アカウント", icon: UserCog },
  { key: "display", label: "画面・テーマ", icon: Monitor },
  { key: "sound", label: "サウンド", icon: Volume2 },
  { key: "play", label: "プレイ・マルチ", icon: Dices },
  { key: "about", label: "情報", icon: Info },
];

/**
 * 一枚ものの設定画面(ドロップダウンではない)。左にカテゴリ、右に内容、下に
 * 閉じるバー。アカウント / 画面・テーマ / サウンド / プレイ・マルチ / 情報。
 * 変更は即時に保存される(localStorage / Supabase)。
 */
export function Settings({
  initialTab = "account",
  theme,
  onToggleTheme,
  onClose,
}: {
  initialTab?: SettingsTab;
  theme: string;
  onToggleTheme: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  return (
    <div
      className="set2-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="set2-panel" onClick={(e) => e.stopPropagation()}>
        <header className="set2-head">
          <span className="set2-title">
            <Gear size={18} /> 設定
          </span>
          <button className="set2-x" onClick={onClose} aria-label="閉じる">
            <X size={18} />
          </button>
        </header>

        <div className="set2-main">
          <nav className="set2-nav">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`set2-navbtn ${tab === t.key ? "on" : ""}`}
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
              >
                <t.icon size={17} />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="set2-content">
            {tab === "account" && <AccountTab />}
            {tab === "display" && (
              <DisplayTab theme={theme} onToggleTheme={onToggleTheme} />
            )}
            {tab === "sound" && <SoundTab />}
            {tab === "play" && <PlayTab />}
            {tab === "about" && <AboutTab />}
          </div>
        </div>

        <footer className="set2-foot">
          <span className="muted">変更は自動的に保存されます。</span>
          <button className="btn btn-primary" onClick={onClose}>
            閉じる
          </button>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="set2-sec">
      <h3 className="set2-sec-title">{title}</h3>
      {desc && <p className="set2-sec-desc muted">{desc}</p>}
      {children}
    </section>
  );
}

function AccountTab() {
  const { ready, loggedIn, name, email, avatarUrl, initial } = useMyProfile();
  const [busy, setBusy] = useState(false);

  if (!supabaseConfigured) {
    return (
      <Section title="アカウント">
        <p className="muted">
          ログイン未設定です(VITE_SUPABASE_URL / ANON_KEY)。
        </p>
      </Section>
    );
  }
  if (!ready) return <Section title="アカウント"><p className="muted">…</p></Section>;

  if (!loggedIn) {
    return (
      <Section title="アカウント" desc="ログインするとライブラリ取込や出品が使えます。">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void signInWithGoogle().finally(() => setBusy(false));
          }}
        >
          {busy ? "ブラウザを開いています…" : "Google でログイン"}
        </button>
      </Section>
    );
  }

  return (
    <>
      <div className="set2-id">
        <span className="acct-av lg">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initial}</span>}
        </span>
        <div className="acct-id-text">
          <span className="acct-id-name">{name}</span>
          <span className="acct-id-mail" title={email}>
            {email}
          </span>
        </div>
      </div>

      <Section
        title="プロフィール・アカウント"
        desc="表示名・アイコン・メール / パスワード・退会は web の設定で変更できます。"
      >
        <button
          className="set2-link"
          onClick={() => void openUrl(`${WEB_BASE}/settings`)}
        >
          <UserCog size={16} /> プロフィール・アカウントを編集
          <ExternalLink size={14} className="set2-link-ext" />
        </button>
      </Section>

      <Section title="ログアウト" desc="この端末からサインアウトします。">
        <button className="btn acct-logout" onClick={() => void signOut()}>
          <LogOut size={15} /> ログアウト
        </button>
      </Section>
    </>
  );
}

function DisplayTab({
  theme,
  onToggleTheme,
}: {
  theme: string;
  onToggleTheme: () => void;
}) {
  return (
    <Section title="テーマ" desc="アプリ全体の配色を切り替えます(PLAY 中は常にダーク)。">
      <div className="set2-seg">
        <button
          className={`set2-segbtn ${theme !== "dark" ? "on" : ""}`}
          onClick={() => theme === "dark" && onToggleTheme()}
        >
          <Sun size={15} /> ライト
        </button>
        <button
          className={`set2-segbtn ${theme === "dark" ? "on" : ""}`}
          onClick={() => theme !== "dark" && onToggleTheme()}
        >
          <Moon size={15} /> ダーク
        </button>
      </div>
    </Section>
  );
}

function SoundTab() {
  const [s, setS] = useState<Sound>(() => getSoundSettings());
  function update(patch: Partial<Sound>) {
    setS(setSoundSettings(patch));
  }
  function choose(type: SuccessSoundType) {
    update({ successType: type });
    playSuccess(type);
  }

  return (
    <Section
      title="効果音"
      desc="判定の成功 / クリティカル / ファンブル音。ダイスの転がり音は常に鳴ります。"
    >
      <label className="set-row">
        <input
          type="checkbox"
          checked={s.successEnabled}
          onChange={(e) => update({ successEnabled: e.target.checked })}
        />
        <span>判定が成功したら成功音を鳴らす</span>
      </label>

      <div className={`set-types ${s.successEnabled ? "" : "disabled"}`}>
        <p className="set-caption">成功音の種類</p>
        {SUCCESS_SOUND_TYPES.map((t) => (
          <div
            key={t.id}
            className={`set-type ${s.successType === t.id ? "active" : ""}`}
            onClick={() => s.successEnabled && choose(t.id)}
          >
            <input
              type="radio"
              name="successType"
              checked={s.successType === t.id}
              onChange={() => choose(t.id)}
              disabled={!s.successEnabled}
            />
            <div className="set-type-meta">
              <span className="set-type-label">{t.label}</span>
              <span className="set-type-desc">{t.desc}</span>
            </div>
            <button
              className="btn mini"
              disabled={!s.successEnabled}
              onClick={(e) => {
                e.stopPropagation();
                playSuccess(t.id);
              }}
              title="試聴"
            >
              ▶ 試聴
            </button>
          </div>
        ))}
      </div>

      <div className="set-special">
        <div className="set-row2">
          <label className="set-row2-main">
            <input
              type="checkbox"
              checked={s.criticalEnabled}
              onChange={(e) => update({ criticalEnabled: e.target.checked })}
            />
            <span>クリティカル音（イクストリーム / スペシャル）</span>
          </label>
          <button className="btn mini" onClick={() => playCritical()} title="試聴">
            ▶ 試聴
          </button>
        </div>
        <div className="set-row2">
          <label className="set-row2-main">
            <input
              type="checkbox"
              checked={s.fumbleEnabled}
              onChange={(e) => update({ fumbleEnabled: e.target.checked })}
            />
            <span>ファンブル音</span>
          </label>
          <button className="btn mini" onClick={() => playFumble()} title="試聴">
            ▶ 試聴
          </button>
        </div>
      </div>
    </Section>
  );
}

function PlayTab() {
  const [netName, setNetName] = useState(
    () => localStorage.getItem(NET_NAME_KEY) ?? "",
  );
  const [favCount, setFavCount] = useState(() => getQuickRolls().length);

  function saveName(v: string) {
    setNetName(v);
    try {
      localStorage.setItem(NET_NAME_KEY, v);
    } catch {
      /* 保存失敗は無視 */
    }
  }

  return (
    <>
      <Section
        title="既定のプレイヤー名"
        desc="参加コードで卓に入るときに最初から入っている名前です。"
      >
        <input
          className="input"
          style={{ maxWidth: 280 }}
          value={netName}
          onChange={(e) => saveName(e.target.value)}
          placeholder="プレイヤー名"
        />
      </Section>

      <Section
        title="クイックロール"
        desc="入力欄上のお気に入りダイスです。登録分をすべて消去します。"
      >
        <button
          className="btn"
          disabled={favCount === 0}
          onClick={() => {
            saveQuickRolls([]);
            setFavCount(0);
          }}
        >
          <Trash2 size={15} /> お気に入りロールをリセット
          {favCount > 0 ? `（${favCount}件）` : ""}
        </button>
      </Section>
    </>
  );
}

function AboutTab() {
  const links: { label: string; path: string }[] = [
    { label: "利用規約", path: "/terms" },
    { label: "出品ガイドライン", path: "/guidelines" },
    { label: "プライバシーポリシー", path: "/privacy" },
    { label: "ヘルプ・よくある質問", path: "/help" },
  ];
  return (
    <>
      <Section title="パラDa-iCE デスクトップ版" desc="TRPG の卓・キャラ・素材をひとつに。">
        <p className="muted" style={{ fontSize: 12 }}>
          作った卓やキャラはこの端末に保存されます。購入物はストアからダウンロードして
          ライブラリに取り込めます。
        </p>
      </Section>
      <Section title="規約・ヘルプ(web)">
        <div className="set2-links">
          {links.map((l) => (
            <button
              key={l.path}
              className="set2-link"
              onClick={() => void openUrl(`${WEB_BASE}${l.path}`)}
            >
              {l.label}
              <ExternalLink size={14} className="set2-link-ext" />
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}
