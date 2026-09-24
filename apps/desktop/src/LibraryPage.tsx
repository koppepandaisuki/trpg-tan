import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileInput,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  Music,
  Pause,
  Pencil,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import { importPackFromFile } from "./pack";
import type { PlayIndexEntry } from "./play-storage";
import { useAuth } from "./useAuth";
import { isTauri } from "./storage";
import { toast } from "./Toasts";
import { EmptyState } from "./EmptyState";
import { SavedTables } from "./SavedTables";
import {
  listMyAssets,
  removeAsset,
  renameAsset,
  uploadAsset,
  type AssetKind,
  type PlayAsset,
} from "./assets-remote";

type Tab = "tables" | "assets";
type Filter = "all" | AssetKind;

/**
 * ライブラリ = 自分の卓 + 素材(画像・音声)の保管庫。
 *
 * 2026-09 のストア廃止までは「購入した作品」の一覧(Steam 風)だったが、
 * 作品売買をやめたので「自分のゲームを保存しておく場所」に再定義した。
 *   - 卓   : ローカルの .play 索引(PLAY ロビーと同じデータ)。.paradice の
 *            取り込みと、.play ファイルを直接開く入口もここに置く。
 *   - 素材 : クラウドの play_assets(Web 版ライブラリと共有。要ログイン)。
 */
export function LibraryPage({
  tables,
  onOpenTable,
  onRemoveTable,
  onOpenTableFile,
  onPackImported,
  systemLabelOf,
}: {
  tables: PlayIndexEntry[];
  onOpenTable: (e: PlayIndexEntry) => void;
  onRemoveTable: (id: string) => void;
  /** .play ファイルを選んで開く。 */
  onOpenTableFile: () => void;
  /** .paradice を取り込んだあと(卓索引の再読込 + 取り込んだ卓を開く)。 */
  onPackImported: (firstPlayPath: string | null) => void;
  systemLabelOf: (systemId: string) => string;
}) {
  const [tab, setTab] = useState<Tab>("tables");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importPack() {
    if (!isTauri()) {
      setError("パッケージの取り込みにはデスクトップアプリが必要です");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const r = await importPackFromFile();
      if (!r) return; // キャンセル
      const parts = [
        r.system ? "システム" : null,
        r.scenarios > 0 ? `卓 ${r.scenarios}` : null,
        r.sheets > 0 ? `キャラ ${r.sheets}` : null,
      ].filter(Boolean);
      toast(`📦 「${r.name}」を取り込みました（${parts.join(" / ") || "内容なし"}）`);
      onPackImported(r.scenes[0]?.path ?? null);
    } catch (e) {
      setError(`取り込めませんでした: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-wrap">
        <header className="lobby-hero">
          <h2 className="lobby-title">
            ライブラリ
            <span className="lobby-title-en">LIBRARY</span>
          </h2>
          <p className="lobby-sub">自分の卓と、卓で使う素材をまとめて保管します</p>
        </header>

        <div className="tabs" role="tablist" style={{ maxWidth: 360 }}>
          <button
            role="tab"
            aria-selected={tab === "tables"}
            className={`tab ${tab === "tables" ? "active" : ""}`}
            onClick={() => setTab("tables")}
          >
            卓（{tables.length}）
          </button>
          <button
            role="tab"
            aria-selected={tab === "assets"}
            className={`tab ${tab === "assets" ? "active" : ""}`}
            onClick={() => setTab("assets")}
          >
            素材
          </button>
        </div>

        {error && (
          <p className="tag fail" style={{ display: "block", marginBottom: 10 }}>
            {error}
          </p>
        )}

        {tab === "tables" ? (
          <section className="lobby-saved">
            <div className="lobby-saved-head">
              <div className="lib-toolbar">
                <button className="btn mini" onClick={onOpenTableFile}>
                  <FolderOpen size={14} /> 卓ファイルを開く
                </button>
                <button
                  className="btn mini"
                  onClick={() => void importPack()}
                  disabled={importing}
                  title=".paradice(配布パッケージ)からシステム・卓・キャラを取り込みます"
                >
                  {importing ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <FileInput size={14} />
                  )}{" "}
                  パッケージを取り込む
                </button>
              </div>
              <div className="lobby-viewtoggle">
                <button
                  className={`lobby-vbtn ${view === "grid" ? "on" : ""}`}
                  onClick={() => setView("grid")}
                  title="グリッド表示"
                  aria-pressed={view === "grid"}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  className={`lobby-vbtn ${view === "list" ? "on" : ""}`}
                  onClick={() => setView("list")}
                  title="リスト表示"
                  aria-pressed={view === "list"}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
            {tables.length === 0 ? (
              <EmptyState
                title="まだ卓がありません"
                hint="PLAY で卓を作って保存すると、ここに並びます。"
              />
            ) : (
              <SavedTables
                entries={tables}
                view={view}
                onOpen={onOpenTable}
                onRemove={onRemoveTable}
                systemLabelOf={systemLabelOf}
              />
            )}
          </section>
        ) : (
          <AssetsPanel />
        )}
      </div>
    </div>
  );
}

/* ===================================================================== */

function AssetsPanel() {
  const { session, ready } = useAuth();
  const user = session?.user ?? null;
  const [assets, setAssets] = useState<PlayAsset[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      setAssets(await listMyAssets());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAssets([]);
    }
  }, []);

  const uid = user?.id ?? null;
  useEffect(() => {
    if (uid) void reload();
    else setAssets(null);
  }, [uid, reload]);

  // 画面を離れたら試聴を止める。
  useEffect(() => () => audioRef.current?.pause(), []);

  if (!ready) return null;
  if (!user) {
    return (
      <EmptyState
        title="ログインすると素材を保管できます"
        hint="背景・駒・BGM などをクラウドに保管して、Web 版とアプリの両方の卓で使えます。右上のアカウントからログインしてください。"
      />
    );
  }

  async function upload(files: FileList) {
    setError(null);
    const list = Array.from(files);
    try {
      for (const [i, f] of list.entries()) {
        setBusy(list.length > 1 ? `アップロード中 ${i + 1}/${list.length}` : "アップロード中");
        await uploadAsset(f);
      }
      await reload();
      toast(`🗂 素材を ${list.length} 件追加しました`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function rename(a: PlayAsset) {
    const name = window.prompt("素材の名前", a.name);
    if (name === null || name.trim() === a.name) return;
    try {
      await renameAsset(a.id, name);
      setAssets((l) => l?.map((x) => (x.id === a.id ? { ...x, name: name.trim() } : x)) ?? l);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(a: PlayAsset) {
    if (
      !window.confirm(
        `「${a.name}」をライブラリから外しますか？\n（すでに卓で使っている画像・音はそのまま残ります）`,
      )
    )
      return;
    try {
      await removeAsset(a.id);
      setAssets((l) => l?.filter((x) => x.id !== a.id) ?? l);
      if (playingId === a.id) stop();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function toggle(a: PlayAsset) {
    if (playingId === a.id) {
      stop();
      return;
    }
    audioRef.current?.pause();
    const el = new Audio(a.url);
    el.volume = 0.5;
    el.onended = () => setPlayingId(null);
    void el.play().catch(() => setPlayingId(null));
    audioRef.current = el;
    setPlayingId(a.id);
  }
  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }

  const all = assets ?? [];
  const shown = filter === "all" ? all : all.filter((a) => a.kind === filter);
  const count = (k: AssetKind) => all.filter((a) => a.kind === k).length;

  return (
    <section>
      <div className="lib-toolbar" style={{ marginBottom: 12 }}>
        <div className="asset-filter" role="group" aria-label="種類で絞り込み">
          {(
            [
              ["all", `すべて（${all.length}）`],
              ["image", `画像（${count("image")}）`],
              ["audio", `音声（${count("audio")}）`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={filter === k ? "on" : ""}
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary mini"
          style={{ marginLeft: "auto" }}
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
        >
          {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}{" "}
          {busy ?? "素材を追加"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,audio/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) void upload(files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="tag fail" style={{ display: "block", marginBottom: 10 }}>
          {error}
        </p>
      )}

      {assets === null ? (
        <p className="lobby-sub">
          <Loader2 size={14} className="spin" /> 読み込み中…
        </p>
      ) : shown.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? "まだ素材がありません" : "この種類の素材はまだありません"}
          hint="背景・駒・BGM などを追加しておくと、卓でいつでも使えます。Web 版で追加した素材もここに並びます。"
          action={{ label: "＋ 素材を追加", onClick: () => inputRef.current?.click() }}
        />
      ) : (
        <div className="asset-grid">
          {shown.map((a) => (
            <div className="asset-card" key={a.id}>
              {a.kind === "image" ? (
                <div className="asset-thumb">
                  <img src={a.url} alt={a.name} loading="lazy" draggable={false} />
                </div>
              ) : (
                <button
                  className="asset-thumb audio"
                  onClick={() => toggle(a)}
                  aria-label={playingId === a.id ? `「${a.name}」の試聴を止める` : `「${a.name}」を試聴`}
                >
                  <Music size={26} />
                  <span className="asset-play">
                    {playingId === a.id ? <Pause size={14} /> : <Play size={14} />}
                  </span>
                </button>
              )}
              <div className="asset-meta">
                <span className="asset-name" title={a.name}>
                  {a.kind === "image" ? <ImageIcon size={12} /> : <Music size={12} />} {a.name}
                </span>
                <span className="asset-size">{formatSize(a.sizeBytes)}</span>
              </div>
              <div className="asset-actions">
                <button title="名前を変える" aria-label="名前を変える" onClick={() => void rename(a)}>
                  <Pencil size={13} />
                </button>
                <button
                  className="danger"
                  title="ライブラリから外す"
                  aria-label="ライブラリから外す"
                  onClick={() => void remove(a)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
