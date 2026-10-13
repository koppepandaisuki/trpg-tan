import { useState } from "react";
import {
  Plus,
  ScrollText,
  Save,
  Package,
  ChevronLeft,
  Clock,
  LayoutDashboard,
  FileOutput,
} from "lucide-react";
import {
  createScene,
  buildPack,
  type PlayScene,
  type ScenarioInfo,
  type SceneInfo,
} from "@trpg/core";
import { ScenarioBuilderPanel } from "./ScenarioBuilderPanel";
import { EmptyState } from "./EmptyState";
import {
  readPlayFromPath,
  savePlayAs,
  savePlayToPath,
  type PlayIndexEntry,
} from "./play-storage";
import { exportPackToFile } from "./pack";
import { getCustomSystems } from "./systems-store";
import { toast } from "./Toasts";

/**
 * シナリオ作成(ビルダー内「シナリオを作る」)。
 *
 * PLAY(卓を立てて遊ぶ)とは独立した入口。基本はフォームだけで
 * あらすじ/HO/NPC/シーン台本を編集できる(盤面なし)。盤面配置・BGM・
 * カットインまで作り込みたい人は「卓ごと編集」で同じデータを PLAY の
 * 卓エディタで開ける(シナリオ = 卓 のため)。
 *
 * 「書き出す」は .paradice(配布パッケージ)ファイルを作る。仲間に渡せば
 * ライブラリの「パッケージを取り込む」でそのまま遊べる。2026-09 のストア
 * 廃止までは、ここが「ストアに出品」だった。
 *
 * 保存実体は .play ファイル(卓と同じ)。索引も共有するので、ここで作った
 * シナリオは PLAY ロビーの「保存済みの卓」にも出る。
 */

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

export function ScenarioBuilder({
  index,
  onPersist,
  onRemove,
  onOpenTable,
}: {
  index: PlayIndexEntry[];
  /** ファイル保存後に索引/サムネを更新(App の handlePlayPersist)。 */
  onPersist: (scene: PlayScene, path: string) => void | Promise<void>;
  onRemove: (id: string) => void;
  /** 「卓ごと編集」: 同じシナリオ(卓)を PLAY の卓エディタで開く。 */
  onOpenTable: (scene: PlayScene, path: string | null) => void;
}) {
  const [editing, setEditing] = useState<{
    scene: PlayScene;
    path: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  function newScenario() {
    const scene = createScene({
      id: crypto.randomUUID(),
      title: "新しいシナリオ",
      systemId: "coc7",
      now: new Date().toISOString(),
    });
    setEditing({ scene, path: null });
    setFlash(null);
    setError(null);
  }

  async function openDraft(entry: PlayIndexEntry) {
    setError(null);
    try {
      const scene = await readPlayFromPath(entry.path);
      setEditing({ scene, path: entry.path });
    } catch (e) {
      setError(`開けませんでした(移動/削除の可能性): ${String(e)}`);
    }
  }

  function patchScene(updater: (s: PlayScene) => PlayScene) {
    setEditing((cur) => (cur ? { ...cur, scene: updater(cur.scene) } : cur));
  }

  async function save(): Promise<{ scene: PlayScene; path: string } | null> {
    if (!editing) return null;
    setBusy(true);
    setError(null);
    try {
      const scene: PlayScene = {
        ...editing.scene,
        meta: { ...editing.scene.meta, updatedAt: new Date().toISOString() },
      };
      let p = editing.path;
      if (!p) {
        const np = await savePlayAs(scene);
        if (!np) return null; // ダイアログがキャンセルされた
        p = np;
      } else {
        await savePlayToPath(scene, p);
      }
      await onPersist(scene, p);
      setEditing({ scene, path: p });
      setFlash("保存しました");
      window.setTimeout(() => setFlash(null), 1800);
      return { scene, path: p };
    } catch (e) {
      setError(`保存に失敗しました: ${String(e)}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function openInTable() {
    // 卓で開く前に保存してパスを確定(卓側の保存先と一致させる)。
    const res = await save();
    if (!res) return;
    onOpenTable(res.scene, res.path);
  }

  /** .paradice として書き出す(仲間に渡す / バックアップ)。 */
  async function exportScenario() {
    if (!editing) return;
    setExporting(true);
    setError(null);
    try {
      const scene: PlayScene = {
        ...editing.scene,
        meta: { ...editing.scene.meta, updatedAt: new Date().toISOString() },
      };
      // カスタムシステムを使っていれば同梱(プリセットは受け取る側に内蔵)。
      const sys = getCustomSystems().find((x) => x.id === scene.systemId);
      const pack = buildPack({
        id: crypto.randomUUID(),
        name: scene.title.trim() || "無題のシナリオ",
        description: scene.scenario?.synopsis?.trim() || undefined,
        now: new Date().toISOString(),
        system: sys,
        scenarios: [scene],
      });
      const path = await exportPackToFile(pack);
      if (path) toast(`📦 書き出しました: ${path}`);
    } catch (e) {
      setError(`書き出しに失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  /* ===== 一覧 ===== */
  if (!editing) {
    return (
      <div className="page scb">
        <div className="page-wrap">
          <header className="scb-hero">
            <div className="scb-hero-ic">
              <ScrollText size={22} />
            </div>
            <div>
              <h2 className="scb-title">シナリオを作る</h2>
              <p className="scb-sub">
                あらすじ・ハンドアウト・NPC・シーン台本を作成します。盤面や BGM
                まで作り込みたいときは各シナリオの「卓ごと編集」から PLAY
                の卓エディタを開けます。
              </p>
            </div>
            <button className="btn btn-primary scb-new" onClick={newScenario}>
              <Plus size={16} /> 新しいシナリオ
            </button>
          </header>

          {error && (
            <p className="tag fail" style={{ display: "block", margin: "8px 0" }}>
              {error}
            </p>
          )}

          {index.length === 0 ? (
            <EmptyState
              title="まだシナリオがありません"
              hint="「新しいシナリオ」から、あらすじや HO を書いて作り始めましょう。"
              action={{ label: "＋ 新しいシナリオ", onClick: newScenario }}
            />
          ) : (
            <div className="scb-grid">
              {index.map((e) => (
                <div
                  key={e.id}
                  className="scb-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => void openDraft(e)}
                  onKeyDown={(ev) => ev.key === "Enter" && void openDraft(e)}
                  title={e.path}
                >
                  <div className="scb-card-cover">
                    {e.thumbnail ? (
                      <img src={e.thumbnail} alt="" />
                    ) : (
                      <ScrollText size={30} className="scb-card-art" />
                    )}
                    <button
                      className="scb-card-del"
                      title="一覧から外す(ファイルは消えません)"
                      aria-label="一覧から外す"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onRemove(e.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="scb-card-body">
                    <h4 className="scb-card-title">{e.title}</h4>
                    <span className="scb-card-time">
                      <Clock size={12} /> {relTime(e.updatedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ===== 編集(フォーム) ===== */
  const { scene } = editing;
  return (
    <div className="page scb">
      <div className="page-wrap scb-edit">
        <div className="scb-edit-bar">
          <button className="btn mini" onClick={() => setEditing(null)}>
            <ChevronLeft size={15} /> 一覧へ
          </button>
          <input
            className="input scb-edit-title"
            value={scene.title}
            onChange={(e) =>
              patchScene((s) => ({ ...s, title: e.target.value }))
            }
            placeholder="シナリオ名"
          />
          <div className="scb-edit-actions">
            {flash && <span className="scb-flash">{flash}</span>}
            <button
              className="btn"
              onClick={() => void openInTable()}
              disabled={busy}
              title="盤面・コマ・BGM・カットインまで作り込む"
            >
              <LayoutDashboard size={15} /> 卓ごと編集
            </button>
            <button className="btn" onClick={() => void save()} disabled={busy}>
              <Save size={15} /> {busy ? "保存中…" : "保存"}
            </button>
            <button
              className="btn"
              onClick={() => void exportScenario()}
              disabled={busy || exporting}
              title="配布パッケージ(.paradice)として書き出します。仲間はライブラリの「パッケージを取り込む」で遊べます"
            >
              <FileOutput size={15} /> {exporting ? "書き出し中…" : "書き出す"}
            </button>
          </div>
        </div>

        {error && (
          <p className="tag fail" style={{ display: "block", margin: "4px 0 10px" }}>
            {error}
          </p>
        )}

        <ScenarioBuilderPanel
          scenario={scene.scenario}
          onChange={(next: ScenarioInfo) =>
            patchScene((s) => ({ ...s, scenario: next }))
          }
          scenes={scene.scenes}
          onChangeScene={(sceneId: string, p: Partial<SceneInfo>) =>
            patchScene((s) => ({
              ...s,
              scenes: (s.scenes ?? []).map((sc) =>
                sc.id === sceneId ? { ...sc, ...p } : sc,
              ),
            }))
          }
        />

        <div className="scb-edit-foot">
          <Package size={14} />
          盤面の配置・コマ・BGM・カットインは「卓ごと編集」から、配布用の
          パッケージ（.paradice）は「書き出す」から作れます。
        </div>
      </div>
    </div>
  );
}
