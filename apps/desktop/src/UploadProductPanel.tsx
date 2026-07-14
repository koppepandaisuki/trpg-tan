import { useEffect, useMemo, useState } from "react";
import {
  Store,
  Loader2,
  X,
  ImagePlus,
  UploadCloud,
  FileUp,
  Tag,
} from "lucide-react";
import {
  publishFileProduct,
  type UploadProductType,
  type UploadFileFormat,
} from "./pack";
import { supabase } from "./supabase";
import { useAuth } from "./useAuth";
import { toast } from "./Toasts";
import { openExternalUrl as openUrl, WEB_BASE } from "./platform";

/**
 * 単一ファイル作品の投稿(ビルダー内「作品を投稿」)。
 *
 * web の /creator/products/new と同等に、PDF シナリオ / ZIP マップ・立ち絵 /
 * 音声 BGM をアプリから直接アップロードして下書き出品する。価格(無料/有料)、
 * 割引(率 + 任意のセール期間)、タグ(チップ入力 + 人気タグのサジェスト)も
 * web と同じ仕様。フルパッケージ(.paradice)はシナリオビルダーの
 * 「出品する」を使う(別フロー)。
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

/** 割引後の実効価格。web の lib/format/price.ts salePriceJpy と同じ丸め(四捨五入)。 */
function salePriceJpy(priceJpy: number, discountPercent: number): number {
  const d = Math.min(100, Math.max(0, Math.round(discountPercent || 0)));
  if (d <= 0) return priceJpy;
  return Math.max(0, Math.round((priceJpy * (100 - d)) / 100));
}

const MAX_TAGS = 20;

export function UploadProductPanel() {
  const { session } = useAuth();
  const [categoryType, setCategoryType] =
    useState<UploadProductType>("scenario");
  const category = useMemo(
    () => CATEGORIES.find((c) => c.type === categoryType) ?? CATEGORIES[0],
    [categoryType],
  );

  const [title, setTitle] = useState("");
  // 価格: 無料 / 有料(金額)。web と同じく既定は無料。
  const [pricing, setPricing] = useState<"free" | "paid">("free");
  const [price, setPrice] = useState(1000);
  // 割引(有料のみ)。率 0..100、期間は datetime-local の値(空 = 指定なし)。
  const [discount, setDiscount] = useState(0);
  const [saleStart, setSaleStart] = useState("");
  const [saleEnd, setSaleEnd] = useState("");
  const [desc, setDesc] = useState("");
  const [systemLabel, setSystemLabel] = useState("");
  const [players, setPlayers] = useState("");
  const [playtime, setPlaytime] = useState("");
  // タグ: 確定済みチップ + 入力中ドラフト + 人気タグのサジェスト。
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [popularTags, setPopularTags] = useState<
    { tag: string; count: number }[]
  >([]);
  const [file, setFile] = useState<{ blob: File; name: string } | null>(null);
  const [cover, setCover] = useState<{
    url: string;
    blob: Blob;
    type: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 人気タグ(すでに使われているタグ)を読み込む。web の getPopularTags と同じ
  // 全件取得 + クライアント集計(α 期間はデータ量が少ないので十分)。
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data, error: qErr } = await supabase
          .from("product_tags")
          .select("tag")
          .limit(5000);
        if (qErr || !data || !alive) return;
        const counts = new Map<string, number>();
        for (const row of data as { tag: string | null }[]) {
          if (!row.tag) continue;
          counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
        }
        const list = Array.from(counts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) =>
            b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag),
          )
          .slice(0, 16);
        if (alive) setPopularTags(list);
      } catch {
        // サジェストは飾り。失敗しても投稿には影響させない。
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const effectivePrice = pricing === "free" ? 0 : Math.max(0, Math.round(price));
  const sale = salePriceJpy(effectivePrice, discount);

  function addTag(raw: string) {
    const t = raw.trim().replace(/^#/, "");
    if (!t || t.length > 30) return;
    setTags((cur) =>
      cur.includes(t) || cur.length >= MAX_TAGS ? cur : [...cur, t],
    );
  }

  function commitTagDraft() {
    // カンマ・読点・空白区切りでまとめて追加できるようにする。
    for (const part of tagDraft.split(/[,、]/)) addTag(part);
    setTagDraft("");
  }

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

  /** datetime-local の値(ローカル時刻)を ISO 文字列へ。空は null。 */
  function toIso(v: string): string | null {
    if (!v.trim()) return null;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
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
    if (pricing === "paid" && effectivePrice < 100) {
      setError("有料の場合は 100〜10,000,000 円で設定してください（無料にするなら「無料」を選択）。");
      return;
    }
    // Stripe の JPY 最低決済額 ¥50 対策(web と同じルール)。
    if (sale > 0 && sale < 50) {
      setError(
        "割引後の価格が¥50未満になります(決済不可)。割引率を下げるか、100%(無料配布)にしてください。",
      );
      return;
    }
    const startIso = toIso(saleStart);
    const endIso = toIso(saleEnd);
    if (startIso && endIso && Date.parse(endIso) <= Date.parse(startIso)) {
      setError("セール終了は開始より後にしてください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 入力欄に残っているタグも拾う。
      const finalTags = [...tags];
      for (const part of tagDraft.split(/[,、]/)) {
        const x = part.trim().replace(/^#/, "");
        if (x && x.length <= 30 && !finalTags.includes(x)) finalTags.push(x);
      }
      const r = await publishFileProduct(
        { blob: file.blob, contentType: resolveContentType() },
        {
          title: t,
          productType: category.type,
          fileFormat: category.format,
          priceJpy: effectivePrice,
          discountPercent: pricing === "paid" ? discount : 0,
          discountStartsAt: pricing === "paid" ? startIso : null,
          discountEndsAt: pricing === "paid" ? endIso : null,
          description: desc.trim() || undefined,
          systemLabel: systemLabel.trim() || undefined,
          players: players.trim() || undefined,
          playtime: playtime.trim() || undefined,
          tags: finalTags.length ? finalTags.slice(0, MAX_TAGS) : undefined,
        },
        cover ? { blob: cover.blob, contentType: cover.type } : undefined,
      );
      toast("🛒 下書きを作成しました。ブラウザで内容を確認して公開してください。");
      // 仕上げ(表紙・価格確認・公開)の web ページを直接開く。
      void openUrl(`${WEB_BASE}/creator/products/${r.productId}/edit`);
      // フォームをリセット(連続投稿しやすく)。
      setTitle("");
      setPricing("free");
      setPrice(1000);
      setDiscount(0);
      setSaleStart("");
      setSaleEnd("");
      setDesc("");
      setSystemLabel("");
      setPlayers("");
      setPlaytime("");
      setTags([]);
      setTagDraft("");
      setFile(null);
      setCover(null);
    } catch (e) {
      setError(`投稿に失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = popularTags.filter((p) => !tags.includes(p.tag));

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
              ブラウザのクリエイターページで内容を確認して公開します
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

          {/* 価格(無料 / 有料) */}
          <div className="scb-pub-field">
            <span>価格</span>
            <div className="upl-price-row">
              <label className="upl-radio">
                <input
                  type="radio"
                  name="upl-pricing"
                  checked={pricing === "free"}
                  onChange={() => setPricing("free")}
                />
                無料
              </label>
              <label className="upl-radio">
                <input
                  type="radio"
                  name="upl-pricing"
                  checked={pricing === "paid"}
                  onChange={() => setPricing("paid")}
                />
                有料
              </label>
              {pricing === "paid" && (
                <span className="upl-price-input">
                  ¥
                  <input
                    className="input"
                    type="number"
                    min={100}
                    max={10000000}
                    step={100}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value) || 0)}
                  />
                  <span className="scb-pub-hint">100〜10,000,000円</span>
                </span>
              )}
            </div>
            {pricing === "paid" && (
              <span className="scb-pub-hint">
                有料作品の公開には Stripe 接続（受取口座設定）が必要です。未接続の場合はブラウザのクリエイターメニュー → Stripe 接続 から手続きしてください。
              </span>
            )}
          </div>

          {/* 割引・セール(有料のみ) */}
          {pricing === "paid" && (
            <div className="scb-pub-field">
              <span>割引・セール（任意）</span>
              <div className="upl-discount-row">
                <input
                  className="input upl-discount-pct"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={discount}
                  onChange={(e) =>
                    setDiscount(
                      Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    )
                  }
                />
                <span>% OFF</span>
                {discount > 0 && (
                  <span className="upl-sale-preview">
                    {sale === 0 ? (
                      <b>無料配布になります</b>
                    ) : (
                      <>
                        割引後 <b>¥{sale.toLocaleString()}</b>
                      </>
                    )}
                  </span>
                )}
              </div>
              {discount > 0 && (
                <div className="upl-row">
                  <label className="scb-pub-field">
                    <span>開始（空＝今すぐ）</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={saleStart}
                      onChange={(e) => setSaleStart(e.target.value)}
                    />
                  </label>
                  <label className="scb-pub-field">
                    <span>終了（空＝無期限）</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={saleEnd}
                      onChange={(e) => setSaleEnd(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <span className="scb-pub-hint">
                割引は定価に対する値引きで、ストアでは「定価の取り消し線＋割引後価格」で表示されます。100%
                にすると無料配布になります（決済不要）。期間を指定すると、その間だけ割引が有効になります。
              </span>
            </div>
          )}

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

          {/* タグ(チップ入力 + 人気タグのサジェスト) */}
          <div className="scb-pub-field">
            <span>タグ（任意・最大{MAX_TAGS}個）</span>
            <div className="upl-tags">
              {tags.map((t) => (
                <span key={t} className="upl-tag-chip">
                  <Tag size={11} /> {t}
                  <button
                    type="button"
                    aria-label={`タグ「${t}」を外す`}
                    onClick={() =>
                      setTags((cur) => cur.filter((x) => x !== t))
                    }
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                className="input upl-tag-input"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    commitTagDraft();
                  } else if (
                    e.key === "Backspace" &&
                    !tagDraft &&
                    tags.length > 0
                  ) {
                    // 空欄でバックスペース → 直前のチップを消す(web的な操作感)。
                    setTags((cur) => cur.slice(0, -1));
                  }
                }}
                onBlur={() => {
                  if (tagDraft.trim()) commitTagDraft();
                }}
                placeholder={
                  tags.length ? "" : "例: ホラー（Enterで追加）"
                }
              />
            </div>
            {suggestions.length > 0 && (
              <div className="upl-tag-sugs">
                {suggestions.slice(0, 12).map((s) => (
                  <button
                    key={s.tag}
                    type="button"
                    className="upl-tag-sug"
                    onClick={() => addTag(s.tag)}
                    disabled={tags.length >= MAX_TAGS}
                  >
                    ＋ #{s.tag} <i>({s.count})</i>
                  </button>
                ))}
              </div>
            )}
            <span className="scb-pub-hint">
              タグの表記揺れを防ぐため、すでに使われているタグから選ぶのがおすすめです。
            </span>
          </div>

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
