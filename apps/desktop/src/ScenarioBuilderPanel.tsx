import { useRef } from "react";
import {
  Plus,
  Trash2,
  ImagePlus,
  UserPlus,
  ScrollText,
  X,
  Package,
} from "lucide-react";
import type { ScenarioInfo, Handout, ScenarioNpc } from "@trpg/core";

/**
 * シナリオ特化ビルダーの編集パネル(卓エディタ内「シナリオ作成」タブ)。
 * PlayScene.scenario(あらすじ/推奨人数/時間/GMメモ/HO/NPC)を編集する。
 * 外部PDF/txtを参照する既存の「シナリオ」タブ(ScenarioViewer)とは別物。
 *
 * HO(ハンドアウト)が目玉: 公開部分は全員、秘密部分は担当者だけに配る前提で
 * 入力する(実際の配布は PLAY 側の秘匿/個別チャットで行う)。
 */

function rid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    r.readAsDataURL(file);
  });
}

export function ScenarioBuilderPanel({
  scenario,
  onChange,
  onExportPack,
}: {
  scenario: ScenarioInfo | undefined;
  onChange: (next: ScenarioInfo) => void;
  /** 卓全体を .paradice として書き出す(親に委譲。未指定ならボタン非表示)。 */
  onExportPack?: () => void;
}) {
  const s = scenario ?? {};
  const patch = (p: Partial<ScenarioInfo>) => onChange({ ...s, ...p });

  const handouts = s.handouts ?? [];
  const setHandouts = (h: Handout[]) => patch({ handouts: h });
  const npcs = s.npcs ?? [];
  const setNpcs = (n: ScenarioNpc[]) => patch({ npcs: n });

  return (
    <div className="ss-scenario-build" style={{ display: "grid", gap: 14 }}>
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        この卓をそのまま遊べるシナリオにします。ここで書いた内容は卓に保存され、
        出品すれば「買って即PLAY」のシナリオになります。
      </p>

      {/* メタ */}
      <section style={{ display: "grid", gap: 8 }}>
        <Field label="あらすじ・概要">
          <textarea
            className="input"
            rows={3}
            value={s.synopsis ?? ""}
            onChange={(e) => patch({ synopsis: e.target.value })}
            placeholder="どんな話か。導入・舞台・目的など"
          />
        </Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="推奨人数">
            <input
              className="input"
              value={s.players ?? ""}
              onChange={(e) => patch({ players: e.target.value })}
              placeholder="例: 2〜4人"
            />
          </Field>
          <Field label="想定時間(分)">
            <input
              className="input"
              type="number"
              min={0}
              value={s.minutes ?? ""}
              onChange={(e) =>
                patch({
                  minutes: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              placeholder="例: 180"
            />
          </Field>
        </div>
        <Field label="GMメモ(進行の勘所・ネタバレ。GM専用)">
          <textarea
            className="input"
            rows={3}
            value={s.gmNotes ?? ""}
            onChange={(e) => patch({ gmNotes: e.target.value })}
            placeholder="GMだけが見る進行メモ"
          />
        </Field>
      </section>

      {/* ハンドアウト */}
      <section style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <strong style={{ fontSize: 13, display: "flex", gap: 6 }}>
            <ScrollText size={15} /> ハンドアウト（HO）
          </strong>
          <button
            className="btn mini"
            onClick={() =>
              setHandouts([
                ...handouts,
                { id: rid(), label: `HO${handouts.length + 1}`, title: "" },
              ])
            }
          >
            <Plus size={13} /> HOを追加
          </button>
        </div>
        {handouts.length === 0 && (
          <p className="muted" style={{ fontSize: 12 }}>
            プレイヤー個別の導入・秘密。公開部分は全員に、秘密部分は担当者だけに
            配ります。
          </p>
        )}
        {handouts.map((h) => (
          <HandoutEditor
            key={h.id}
            handout={h}
            onChange={(p) =>
              setHandouts(
                handouts.map((x) => (x.id === h.id ? { ...x, ...p } : x)),
              )
            }
            onRemove={() =>
              setHandouts(handouts.filter((x) => x.id !== h.id))
            }
          />
        ))}
      </section>

      {/* NPC */}
      <section style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <strong style={{ fontSize: 13, display: "flex", gap: 6 }}>
            <UserPlus size={15} /> NPC
          </strong>
          <button
            className="btn mini"
            onClick={() => setNpcs([...npcs, { id: rid(), name: "" }])}
          >
            <Plus size={13} /> NPCを追加
          </button>
        </div>
        {npcs.map((n) => (
          <NpcEditor
            key={n.id}
            npc={n}
            onChange={(p) =>
              setNpcs(npcs.map((x) => (x.id === n.id ? { ...x, ...p } : x)))
            }
            onRemove={() => setNpcs(npcs.filter((x) => x.id !== n.id))}
          />
        ))}
      </section>

      {/* 書き出し */}
      {onExportPack && (
        <section
          style={{
            display: "grid",
            gap: 6,
            borderTop: "1px solid var(--border, #ddd)",
            paddingTop: 12,
          }}
        >
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            この卓を .paradice ファイルにまとめて配布・出品できます
            （盤面・パネル・BGM・カットイン・テキストストック・ HO/NPC を含む）。
          </p>
          <button
            className="btn"
            onClick={onExportPack}
            style={{ justifySelf: "start" }}
          >
            <Package size={14} /> .paradice として書き出す
          </button>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 4, flex: 1 }}>
      <span className="muted" style={{ fontSize: 11 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ImagePick({
  image,
  onPick,
  onClear,
  label,
}: {
  image?: string | null;
  onPick: (dataUrl: string) => void;
  onClear: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {image ? (
        <div style={{ position: "relative" }}>
          <img
            src={image}
            alt=""
            style={{
              width: 44,
              height: 44,
              objectFit: "cover",
              borderRadius: 6,
            }}
          />
          <button
            className="btn mini"
            onClick={onClear}
            title="画像を外す"
            style={{ position: "absolute", top: -8, right: -8, padding: 2 }}
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        <button className="btn mini" onClick={() => ref.current?.click()}>
          <ImagePlus size={13} /> {label}
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onPick(await fileToDataUrl(f));
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function HandoutEditor({
  handout,
  onChange,
  onRemove,
}: {
  handout: Handout;
  onChange: (p: Partial<Handout>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        border: "1px solid var(--border, #ddd)",
        borderRadius: 8,
        padding: 8,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          className="input"
          value={handout.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="HO1"
          style={{ width: 64 }}
          maxLength={12}
        />
        <input
          className="input"
          value={handout.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="タイトル(例: 探索者A の導入)"
          style={{ flex: 1 }}
        />
        <button className="btn mini" onClick={onRemove} title="削除">
          <Trash2 size={13} />
        </button>
      </div>
      <textarea
        className="input"
        rows={2}
        value={handout.publicText ?? ""}
        onChange={(e) => onChange({ publicText: e.target.value })}
        placeholder="公開部分(全員に見せてよい導入)"
      />
      <textarea
        className="input"
        rows={2}
        value={handout.secretText ?? ""}
        onChange={(e) => onChange({ secretText: e.target.value })}
        placeholder="秘密部分(担当プレイヤーだけに見せる)"
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          className="input"
          value={handout.assignTo ?? ""}
          onChange={(e) => onChange({ assignTo: e.target.value || null })}
          placeholder="担当(プレイヤー名 / 任意)"
          style={{ flex: 1 }}
        />
        <ImagePick
          image={handout.image}
          onPick={(d) => onChange({ image: d })}
          onClear={() => onChange({ image: null })}
          label="画像"
        />
      </div>
    </div>
  );
}

function NpcEditor({
  npc,
  onChange,
  onRemove,
}: {
  npc: ScenarioNpc;
  onChange: (p: Partial<ScenarioNpc>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        border: "1px solid var(--border, #ddd)",
        borderRadius: 8,
        padding: 8,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <ImagePick
          image={npc.portrait}
          onPick={(d) => onChange({ portrait: d })}
          onClear={() => onChange({ portrait: null })}
          label="立ち絵"
        />
        <input
          className="input"
          value={npc.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="NPC名"
          style={{ flex: 1 }}
        />
        <button className="btn mini" onClick={onRemove} title="削除">
          <Trash2 size={13} />
        </button>
      </div>
      <textarea
        className="input"
        rows={2}
        value={npc.note ?? ""}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="公開情報(プレイヤーに見せてよい)"
      />
      <textarea
        className="input"
        rows={2}
        value={npc.secret ?? ""}
        onChange={(e) => onChange({ secret: e.target.value })}
        placeholder="秘密(GM専用)"
      />
    </div>
  );
}
