import { useState } from "react";
import {
  Plus,
  ScrollText,
  Save,
  Package,
  ChevronLeft,
  Clock,
  LayoutDashboard,
  Store,
  Loader2,
  X,
  ImagePlus,
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
import { publishPack } from "./pack";
import { getCustomSystems } from "./systems-store";
import { useAuth } from "./useAuth";
import { toast } from "./Toasts";
import { openExternalUrl as openUrl, WEB_BASE } from "./platform";

// WEB_BASE は platform.ts(Tauri=env / ブラウザ=同一オリジン相対)

/**
 * シナリオ作成(ビルダー内「シナリオを作る」)。
 *
 * PLAY(卓を立てて遊ぶ)とは独立した入口。基本はフォームだけで
 * あらすじ/HO/NPC/シーン台本を編集できる(盤面なし)。盤面配置・BGM・
 * カットイン・出品(.paradice)まで作り込みたい人は「卓ごと編集」で
 * 同じデータを PLAY の卓エディタで開ける(シナリオ = 卓 のため)。
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
  const { session } = useAuth();
  const [editing, setEditing] = useState<{
    scene: PlayScene;
    path: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 出品ダイアログ(null = 閉)。cover はアプリ内で選んだ表紙画像。
  const [pub, setPub] = useState<{
    title: string;
    price: number;
    desc: string;
    cover: { url: string; blob: Blob; type: string } | null;
  } | null>(null);
  const [publishing, setPublishing] = useState(false);

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

  function openPublish() {
    if (!editing) return;
    if (!session) {
      setError("出品するにはログインが必要です(右上のアカウントから)。");
      return;
    }
    const s = editing.scene;
    setPub({
      title: s.title || "無題のシナリオ",
      price: 0,
      desc: s.scenario?.synopsis ?? "",
      cover: null,
    });
  }

  async function doPublish() {
    if (!editing || !pub) return;
    setPublishing(true);
    setError(null);
    try {
      const scene: PlayScene = {
        ...editing.scene,
        meta: { ...editing.scene.meta, updatedAt: new Date().toISOString() },
      };
      // カスタムシステムを使っていれば同梱(プリセットは購入者に内蔵)。
      const sys = getCustomSystems().find((x) => x.id === scene.systemId);
      const name = pub.title.trim() || "無題のシナリオ";
      const description = pub.desc.trim() || undefined;
      const pack = buildPack({
        id: crypto.randomUUID(),
        name,
        description,
        now: new Date().toISOString(),
        system: sys,
        scenarios: [scene],
      });
      const r = await publishPack(
        pack,
        {
          title: name,
          priceJpy: Math.max(0, Math.round(pub.price)),
          description,
        },
        pub.cover
          ? { blob: pub.cover.blob, contentType: pub.cover.type }
          : undefined,
      );
      setPub(null);
      toast(
        pub.cover
          ? "🛒 下書きを作成しました。ブラウザで内容を確認して公開してください。"
          : "🛒 下書きを作成しました。ブラウザで表紙を設定して公開してください。",
      );
      // 仕上げ(表紙・価格確認・公開)の web ページを直接開く。
      void openUrl(`${WEB_BASE}/creator/products/${r.productId}/edit`);
    } catch (e) {
      setError(`出品に失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPublishing(false);
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
              title="盤面・コマ・BGM・出品(.paradice)まで作り込む"
            >
              <LayoutDashboard size={15} /> 卓ごと編集
            </button>
            <button className="btn" onClick={() => void save()} disabled={busy}>
              <Save size={15} /> {busy ? "保存中…" : "保存"}
            </button>
            <button
              className="btn btn-primary"
              onClick={openPublish}
              disabled={busy || publishing}
              title="このシナリオをストアに出品(下書き作成→ブラウザで表紙設定→公開)"
            >
              <Store size={15} /> 出品する
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
          盤面の配置・コマ・BGM・カットイン・出品（.paradice
          書き出し）は「卓ごと編集」から行えます。
        </div>
      </div>

      {pub && (
        <div className="scb-pub-overlay" onClick={() => setPub(null)}>
          <div className="scb-pub" onClick={(e) => e.stopPropagation()}>
            <div className="scb-pub-head">
              <strong>
                <Store size={16} /> ストアに出品
              </strong>
              <button
                className="scb-pub-x"
                onClick={() => setPub(null)}
                aria-label="閉じる"
              >
                <X size={16} />
              </button>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              下書きを作成してアップロードします。このあとブラウザで
              <b>表紙の設定</b>と<b>公開</b>を行います（有料は Stripe
              連携が必要）。
            </p>
            <label className="scb-pub-field">
              <span>タイトル</span>
              <input
                className="input"
                value={pub.title}
                onChange={(e) => setPub({ ...pub, title: e.target.value })}
                placeholder="作品名"
              />
            </label>
            <div className="scb-pub-field">
              <span>表紙画像（任意・PNG / JPG / WebP）</span>
              <div className="scb-pub-cover">
                {pub.cover ? (
                  <>
                    <img
                      src={pub.cover.url}
                      alt=""
                      className="scb-pub-cover-img"
                    />
                    <button
                      className="btn mini"
                      onClick={() => setPub({ ...pub, cover: null })}
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
                          setPub((p) =>
                            p
                              ? {
                                  ...p,
                                  cover: {
                                    url: URL.createObjectURL(f),
                                    blob: f,
                                    type: f.type,
                                  },
                                }
                              : p,
                          );
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
                value={pub.price}
                onChange={(e) =>
                  setPub({ ...pub, price: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="scb-pub-field">
              <span>説明（任意）</span>
              <textarea
                className="input"
                rows={3}
                value={pub.desc}
                onChange={(e) => setPub({ ...pub, desc: e.target.value })}
                placeholder="どんなシナリオか。あらすじや遊び方など"
              />
            </label>
            <div className="scb-pub-actions">
              <button className="btn" onClick={() => setPub(null)}>
                キャンセル
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void doPublish()}
                disabled={publishing}
              >
                {publishing ? (
                  <>
                    <Loader2 size={15} className="spin" /> 出品中…
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
      )}
    </div>
  );
}
