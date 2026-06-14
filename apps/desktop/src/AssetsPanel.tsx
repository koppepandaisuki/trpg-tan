import { useState } from "react";
import {
  Play,
  Plus,
  X,
  Pencil,
  ChevronUp,
  ChevronDown,
  Wand2,
  Layers,
  Image as ImageIcon,
  ImagePlus,
  UserPlus,
  Clapperboard,
  Type as TypeIcon,
  Music,
  Bell,
} from "lucide-react";
import type { AssetItem, AssetAction } from "@trpg/core";

/** 盤面ドロップで使う dataTransfer の MIME(中身は {name, image} JSON)。 */
export const ASSET_MIME = "application/x-paradice-asset";

/** 選択肢(シーン/カットイン/BGM/SE/キャラ)の最小形。 */
interface Opt {
  id: string;
  name: string;
}

type Kind = AssetAction["kind"];

/** アクション種別のメタ(表示名 + アイコン)。エディタの選択肢順でもある。 */
const KIND_META: { kind: Kind; label: string; Icon: typeof Layers }[] = [
  { kind: "scene", label: "シーン切替", Icon: Layers },
  { kind: "spawn-char", label: "キャラ登場", Icon: UserPlus },
  { kind: "board-bg", label: "背景に設定", Icon: ImageIcon },
  { kind: "place-image", label: "画像を配置", Icon: ImagePlus },
  { kind: "cutin", label: "カットイン", Icon: Clapperboard },
  { kind: "telop", label: "テロップ表示", Icon: TypeIcon },
  { kind: "bgm", label: "BGM", Icon: Music },
  { kind: "se", label: "効果音(SE)", Icon: Bell },
];
const kindMeta = (k: Kind) => KIND_META.find((m) => m.kind === k) ?? KIND_META[0];

/** ファイルを data URL に読む。 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () =>
      typeof r.result === "string" ? resolve(r.result) : reject();
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** アセットが「実行できる」アクションを 1 つ以上持つか(旧 image 単体も可)。 */
function isRunnable(a: AssetItem): boolean {
  return (a.actions && a.actions.length > 0) || !!a.image;
}

/**
 * アセット(卓の「ワンクリック演出」)。
 *   - 画像 / シーン / キャラ登場 / BGM / カットイン / テロップ / SE を
 *     好きな順に並べて 1 つのボタンにまとめる(マクロ)。
 *   - ボタンを押すと上から順に実行され、ひとつの演出として流れる。
 * 旧データ(画像単体)は「盤面に配置」する素材として後方互換で動く。
 */
export function AssetsPanel({
  assets,
  scenes,
  cutins,
  bgmTracks,
  seTracks,
  characters,
  onAdd,
  onSave,
  onRemove,
  onRun,
}: {
  assets: AssetItem[];
  scenes: Opt[];
  cutins: Opt[];
  bgmTracks: Opt[];
  seTracks: Opt[];
  characters: { id: string; name: string; thumbnail: string | null }[];
  /** 画像ドロップ等でのクイック追加(配置アセットを束で)。 */
  onAdd: (items: AssetItem[]) => void;
  /** 新規追加 / 既存更新。 */
  onSave: (asset: AssetItem) => void;
  onRemove: (id: string) => void;
  /** マクロを実行(ワンクリック)。 */
  onRun: (asset: AssetItem) => void;
}) {
  const [dropActive, setDropActive] = useState(false);
  // 編集中のアセット(下書き)。null = 一覧表示。
  const [editing, setEditing] = useState<AssetItem | null>(null);

  /** 画像ファイル群を「配置」アセットとしてクイック追加。 */
  function addImageFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    let remaining = images.length;
    const out: AssetItem[] = [];
    for (const f of images) {
      void fileToDataUrl(f).then((image) => {
        const name = f.name.replace(/\.[^.]+$/, "");
        out.push({
          id: crypto.randomUUID(),
          name,
          image,
          actions: [{ kind: "place-image", image, label: name }],
        });
        remaining -= 1;
        if (remaining === 0 && out.length > 0) onAdd(out);
      });
    }
  }

  if (editing) {
    return (
      <AssetEditor
        draft={editing}
        scenes={scenes}
        cutins={cutins}
        bgmTracks={bgmTracks}
        seTracks={seTracks}
        characters={characters}
        onSave={(a) => {
          onSave(a);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div
      className={`assets ${dropActive ? "drop-active" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        setDropActive(false);
        addImageFiles(e.dataTransfer.files);
      }}
    >
      {assets.length === 0 ? (
        <p className="palette-empty muted">
          「＋ アセットを作成」で、画像・シーン・キャラ登場・BGM などを
          ひとつのボタンにまとめられます。画像をここにドロップすると
          「配置」アセットを素早く追加できます。
        </p>
      ) : (
        <div className="asset-macros">
          {assets.map((a) => {
            const acts =
              a.actions && a.actions.length > 0
                ? a.actions
                : a.image
                  ? [{ kind: "place-image" } as AssetAction]
                  : [];
            return (
              <div
                key={a.id}
                className="asset-macro"
                role="button"
                tabIndex={0}
                onClick={() => onRun(a)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRun(a);
                  }
                }}
                draggable={!!a.image}
                onDragStart={(e) => {
                  if (!a.image) return;
                  e.dataTransfer.setData(
                    ASSET_MIME,
                    JSON.stringify({ name: a.name, image: a.image }),
                  );
                  e.dataTransfer.effectAllowed = "copy";
                }}
                title={`${a.name} — クリックで実行`}
              >
                <span className="asset-macro-thumb">
                  {a.image ? (
                    <img src={a.image} alt="" draggable={false} />
                  ) : (
                    <Play size={16} />
                  )}
                </span>
                <span className="asset-macro-main">
                  <span className="asset-macro-name">{a.name}</span>
                  <span className="asset-macro-kinds">
                    {acts.slice(0, 5).map((act, i) => {
                      const { Icon, label } = kindMeta(act.kind);
                      return <Icon key={i} size={12} aria-label={label} />;
                    })}
                    {acts.length > 1 && (
                      <span className="asset-macro-count">{acts.length}</span>
                    )}
                  </span>
                </span>
                <span className="asset-macro-acts">
                  <button
                    className="asset-act"
                    title="編集"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(structuredClone(a));
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="asset-act del"
                    title="削除"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(a.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
                {!isRunnable(a) && (
                  <span className="asset-macro-warn" title="アクションが空です">
                    !
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        className="btn mini btn-primary ibtn"
        style={{ width: "100%" }}
        onClick={() =>
          setEditing({ id: crypto.randomUUID(), name: "", actions: [] })
        }
      >
        <Wand2 size={14} /> アセットを作成
      </button>
    </div>
  );
}

/** アクションが「実行に必要な値」を持っているか。 */
function actionValid(a: AssetAction): boolean {
  switch (a.kind) {
    case "scene":
      return !!a.sceneId;
    case "board-bg":
    case "place-image":
      return !!a.image;
    case "spawn-char":
      return !!a.charId;
    case "cutin":
      return !!a.cutinId;
    case "telop":
      return !!a.text?.trim();
    case "bgm":
      return true; // 停止(null)も有効
    case "se":
      return !!a.seName;
  }
}

/** アセット作成 / 編集フォーム。アクションを並べてボタン化する。 */
function AssetEditor({
  draft,
  scenes,
  cutins,
  bgmTracks,
  seTracks,
  characters,
  onSave,
  onCancel,
}: {
  draft: AssetItem;
  scenes: Opt[];
  cutins: Opt[];
  bgmTracks: Opt[];
  seTracks: Opt[];
  characters: { id: string; name: string; thumbnail: string | null }[];
  onSave: (a: AssetItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [actions, setActions] = useState<AssetAction[]>(draft.actions ?? []);

  function addAction() {
    setActions((a) => [...a, { kind: "scene" }]);
  }
  function setKind(i: number, kind: Kind) {
    // 種別を変えたらその種別のフィールドだけにリセット。
    setActions((a) => a.map((x, j) => (j === i ? { kind } : x)));
  }
  function update(i: number, patch: Partial<AssetAction>) {
    setActions((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function removeAction(i: number) {
    setActions((a) => a.filter((_, j) => j !== i));
  }
  function move(i: number, d: -1 | 1) {
    setActions((a) => {
      const j = i + d;
      if (j < 0 || j >= a.length) return a;
      const next = a.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const valid = actions.filter(actionValid);
  const canSave = name.trim().length > 0 && valid.length > 0;

  function save() {
    if (!canSave) return;
    // 並びは保ったまま、未完成の行は落とす。
    const cleaned = actions.filter(actionValid);
    const firstImage = cleaned.find((a) => a.image)?.image;
    onSave({
      id: draft.id,
      name: name.trim(),
      actions: cleaned,
      ...(firstImage ? { image: firstImage } : {}),
    });
  }

  return (
    <div className="asset-editor">
      <label className="asset-ed-label">
        アセット名
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 戦闘開始 / ボス登場"
          autoFocus
        />
      </label>

      <div className="asset-ed-head-line">アクション（上から順に実行）</div>
      {actions.length === 0 ? (
        <p className="palette-empty muted" style={{ padding: "2px 0 6px" }}>
          「＋ アクションを追加」で動作を足してください。
        </p>
      ) : (
        <div className="asset-ed-actions">
          {actions.map((a, i) => (
            <div className="asset-ed-row" key={i}>
              <div className="asset-ed-row-top">
                <span className="asset-ed-no">{i + 1}</span>
                <select
                  className="asset-ed-kind"
                  value={a.kind}
                  onChange={(e) => setKind(i, e.target.value as Kind)}
                >
                  {KIND_META.map((m) => (
                    <option key={m.kind} value={m.kind}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <div className="asset-ed-row-tools">
                  <button
                    className="asset-act"
                    title="上へ"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    className="asset-act"
                    title="下へ"
                    disabled={i === actions.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button
                    className="asset-act del"
                    title="削除"
                    onClick={() => removeAction(i)}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              <ActionBody
                action={a}
                scenes={scenes}
                cutins={cutins}
                bgmTracks={bgmTracks}
                seTracks={seTracks}
                characters={characters}
                onChange={(patch) => update(i, patch)}
              />
            </div>
          ))}
        </div>
      )}

      <button className="btn mini ibtn" style={{ width: "100%" }} onClick={addAction}>
        <Plus size={14} /> アクションを追加
      </button>

      <div className="asset-ed-foot">
        <button className="btn mini" onClick={onCancel}>
          キャンセル
        </button>
        <button
          className="btn mini btn-primary"
          onClick={save}
          disabled={!canSave}
        >
          保存
        </button>
      </div>
    </div>
  );
}

/** アクション種別ごとの入力欄。 */
function ActionBody({
  action,
  scenes,
  cutins,
  bgmTracks,
  seTracks,
  characters,
  onChange,
}: {
  action: AssetAction;
  scenes: Opt[];
  cutins: Opt[];
  bgmTracks: Opt[];
  seTracks: Opt[];
  characters: { id: string; name: string; thumbnail: string | null }[];
  onChange: (patch: Partial<AssetAction>) => void;
}) {
  async function pickImage(file?: File | null) {
    if (!file) return;
    const image = await fileToDataUrl(file);
    onChange({ image });
  }

  switch (action.kind) {
    case "scene":
      return (
        <Picker
          value={action.sceneId ?? ""}
          opts={scenes}
          empty="（シーンがありません）"
          onChange={(v) => onChange({ sceneId: v })}
        />
      );
    case "spawn-char":
      return (
        <Picker
          value={action.charId ?? ""}
          opts={characters}
          empty="（保存済みキャラがありません）"
          onChange={(v) => onChange({ charId: v })}
        />
      );
    case "cutin":
      return (
        <Picker
          value={action.cutinId ?? ""}
          opts={cutins}
          empty="（カットインがありません）"
          onChange={(v) => onChange({ cutinId: v })}
        />
      );
    case "bgm":
      return (
        <select
          className="input"
          value={action.bgmId ?? "__stop__"}
          onChange={(e) =>
            onChange({
              bgmId: e.target.value === "__stop__" ? null : e.target.value,
            })
          }
        >
          <option value="__stop__">⏹ BGMを停止</option>
          {bgmTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      );
    case "se":
      return (
        <select
          className="input"
          value={action.seName ?? ""}
          onChange={(e) => onChange({ seName: e.target.value })}
        >
          <option value="">（効果音を選択）</option>
          {seTracks.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      );
    case "telop":
      return (
        <input
          className="input"
          value={action.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="画面に大きく出すテキスト"
        />
      );
    case "board-bg":
    case "place-image":
      return (
        <div className="asset-ed-img">
          {action.image ? (
            <img src={action.image} alt="" />
          ) : (
            <span className="asset-ed-img-none">画像未選択</span>
          )}
          <label className="btn mini asset-ed-imgbtn">
            {action.image ? "画像を変更" : "画像を選択"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                void pickImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      );
  }
}

/** 共通の選択ドロップダウン(空ならプレースホルダのみ)。 */
function Picker({
  value,
  opts,
  empty,
  onChange,
}: {
  value: string;
  opts: { id: string; name: string }[];
  empty: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{opts.length === 0 ? empty : "（選択してください）"}</option>
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
