import { useMemo, useState } from "react";
import { Store, Loader2, X, ImagePlus, UploadCloud, FileUp } from "lucide-react";
import {
  publishFileProduct,
  type UploadProductType,
  type UploadFileFormat,
} from "./pack";
import { useAuth } from "./useAuth";
import { toast } from "./Toasts";
import { openExternalUrl as openUrl, WEB_BASE } from "./platform";

/**
 * 単一ファイル作品の投稿(ビルダー内「作品を投稿」)。
 *
 * web の /creator/products/new と同等に、PDF シナリオ / ZIP マップ・立ち絵 /
 * 音声 BGM をアプリから直接アップロードして下書き出品する。フルパッケージ
 * (.paradice)はシナリオビルダーの「出品する」を使う(別フロー)。
 *
 * ファイル選択は <input type="file"> を使う(Tauri webview / PWA どちらでも動く)。
 * Content-Type は拡張子から正規化して送る(Windows の zip は x-zip-compressed に
 * なるなど File.type が信用できないため)。
 */

type Category = {
  type: UploadProductType;
  format: UploadFileFormat;
  label: string;
  desc: string;
  /** 受け付ける拡張子(小文字・ドット付き)。 */
  exts: string[];
  /** アップロード時に送る MIME。 */
  contentType: string;
  accept: string;
};

const CATEGORIES: Category[] = [
  {
    type: "scenario",
    format: "pdf",
    label: "シナリオ",
    desc: "ストーリー・舞台設定（PDF）",
    exts: [".pdf"],
    contentType: "application/pdf",
    accept: "application/pdf,.pdf",
  },
  {
    type: "rulebook",
    format: "pdf",
    label: "ルールブック",
    desc: "ハウスルール・追加システム（PDF）",
    exts: [".pdf"],
    contentType: "application/pdf",
    accept: "application/pdf,.pdf",
  },
  {
    type: "map",
    format: "image_zip",
    label: "マップ・バトルマップ",
    desc: "戦闘マップ・地図（画像をまとめた ZIP）",
    exts: [".zip"],
    contentType: "application/zip",
    accept: "application/zip,.zip",
  },
  {
    type: "character_art",
    format: "image_zip",
    label: "アートワーク",
    desc: "立ち絵・アートワーク（画像をまとめた ZIP）",
    exts: [".zip"],
    contentType: "application/zip",
    accept: "application/zip,.zip",
  },
  {
    type: "bgm_audio",
    format: "audio",
    label: "BGM・効果音",
    desc: "BGM・効果音（MP3 / WAV）",
    exts: [".mp3", ".wav"],
    contentType: "audio/mpeg", // wav は選択時に上書き
    accept: "audio/mpeg,audio/wav,.mp3,.wav",
  },
];

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function UploadProductPanel() {
  const { session } = useAuth();
  const [categoryType, setCategoryType] =
    useState<UploadProductType>("scenario");
  const category = useMemo(
    () => CATEGORIES.find((c) => c.type === categoryType) ?? CATEGORIES[0],
    [categoryType],
  );

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(0);
  const [desc, setDesc] = useState("");
  const [systemLabel, setSystemLabel] = useState("");
  const [players, setPlayers] = useState("");
  const [playtime, setPlaytime] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [file, setFile] = useState<{ blob: File; name: string } | null>(null);
  const [cover, setCover] = useState<{
    url: string;
    blob: Blob;
    type: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File | undefined) {
    if (!f) return;
    const ext = extOf(f.name);
    if (!category.exts.includes(ext)) {
      setError(
        `このカテゴリで選べるのは ${category.exts.join(" / ")} です（選択: ${
          ext || "不明"
        }）。`,
      );
      return;
    }
    setError(null);
    setFile({ blob: f, name: f.name });
    // タイトル未入力なら拡張子を除いたファイル名を初期値に。
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  /** 選択中ファイルの拡張子から実際に送る Content-Type を決める(wav/mp3 の出し分け)。 */
  function resolveContentType(): string {
    if (!file) return category.contentType;
    const ext = extOf(file.name);
    if (category.format === "audio") {
      return ext === ".wav" ? "audio/wav" : "audio/mpeg";
    }
    return category.contentType;
  }

  async function submit() {
    if (!session) {
      setError("投稿するにはログインが必要です（右上のアカウントから）。");
      return;
    }
    const t = title.trim();
    if (!t) {
      setError("タイトルを入力してください。");
      return;
    }
    if (!file) {
      setError("アップロードするファイルを選んでください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(/[,、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await publishFileProduct(
        { blob: file.blob, contentType: resolveContentType() },
        {
          title: t,
          productType: category.type,
          fileFormat: category.format,
          priceJpy: Math.max(0, Math.round(price)),
          description: desc.trim() || undefined,
          systemLabel: systemLabel.trim() || undefined,
          players: players.trim() || undefined,
          playtime: playtime.trim() || undefined,
          tags: tags.length ? tags : undefined,
        },
        cover ? { blob: cover.blob, contentType: cover.type } : undefined,
      );
      toast("🛒 下書きを作成しました。ブラウザで内容を確認して公開してください。");
      // 仕上げ(表紙・価格確認・公開)の web ページを直接開く。
      void openUrl(`${WEB_BASE}/creator/products/${r.productId}/edit`);
      // フォームをリセット(連続投稿しやすく)。
      setTitle("");
      setPrice(0);
      setDesc("");
      setSystemLabel("");
      setPlayers("");
      setPlaytime("");
      setTagsInput("");
      setFile(null);
      setCover(null);
    } catch (e) {
      setError(`投稿に失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page scb">
      <div className="page-wrap">
        <header className="scb-hero">
          <div className="scb-hero-ic">
            <UploadCloud size={22} />
          </div>
          <div>
            <h2 className="scb-title">作品を投稿する</h2>
            <p className="scb-sub">
              PDF のシナリオ・ルールブック、画像をまとめた ZIP のマップ・立ち絵、
              MP3 / WAV の BGM をストアに出品できます。まず下書きが作られ、
              ブラウザのクリエイターページで表紙・価格を確認して公開します
              （有料は Stripe 連携が必要）。フルパッケージ（システム＋シナリオ）は
              「シナリオを作る」→「出品する」から。
            </p>
          </div>
        </header>

        {error && (
          <p className="tag fail" style={{ display: "block", margin: "8px 0" }}>
            {error}
          </p>
        )}

        <div className="upl-form">
          {/* カテゴリ選択 */}
          <div className="scb-pub-field">
            <span>カテゴリ</span>
            <div className="upl-cats">
              {CATEGORIES.map((c) => (
                <button
                  key={c.type}
                  type="button"
                  className={`upl-cat ${categoryType === c.type ? "on" : ""}`}
                  onClick={() => {
                    setCategoryType(c.type);
                    // カテゴリを変えたら形式の合わないファイルは外す。
                    if (file && !c.exts.includes(extOf(file.name))) {
                      setFile(null);
                    }
                    setError(null);
                  }}
                >
                  <b>{c.label}</b>
                  <span>{c.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ファイル選択 */}
          <div className="scb-pub-field">
            <span>
              作品ファイル（{category.exts.join(" / ")}）
            </span>
            <div className="upl-file">
              {file ? (
                <>
                  <span className="upl-file-name">
                    <FileUp size={15} /> {file.name}
                  </span>
                  <button
                    className="btn mini"
                    type="button"
                    onClick={() => setFile(null)}
                  >
                    <X size={13} /> 外す
                  </button>
                </>
              ) : (
                <label className="btn upl-file-pick">
                  <FileUp size={15} /> ファイルを選ぶ
                  <input
                    type="file"
                    accept={category.accept}
                    hidden
                    onChange={(e) => {
                      pickFile(e.target.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <label className="scb-pub-field">
            <span>タイトル</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="作品名"
              maxLength={100}
            />
          </label>

          {/* 表紙 */}
          <div className="scb-pub-field">
            <span>表紙画像（任意・PNG / JPG / WebP）</span>
            <div className="scb-pub-cover">
              {cover ? (
                <>
                  <img src={cover.url} alt="" className="scb-pub-cover-img" />
                  <button
                    className="btn mini"
                    type="button"
                    onClick={() => setCover(null)}
                  >
                    <X size={13} /> 外す
                  </button>
                </>
              ) : (
                <label className="btn mini scb-pub-cover-pick">
                  <ImagePlus size={14} /> 画像を選ぶ
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && /^image\/(png|jpe?g|webp)$/i.test(f.type)) {
                        setCover({
                          url: URL.createObjectURL(f),
                          blob: f,
                          type: f.type,
                        });
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <span className="scb-pub-hint">
              未設定でも出品できます（あとでブラウザで設定）。
            </span>
          </div>

          <label className="scb-pub-field">
            <span>価格（円・0 で無料）</span>
            <input
              className="input"
              type="number"
              min={0}
              step={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </label>

          <label className="scb-pub-field">
            <span>説明（任意）</span>
            <textarea
              className="input"
              rows={4}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="どんな作品か。あらすじ・遊び方・収録内容など"
            />
          </label>

          <div className="upl-row">
            <label className="scb-pub-field">
              <span>対応システム（任意）</span>
              <input
                className="input"
                value={systemLabel}
                onChange={(e) => setSystemLabel(e.target.value)}
                placeholder="例: クトゥルフ神話TRPG"
              />
            </label>
            <label className="scb-pub-field">
              <span>推奨人数（任意）</span>
              <input
                className="input"
                value={players}
                onChange={(e) => setPlayers(e.target.value)}
                placeholder="例: 3〜5人"
              />
            </label>
            <label className="scb-pub-field">
              <span>プレイ時間（任意）</span>
              <input
                className="input"
                value={playtime}
                onChange={(e) => setPlaytime(e.target.value)}
                placeholder="例: 約5時間"
              />
            </label>
          </div>

          <label className="scb-pub-field">
            <span>タグ（任意・カンマ / スペース区切り）</span>
            <input
              className="input"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="例: ホラー 初心者におすすめ 短時間"
            />
          </label>

          <div className="scb-pub-actions" style={{ marginTop: 4 }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="spin" /> 投稿中…
                </>
              ) : (
                <>
                  <Store size={15} /> 下書きを作成して続ける
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
