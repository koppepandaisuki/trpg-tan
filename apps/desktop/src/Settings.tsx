import { useRef, useState } from "react";
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
  UserRound,
  ImagePlus,
} from "lucide-react";
import { useMyProfile } from "./useMyProfile";
import {
  useLocalProfile,
  setLocalNickname,
  setLocalAvatar,
  fileToAvatarDataUrl,
} from "./local-profile";
import { signInWithGoogle, signOut } from "./auth";
import { deleteMyAccount } from "./account-remote";
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
  children?: React.ReactNode;
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
  const { nickname, avatar } = useLocalProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを選び直せるようにリセット
    if (!file) return;
    setImgErr(null);
    try {
      const url = await fileToAvatarDataUrl(file);
      setLocalAvatar(url);
    } catch {
      setImgErr("画像を読み込めませんでした。別の画像を試してください。");
    }
  }

  return (
    <>
      <Section
        title="プロフィール"
        desc="この端末での表示名とアイコンです。卓(PLAY)に参加するときの名前にも使われます。ログインしても本名・メールはアプリ内に表示されません。"
      >
        <div className="set2-id">
          <span className="acct-av lg">
            {avatar ? (
              <img src={avatar} alt="" />
            ) : (
              <UserRound size={26} aria-hidden />
            )}
          </span>
          <div className="acct-id-text" style={{ gap: 8 }}>
            <input
              className="input"
              value={nickname}
              maxLength={40}
              onChange={(e) => setLocalNickname(e.target.value)}
              placeholder="ニックネーム（例: GM太郎）"
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                className="btn mini"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={14} /> 画像を選ぶ
              </button>
              {avatar && (
                <button
                  className="btn mini"
                  onClick={() => setLocalAvatar(null)}
                >
                  <Trash2 size={14} /> 画像を削除
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onPickImage}
              />
            </div>
            {!avatar && (
              <span className="muted" style={{ fontSize: 11 }}>
                画像未選択のときはゲストアイコンが表示されます。
              </span>
            )}
            {imgErr && (
              <span style={{ color: "#e5484d", fontSize: 11 }}>{imgErr}</span>
            )}
          </div>
        </div>
      </Section>

      <StoreLinkSection />
    </>
  );
}

/**
 * ストア連携(ログイン)。購入物のライブラリ取込に必要だが、本名 / メールは
 * 一切表示しない。メール / パスワード / 退会だけは認証レベルの操作なので web に
 * 委譲する(小さなリンク)。
 */
function StoreLinkSection() {
  const { ready, loggedIn } = useMyProfile();
  const [busy, setBusy] = useState(false);

  if (!supabaseConfigured) {
    return (
      <Section
        title="ストア連携"
        desc="ストア / ライブラリを使うにはログインが必要です。"
      >
        <p className="muted">ログイン未設定です(VITE_SUPABASE_URL / ANON_KEY)。</p>
      </Section>
    );
  }
  if (!ready) {
    return (
      <Section title="ストア連携">
        <p className="muted">…</p>
      </Section>
    );
  }
  if (!loggedIn) {
    return (
      <Section
        title="ストア連携"
        desc="ログインするとストアの購入物をライブラリに取り込めます。ログインしても本名・メールはアプリ内に表示されません。"
      >
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
      <Section
        title="ストア連携"
        desc="連携済みです。購入物をライブラリに取り込めます。本名・メールはアプリ内に表示・共有されません。"
      />

      <Section title="ログアウト" desc="この端末からサインアウトします。">
        <button className="btn acct-logout" onClick={() => void signOut()}>
          <LogOut size={15} /> ログアウト
        </button>
      </Section>

      <DeleteAccountSection />
    </>
  );
}

/**
 * 退会(アカウント削除)。アプリ内で完結する(web を開かない)。確認フレーズを
 * 入力させ、サーバーの退会 API を本人の JWT で叩く。成功でサインアウト。
 * 作品保有 creator はサーバー側で弾かれ、その旨が表示される。
 */
function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onDelete() {
    setErr(null);
    setBusy(true);
    try {
      await deleteMyAccount(confirm);
      setDone(true);
      await signOut();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "退会処理に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Section title="退会">
        <p className="muted">退会が完了しました。ご利用ありがとうございました。</p>
      </Section>
    );
  }

  return (
    <Section
      title="退会（アカウント削除）"
      desc="アカウントを完全に削除します。元に戻せません。"
    >
      {!open ? (
        <button className="btn acct-logout" onClick={() => setOpen(true)}>
          <Trash2 size={15} /> 退会する…
        </button>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxWidth: 360,
          }}
        >
          <p className="muted" style={{ fontSize: 12 }}>
            続けるには下の欄に「退会する」と入力してください。元に戻せません。
            作品を公開・登録中の場合は退会できません(先に作品を削除してください)。
          </p>
          <input
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="退会する"
          />
          {err && <span style={{ color: "#e5484d", fontSize: 11 }}>{err}</span>}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn acct-logout"
              disabled={busy || confirm.trim() !== "退会する"}
              onClick={() => void onDelete()}
            >
              {busy ? "処理中…" : "完全に削除する"}
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setErr(null);
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </Section>
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
  const [favCount, setFavCount] = useState(() => getQuickRolls().length);

  return (
    <>
      <Section
        title="参加名（プレイヤー名）"
        desc="卓に参加するときの名前は『アカウント』タブのニックネームを使います。"
      />

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
