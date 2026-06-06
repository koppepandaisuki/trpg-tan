/**
 * ダウンロード済み購入物のローカル台帳(localStorage)。
 *
 * 実ファイルは appLocalData/library/ に保存され、ここではその所在と
 * メタ情報だけを記録する。ライブラリ一覧で「DL済み / 場所を開く」を出し、
 * 将来(スライス4)のアプリ内ビューアが開く対象を引くのに使う。
 */

const KEY = "trpg.desktop.downloaded.v1";

export type DownloadedEntry = {
  productId: string;
  /** 保存した絶対パス(Explorer 表示用)。 */
  path: string;
  /** appLocalData からの相対パス(ビューアでの読込用)。 */
  relativePath: string;
  ext: string;
  bytes: number;
  downloadedAt: string;
};

type Ledger = Record<string, DownloadedEntry>;

function read(): Ledger {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Ledger;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(ledger: Ledger): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ledger));
  } catch {
    // 容量超過などは致命的でないため握り潰す。
  }
}

/** 全 DL 済みエントリ(productId をキーにしたマップ)。 */
export function getDownloadedMap(): Ledger {
  return read();
}

export function getDownloaded(productId: string): DownloadedEntry | null {
  return read()[productId] ?? null;
}

export function markDownloaded(entry: DownloadedEntry): void {
  const ledger = read();
  ledger[entry.productId] = entry;
  write(ledger);
}

export function removeDownloaded(productId: string): void {
  const ledger = read();
  delete ledger[productId];
  write(ledger);
}
