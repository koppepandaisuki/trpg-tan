import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * 自動更新(起動時チェック)。
 *
 * インストール版アプリで起動時に GitHub Releases の latest.json を見て、
 * 新しいバージョンがあれば確認 → ダウンロード&インストール → 再起動する。
 *
 * - check() は tauri.conf.json の plugins.updater.endpoints を参照する。
 * - 署名検証は pubkey(同 conf に埋め込み)で行われる(改竄防止)。
 * - オフラインや未署名・サーバー不在などの失敗は致命的でないので握りつぶす
 *   (起動を妨げない)。
 * - dev では呼ばない(main.tsx 側で PROD ガード)。
 */
export async function checkForUpdatesOnLaunch(): Promise<void> {
  try {
    // check() はネットワーク待ちで無限に止まりうる(updater サーバ不在/
    // 名前解決失敗など)。起動本体は別のところで動いているが、
    // 保険として 10 秒で諦める(失敗扱いになり下の catch でログのみ)。
    const update = await Promise.race([
      check(),
      new Promise<null>((_, rej) =>
        setTimeout(() => rej(new Error("updater check timeout")), 10000),
      ),
    ]);
    if (!update) return; // 最新

    const note = update.body ? `\n\n${update.body}` : "";
    const ok = window.confirm(
      `新しいバージョン ${update.version} があります。今すぐ更新しますか？${note}`,
    );
    if (!ok) return;

    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    // 更新チェックの失敗で起動を止めない(ログのみ)。
    console.warn("[updater] check/update failed", e);
  }
}
