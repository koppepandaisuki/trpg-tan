"use client";

import * as React from "react";
import {
  Controller,
  useForm,
  type FieldPath,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  builderFormSchema,
  TAGS_MAX_COUNT,
  type BuilderFormValues,
} from "@/lib/validators/product";
import type { PopularTag } from "@/lib/queries/tags";
import { Plus, Sparkles } from "lucide-react";
import {
  saveDraftAction,
  publishAction,
  type SaveResult,
} from "@/app/(app)/creator/products/actions";
import { salePriceJpy } from "@/lib/format/price";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThreeColumn } from "@/components/layout/three-column";
import { PRODUCT_TYPE_LABEL, FILE_FORMAT_LABEL } from "@/lib/format/category";
import {
  TRPG_SYSTEMS,
  OTHER_SYSTEM_SENTINEL,
  isKnownSystem,
} from "@/lib/format/system";
import { statusLabel, type ProductStatus } from "@/lib/format/status";
import { BuilderToolbar } from "./toolbar";
import { SectionNav, type SectionNavItem } from "./section-nav";
import { SidebarInfo } from "./sidebar-info";
import { TagInput } from "./tag-input";
import { CuratedTagPicker } from "./curated-tag-picker";
import { UploadCover } from "./upload-cover";
import { UploadProductFile } from "./upload-product-file";
import { UploadScreenshots } from "./upload-screenshots";
import { cn } from "@/lib/utils";

interface BuilderFormProps {
  mode: "create" | "edit";
  productId?: string | null;
  currentStatus?: ProductStatus;
  publishedAt?: string | null;
  /** 直近の却下理由(status=draft で却下されていれば表示)。 */
  reviewNote?: string | null;
  initialValues: BuilderFormValues;
  /** If true, show "保存しました" right after mount (post-redirect). */
  savedJustNow?: boolean;
  /**
   * よく使われているタグ(おすすめ表示用)。空配列なら表示しない。
   * 親ページ(create / edit)で getPopularTags() の結果を渡す。
   */
  popularTags?: PopularTag[];
  /**
   * 編集モードで既存スクショ数を渡すと、UploadScreenshots の slot に
   * 「設定済み」マークが付く(視覚的ヒント)。
   */
  initialScreenshotsCount?: number;
}

const SECTIONS: SectionNavItem[] = [
  { id: "overview", label: "概要" },
  { id: "basic-info", label: "基本情報", number: 1 },
  { id: "tags", label: "タグ", number: 2 },
  { id: "pricing", label: "価格・形式", number: 3 },
  { id: "terms", label: "利用条件", number: 4 },
  { id: "publish", label: "公開設定", number: 5 },
  { id: "files", label: "ファイル添付", number: 6 },
];

/**
 * Client-side builder shell.
 *
 * Owns react-hook-form state. Renders the three-column layout, toolbar,
 * and form sections. Calls saveDraftAction / publishAction depending on
 * which button the user clicks.
 *
 * Status is NOT a form field — the click intent decides the persisted
 * status, matching the Phase 5 design (saveDraft vs publish actions).
 */
export function BuilderForm({
  mode,
  productId = null,
  currentStatus = "draft",
  publishedAt = null,
  reviewNote = null,
  initialValues,
  savedJustNow = false,
  popularTags,
  initialScreenshotsCount,
}: BuilderFormProps) {
  const form = useForm<BuilderFormValues>({
    resolver: zodResolver(builderFormSchema),
    defaultValues: initialValues,
    mode: "onBlur",
  });

  const [savedAt, setSavedAt] = React.useState<Date | null>(
    savedJustNow ? new Date() : null,
  );
  const [topMessage, setTopMessage] = React.useState<
    | { tone: "success"; text: string }
    | { tone: "error"; text: string }
    | null
  >(savedJustNow ? { tone: "success", text: "保存しました" } : null);

  const watched = form.watch();
  const errors = form.formState.errors;
  const isSubmitting = form.formState.isSubmitting;

  // Per Q9 / I-3: uploads run independently of the form save cycle, but
  // we still want to prevent the save / publish buttons from firing while
  // a PUT is in flight (which could otherwise race with the cover_path /
  // file_path update written by F-1).
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [uploadingScreenshots, setUploadingScreenshots] = React.useState(false);
  const saveLocked =
    isSubmitting || uploadingCover || uploadingFile || uploadingScreenshots;

  // Lightweight "input check" counts for the right sidebar.
  // Required: title (always), priceJpy (always)
  // Recommended (only suggested, not enforced for draft):
  //   description, at least one tag, systemLabel
  const requiredMissingCount =
    (watched.title?.trim() ? 0 : 1) +
    (Number.isFinite(watched.priceJpy) ? 0 : 1);

  const recommendedMissingCount =
    (watched.description?.trim() ? 0 : 1) +
    (watched.tags.length > 0 ? 0 : 1) +
    (watched.systemLabel?.trim() ? 0 : 1);

  function applyResult(
    result: SaveResult | undefined,
    successText = "保存しました",
  ): boolean {
    if (!result) return false;
    if ("error" in result) {
      setTopMessage({ tone: "error", text: result.error });
      if (result.fieldErrors) {
        for (const [field, msg] of Object.entries(result.fieldErrors)) {
          form.setError(field as FieldPath<BuilderFormValues>, { message: msg });
        }
      }
      return false;
    }
    setSavedAt(new Date());
    setTopMessage({ tone: "success", text: successText });
    return true;
  }

  async function handleSaveDraft() {
    setTopMessage(null);
    await form.handleSubmit(async (values) => {
      try {
        const result = await saveDraftAction(productId, values);
        applyResult(result);
      } catch {
        // Server Action redirected (create path). Navigation in progress; ignore.
      }
    })();
  }

  async function handlePublish() {
    setTopMessage(null);
    await form.handleSubmit(async (values) => {
      try {
        const result = await publishAction(productId, values);
        applyResult(
          result,
          "審査に提出しました。運営の承認後にストアへ公開されます。",
        );
      } catch {
        // see above
      }
    })();
  }

  return (
    <>
      <BuilderToolbar
        mode={mode}
        isSubmitting={saveLocked}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
      />

      <ThreeColumn
        left={<SectionNav items={SECTIONS} />}
        right={
          <SidebarInfo
            status={currentStatus}
            publishedAt={publishedAt}
            reviewNote={reviewNote}
            preview={watched}
            savedAt={savedAt}
            requiredMissingCount={requiredMissingCount}
            recommendedMissingCount={recommendedMissingCount}
          />
        }
      >
        {topMessage && (
          <div
            role={topMessage.tone === "error" ? "alert" : "status"}
            className={cn(
              "mb-4 rounded-md border px-3 py-2 text-sm",
              topMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
          >
            {topMessage.text}
          </div>
        )}

        <form className="space-y-6" noValidate>
          {/* ----------------------------- Overview ----------------------------- */}
          <Section id="overview" title="概要" description="作品の基本情報を入力してください。">
            <Field label="作品タイトル" required error={errors.title?.message}>
              <Input
                placeholder="例: 黄昏のアーカイブ"
                maxLength={100}
                {...form.register("title")}
              />
            </Field>

            <Field
              label="作品の種類"
              required
              error={errors.productType?.message}
            >
              <Controller
                control={form.control}
                name="productType"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Object.entries(PRODUCT_TYPE_LABEL).map(([value, label]) => {
                      const selected = field.value === value;
                      return (
                        <label
                          key={value}
                          className={cn(
                            "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors",
                            selected
                              ? "border-foreground bg-foreground/5 font-medium text-foreground"
                              : "border-border text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <input
                            type="radio"
                            value={value}
                            checked={selected}
                            onChange={() => field.onChange(value)}
                            className="sr-only"
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            </Field>

            <Field
              label="作品の説明"
              error={errors.description?.message}
              hint="作品の内容や特徴を入力してください。公開時には入力が必要です。"
            >
              <Textarea
                rows={6}
                placeholder="作品の内容や特徴を入力してください"
                maxLength={10000}
                {...form.register("description")}
              />
            </Field>
          </Section>

          {/* ----------------------------- Basic info ----------------------------- */}
          <Section
            id="basic-info"
            title="基本情報"
            description="対応システムやプレイ情報など、詳細メタを入力します(任意)。"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="対応システム" error={errors.systemLabel?.message}>
                <SystemSelect form={form} />
              </Field>
              <Field label="プレイ人数" error={errors.players?.message}>
                <Input
                  placeholder="例: 1〜4人"
                  maxLength={50}
                  {...form.register("players")}
                />
              </Field>
              <Field label="プレイ時間" error={errors.playtime?.message}>
                <Input
                  placeholder="例: 3〜5時間"
                  maxLength={50}
                  {...form.register("playtime")}
                />
              </Field>
              <Field label="推奨技能" error={errors.recommendedSkills?.message}>
                <Input
                  placeholder="例: 目星、図書館、精神分析"
                  maxLength={200}
                  {...form.register("recommendedSkills")}
                />
              </Field>
            </div>
          </Section>

          {/* ----------------------------- Tags ----------------------------- */}
          <Section
            id="tags"
            title="タグ"
            description="検索や絞り込みに使われます。公開には1つ以上のタグが必要です。"
          >
            <Controller
              control={form.control}
              name="tags"
              render={({ field }) => (
                <>
                  <TagInput value={field.value} onChange={field.onChange} />
                  {/* 編集部の正規セット。表記を揃えてストアの「テーマで探す」に
                      引っかかりやすくする(人気タグとは別物)。 */}
                  <CuratedTagPicker
                    selectedTags={field.value}
                    atMax={field.value.length >= TAGS_MAX_COUNT}
                    onAdd={(tag) => {
                      if (
                        !field.value.includes(tag) &&
                        field.value.length < TAGS_MAX_COUNT
                      ) {
                        field.onChange([...field.value, tag]);
                      }
                    }}
                    onRemove={(tag) =>
                      field.onChange(field.value.filter((t) => t !== tag))
                    }
                  />
                  <TagSuggestions
                    popularTags={popularTags ?? []}
                    selectedTags={field.value}
                    onAdd={(tag) => {
                      // 同タグ防止 + 上限チェック(TagInput と同じガード)
                      if (
                        !field.value.includes(tag) &&
                        field.value.length < TAGS_MAX_COUNT
                      ) {
                        field.onChange([...field.value, tag]);
                      }
                    }}
                    atMax={field.value.length >= TAGS_MAX_COUNT}
                  />
                </>
              )}
            />
            {errors.tags?.message && (
              <p className="text-xs text-destructive">{errors.tags.message}</p>
            )}
          </Section>

          {/* ----------------------------- Pricing ----------------------------- */}
          <Section
            id="pricing"
            title="価格・形式"
            description="価格(JPY)とファイル形式を設定します。"
          >
            <Field label="価格" required error={errors.priceJpy?.message}>
              <PriceControl form={form} />
            </Field>

            <Field
              label="割引・セール（任意）"
              error={
                errors.discountPercent?.message ??
                errors.discountEndsAt?.message
              }
            >
              <DiscountControl form={form} />
            </Field>

            <Field
              label="ファイル形式"
              required
              error={errors.fileFormat?.message}
            >
              <Controller
                control={form.control}
                name="fileFormat"
                render={({ field }) => (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {Object.entries(FILE_FORMAT_LABEL).map(([value, label]) => {
                      const selected = field.value === value;
                      return (
                        <label
                          key={value}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                            selected
                              ? "border-foreground bg-foreground/5 font-medium text-foreground"
                              : "border-border text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <input
                            type="radio"
                            value={value}
                            checked={selected}
                            onChange={() => field.onChange(value)}
                            className="h-4 w-4"
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            </Field>
          </Section>

          {/* ----------------------------- Terms ----------------------------- */}
          <Section
            id="terms"
            title="利用条件"
            description="購入者に開示する利用条件のフラグです。"
          >
            <CheckboxRow
              label="商用利用を許可する"
              {...form.register("allowCommercial")}
            />
            <CheckboxRow
              label="二次配布を許可する"
              {...form.register("allowRedistribution")}
            />
          </Section>

          {/* ----------------------------- Publish ----------------------------- */}
          <Section
            id="publish"
            title="公開設定"
            description="上部の「審査に出す」を押すと、入力が公開条件を満たしているかチェックされ、運営の審査に提出されます。承認されるとストアに公開されます。"
          >
            <Card className="border-border/70 bg-muted/40">
              <CardContent className="space-y-1.5 p-4 text-sm">
                <p className="font-medium">現在のステータス: {statusLabel(currentStatus)}</p>
                <p className="text-xs text-muted-foreground">
                  「下書き保存」では公開条件をチェックしません。
                  「審査に出す」ではタイトル / 説明 / カテゴリ / 形式 / 価格 / タグ(1個以上)が必要です。
                  提出後は運営の承認を経てストアに公開されます。
                </p>
                <p className="text-xs text-muted-foreground">
                  出品の前に{" "}
                  <a
                    href="/guidelines"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    出品ガイドライン
                  </a>
                  をご確認ください。違反する作品は審査で却下されます。
                </p>
                {currentStatus === "suspended" && (
                  <p className="text-xs text-destructive">
                    この作品は運営により停止中です。公開の再開は admin にお問い合わせください。
                  </p>
                )}
              </CardContent>
            </Card>
          </Section>

          {/* ----------------------------- Files ----------------------------- */}
          <Section
            id="files"
            title="ファイル添付"
            description="表紙画像と作品本体ファイルをアップロードします。各アップロードは選択した瞬間に開始され、保存ボタンとは独立して反映されます。"
          >
            {productId ? (
              <div className="space-y-5">
                <Field label="表紙画像">
                  <UploadCover
                    productId={productId}
                    onUploadingChange={setUploadingCover}
                  />
                </Field>
                <Field label="作品ファイル">
                  <UploadProductFile
                    productId={productId}
                    fileFormat={watched.fileFormat}
                    onUploadingChange={setUploadingFile}
                  />
                </Field>
                <Field label="スクリーンショット(任意)">
                  <UploadScreenshots
                    productId={productId}
                    initialFilledSlots={initialScreenshotsCount ?? 0}
                    onUploadingChange={setUploadingScreenshots}
                  />
                </Field>
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  ファイル添付は作品を「下書き保存」してから行えます。
                  <br />
                  先にタイトル等の基本情報を入力し、保存してください。
                </CardContent>
              </Card>
            )}
          </Section>
        </form>
      </ThreeColumn>
    </>
  );
}

// ---------------------------------------------------------------------
// Small inner components
// ---------------------------------------------------------------------

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{label}</span>
        {required && (
          <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            必須
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * 既によく使われているタグを「おすすめ」として表示。クリックで現在の
 * タグセットに追加する。表記揺れ(例: "クトゥルフ" vs "cthulhu" vs
 * "coc" を別々に作ってしまう)を防ぐ目的。
 *
 * 表示方針:
 *  - selectedTags に含まれているタグは表示しない(空っぽになって
 *    判別不能になるのを避ける、最大 15 件表示)
 *  - count を小さく付与(参考情報、検索順位ではないと分かる程度)
 *  - atMax(タグ上限到達)時は disabled に
 *  - popularTags が空のときは section ごと表示しない
 */
function TagSuggestions({
  popularTags,
  selectedTags,
  onAdd,
  atMax,
}: {
  popularTags: PopularTag[];
  selectedTags: string[];
  onAdd: (tag: string) => void;
  atMax: boolean;
}) {
  const available = popularTags.filter((p) => !selectedTags.includes(p.tag));
  if (available.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          よく使われるタグ
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {available.slice(0, 15).map(({ tag, count }) => (
          <button
            type="button"
            key={tag}
            onClick={() => onAdd(tag)}
            disabled={atMax}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground transition hover:border-foreground/30 hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-3 w-3" aria-hidden />
            <span>#{tag}</span>
            <span className="text-[10px] text-muted-foreground/70">
              ({count})
            </span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        タグの表記揺れを防ぐため、すでに使われているタグから選ぶのがおすすめです。
      </p>
    </div>
  );
}

/**
 * 対応システム入力。<select> で主要 TRPG システムから選択 + 「その他」を
 * 選んだときだけ自由入力欄を出す。
 *
 * Edit モードで既存の systemLabel が選択肢に含まれていなければ、自動的に
 * 「その他」モード + その値が入力欄に入る(下位互換の維持)。
 *
 * 内部状態 otherMode は select の表示と入力欄の表示を制御するだけで、
 * 永続化される値は systemLabel フィールド一つ(従来通り text 列)。
 */
function SystemSelect({ form }: { form: UseFormReturn<BuilderFormValues> }) {
  const value = form.watch("systemLabel") ?? "";
  const [otherMode, setOtherMode] = React.useState<boolean>(
    () => value !== "" && !isKnownSystem(value),
  );

  // select に表示する値:
  //  - otherMode 中 → sentinel(その他)
  //  - 既知のシステム → そのまま
  //  - それ以外 → "" (未選択)
  const selectValue = otherMode
    ? OTHER_SYSTEM_SENTINEL
    : isKnownSystem(value)
      ? value
      : "";

  return (
    <div className="space-y-2">
      <select
        className={cn(
          "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER_SYSTEM_SENTINEL) {
            // 「その他」選択: カスタム入力モードへ。値は一旦クリアして、
            // ユーザーが入力欄に書き込むのを待つ
            form.setValue("systemLabel", "", { shouldValidate: true });
            setOtherMode(true);
          } else {
            // 既知選択 or 未選択(""): otherMode を解除して直接反映
            form.setValue("systemLabel", v, { shouldValidate: true });
            setOtherMode(false);
          }
        }}
        aria-label="対応システム"
      >
        <option value="">未選択</option>
        {TRPG_SYSTEMS.map((sys) => (
          <option key={sys} value={sys}>
            {sys}
          </option>
        ))}
        <option value={OTHER_SYSTEM_SENTINEL}>
          その他(自由入力)
        </option>
      </select>

      {otherMode && (
        <Input
          placeholder="例: 自作TRPG、海外マイナーシステムなど"
          maxLength={100}
          {...form.register("systemLabel")}
          // ユーザーが「その他」を選んだ直後に入力欄にフォーカスを当てる
          autoFocus
        />
      )}
    </div>
  );
}

const CheckboxRow = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string }
>(({ label, ...rest }, ref) => (
  <label className="flex items-center gap-2 text-sm">
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 rounded border-border text-foreground focus:ring-ring"
      {...rest}
    />
    <span>{label}</span>
  </label>
));
CheckboxRow.displayName = "CheckboxRow";

function PriceControl({
  form,
}: {
  form: ReturnType<typeof useForm<BuilderFormValues>>;
}) {
  const price = form.watch("priceJpy") ?? 0;
  const [isFree, setIsFree] = React.useState(price <= 0);

  React.useEffect(() => {
    if (isFree && price !== 0) form.setValue("priceJpy", 0);
  }, [isFree, price, form]);

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={isFree}
            onChange={() => setIsFree(true)}
            className="h-4 w-4"
          />
          無料
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={!isFree}
            onChange={() => setIsFree(false)}
            className="h-4 w-4"
          />
          有料
        </label>
      </div>
      {!isFree && (
        <div className="flex items-center gap-2">
          <span className="text-sm">¥</span>
          <Input
            type="number"
            min={100}
            max={10000000}
            step={100}
            inputMode="numeric"
            className="max-w-[160px]"
            {...form.register("priceJpy", { valueAsNumber: true })}
          />
          <span className="text-xs text-muted-foreground">100〜10,000,000円</span>
        </div>
      )}
      {/* 価格選択の意味を creator に明示。α 期間中の Connect 未完了でも
          無料公開可の挙動と、有料には Stripe 接続が必要、を案内する。 */}
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        {isFree ? (
          <p>
            <strong className="text-foreground">無料(¥0)</strong>:
            α 期間中は Stripe 接続が未完了でもそのまま公開できます。
            動線テスト・コンテンツ公開だけしたい場合はこちら。
          </p>
        ) : (
          <p>
            <strong className="text-foreground">有料</strong>:
            公開には <strong>Stripe 接続(受取口座設定)</strong>の完了が必要です。
            未接続のまま「審査に出す」するとエラーになります。
            クリエイターメニュー → Stripe 接続 から手続きしてください。
          </p>
        )}
      </div>
    </div>
  );
}

/** ISO 文字列 ↔ <input type="datetime-local"> のローカル値を相互変換。 */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v); // datetime-local はローカル時刻として解釈される
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 割引率(0..100)とセール期間(任意)の入力。
 * 100% にすると無料配布になる。期間を空にすると無期限セール。
 * 価格が 0(無料)のときは割引の意味がないので案内だけ出す。
 */
function DiscountControl({
  form,
}: {
  form: ReturnType<typeof useForm<BuilderFormValues>>;
}) {
  const price = form.watch("priceJpy") ?? 0;
  const percent = form.watch("discountPercent") ?? 0;

  if (price <= 0) {
    return (
      <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        無料(¥0)の作品には割引は適用されません。有料に設定すると割引・セールを
        設定できます。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          className="max-w-[110px]"
          {...form.register("discountPercent", { valueAsNumber: true })}
        />
        <span className="text-sm">% OFF</span>
        {percent >= 100 ? (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            実質無料配布
          </span>
        ) : percent > 0 ? (
          <span className="text-xs text-muted-foreground">
            割引後 ¥{salePriceJpy(price, percent).toLocaleString("ja-JP")}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="discountStartsAt"
          render={({ field }) => (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              開始（空＝今すぐ）
              <Input
                type="datetime-local"
                value={isoToLocalInput(field.value ?? null)}
                onChange={(e) => field.onChange(localInputToIso(e.target.value))}
              />
            </label>
          )}
        />
        <Controller
          control={form.control}
          name="discountEndsAt"
          render={({ field }) => (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              終了（空＝無期限）
              <Input
                type="datetime-local"
                value={isoToLocalInput(field.value ?? null)}
                onChange={(e) => field.onChange(localInputToIso(e.target.value))}
              />
            </label>
          )}
        />
      </div>

      <p className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">割引</strong>は定価に対する値引きで、
        ストアでは「定価の取り消し線＋割引後価格」で表示されます。
        <strong className="text-foreground">100%</strong> にすると
        <strong className="text-foreground">無料配布</strong>になります（決済不要）。
        期間を指定すると、その間だけ割引が有効になります。
      </p>
    </div>
  );
}

