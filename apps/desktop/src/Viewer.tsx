import { useEffect, useMemo, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { unzipSync, strFromU8 } from "fflate";
import type { DownloadedEntry } from "./downloaded";
import type { RemoteLibraryItem } from "./library-remote";

/**
 * アプリ内ビューア。ダウンロード済みの購入物(appLocalData/library/…)を
 * 読み込み、種別に応じて表示する。
 *
 *  - pdf            : iframe(WebView2 内蔵 PDF ビューア)
 *  - 画像           : <img>
 *  - 音声           : <audio controls>
 *  - zip            : fflate で展開し、左に一覧・右にプレビュー
 *  - その他/不明     : 「外部アプリで開く」のみ
 *
 * ファイルは fs.readFile で取得し Blob URL 化(Rust 設定不要)。どの種別でも
 * ヘッダの「外部で開く」で OS 既定アプリにフォールバックできる。
 */

type Kind = "pdf" | "image" | "audio" | "video" | "text" | "zip" | "unknown";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];
const AUDIO_EXT = ["mp3", "wav", "ogg", "m4a", "flac", "aac", "opus"];
const VIDEO_EXT = ["mp4", "webm", "mov", "m4v"];
const TEXT_EXT = ["txt", "md", "json", "csv", "html", "xml", "yml", "yaml"];

function kindOf(ext: string): Kind {
  const e = ext.toLowerCase();
  if (e === "pdf") return "pdf";
  if (IMAGE_EXT.includes(e)) return "image";
  if (AUDIO_EXT.includes(e)) return "audio";
  if (VIDEO_EXT.includes(e)) return "video";
  if (TEXT_EXT.includes(e)) return "text";
  if (e === "zip") return "zip";
  return "unknown";
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
  opus: "audio/opus",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  txt: "text/plain",
  md: "text/plain",
  json: "application/json",
  csv: "text/csv",
  html: "text/html",
  xml: "application/xml",
  yml: "text/plain",
  yaml: "text/plain",
};

function mimeOf(ext: string): string {
  return MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Uint8Array → Blob。TS 5.7+ では Uint8Array が ArrayBufferLike で総称化され
 * BlobPart に直接代入できないため、ここでキャストして吸収する(実体は同じ)。
 */
function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as BlobPart], { type });
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function Viewer({
  item,
  entry,
  onClose,
}: {
  item: RemoteLibraryItem;
  entry: DownloadedEntry;
  onClose: () => void;
}) {
  const kind = kindOf(entry.ext);

  return (
    <div className="viewer-overlay" role="dialog" aria-modal="true">
      <header className="viewer-head">
        <div className="viewer-title">
          <strong>{item.title}</strong>
          <span className="muted viewer-sub">
            {entry.ext.toUpperCase()} ・ {(entry.bytes / 1024).toFixed(0)} KB
          </span>
        </div>
        <div className="viewer-actions">
          <button
            className="btn mini"
            onClick={() => void openPath(entry.path)}
            title="OS 既定のアプリで開く"
          >
            外部で開く
          </button>
          <button
            className="btn mini"
            onClick={() => void revealItemInDir(entry.path)}
          >
            場所を開く
          </button>
          <button className="btn mini btn-primary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </header>

      <div className="viewer-body">
        {kind === "zip" ? (
          <ZipBrowser entry={entry} />
        ) : (
          <SingleFile entry={entry} kind={kind} />
        )}
      </div>
    </div>
  );
}

/** 単一ファイル(pdf / 画像 / 音声 / 動画 / テキスト)の表示。 */
function SingleFile({ entry, kind }: { entry: DownloadedEntry; kind: Kind }) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let active = true;
    (async () => {
      try {
        // 絶対パスで読む。relativePath はライブラリ root 起点なので
        // baseDir:AppLocalData だと "library" 階層が抜けて指定パスが見つからない。
        const bytes = await readFile(entry.path);
        if (!active) return;
        if (kind === "text") {
          setText(strFromU8(bytes));
          return;
        }
        const objUrl = URL.createObjectURL(bytesToBlob(bytes, mimeOf(entry.ext)));
        revoke = objUrl;
        setUrl(objUrl);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      active = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [entry.path, entry.ext, kind]);

  if (error) return <p className="tag fail viewer-msg">{error}</p>;

  if (kind === "text") {
    return text === null ? (
      <p className="muted viewer-msg">読み込み中…</p>
    ) : (
      <pre className="viewer-text">{text}</pre>
    );
  }

  if (kind === "unknown") {
    return (
      <p className="muted viewer-msg">
        この形式はアプリ内で表示できません。「外部で開く」をご利用ください。
      </p>
    );
  }

  if (!url) return <p className="muted viewer-msg">読み込み中…</p>;

  if (kind === "pdf")
    return <iframe className="viewer-frame" src={url} title="PDF" />;
  if (kind === "image")
    return (
      <div className="viewer-center">
        <img className="viewer-img" src={url} alt="" />
      </div>
    );
  if (kind === "audio")
    return (
      <div className="viewer-center">
        <audio className="viewer-audio" src={url} controls autoPlay={false} />
      </div>
    );
  if (kind === "video")
    return (
      <div className="viewer-center">
        <video className="viewer-video" src={url} controls />
      </div>
    );
  return null;
}

type ZipEntry = { name: string; bytes: Uint8Array };

/** zip を展開し、左に一覧・右にプレビュー。 */
function ZipBrowser({ entry }: { entry: DownloadedEntry }) {
  const [entries, setEntries] = useState<ZipEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // 絶対パスで読む(relativePath + baseDir:AppLocalData だと library 階層が抜ける)。
        const bytes = await readFile(entry.path);
        const files = unzipSync(bytes);
        const list: ZipEntry[] = Object.entries(files)
          // ディレクトリエントリ(末尾 /)と __MACOSX を除外。
          .filter(([name]) => !name.endsWith("/") && !name.startsWith("__MACOSX"))
          .map(([name, data]) => ({ name, bytes: data }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!active) return;
        setEntries(list);
        // 最初の表示可能ファイルを自動選択。
        const first =
          list.find((f) => kindOf(extOf(f.name)) !== "unknown") ?? list[0];
        setSelected(first?.name ?? null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [entry.path]);

  const current = useMemo(
    () => entries?.find((f) => f.name === selected) ?? null,
    [entries, selected],
  );

  if (error) return <p className="tag fail viewer-msg">{error}</p>;
  if (!entries) return <p className="muted viewer-msg">展開中…</p>;
  if (entries.length === 0)
    return <p className="muted viewer-msg">空の ZIP です。</p>;

  return (
    <div className="zip-layout">
      <ul className="zip-list">
        {entries.map((f) => (
          <li
            key={f.name}
            className={`zip-item ${selected === f.name ? "active" : ""}`}
            onClick={() => setSelected(f.name)}
            title={f.name}
          >
            <span className="zip-name">{f.name}</span>
            <span className="zip-size">{(f.bytes.length / 1024).toFixed(0)}KB</span>
          </li>
        ))}
      </ul>
      <div className="zip-preview">
        {current ? <ZipEntryPreview entry={current} /> : null}
      </div>
    </div>
  );
}

/** zip 内 1 エントリのプレビュー(画像 / 音声 / テキスト / pdf)。 */
function ZipEntryPreview({ entry }: { entry: ZipEntry }) {
  const ext = extOf(entry.name);
  const kind = kindOf(ext);
  const [url, setUrl] = useState<string | null>(null);

  const text = useMemo(
    () => (kind === "text" ? strFromU8(entry.bytes) : null),
    [entry, kind],
  );

  useEffect(() => {
    if (kind === "text" || kind === "unknown") {
      setUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(bytesToBlob(entry.bytes, mimeOf(ext)));
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [entry, ext, kind]);

  if (kind === "text")
    return <pre className="viewer-text">{text}</pre>;
  if (kind === "unknown")
    return (
      <p className="muted viewer-msg">
        この形式({ext || "不明"})はプレビューできません。
      </p>
    );
  if (!url) return <p className="muted viewer-msg">…</p>;
  if (kind === "pdf")
    return <iframe className="viewer-frame" src={url} title={entry.name} />;
  if (kind === "image")
    return (
      <div className="viewer-center">
        <img className="viewer-img" src={url} alt={entry.name} />
      </div>
    );
  if (kind === "audio")
    return (
      <div className="viewer-center">
        <audio className="viewer-audio" src={url} controls />
      </div>
    );
  if (kind === "video")
    return (
      <div className="viewer-center">
        <video className="viewer-video" src={url} controls />
      </div>
    );
  return null;
}
