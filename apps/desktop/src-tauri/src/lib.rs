// Tauri v2 アプリのエントリ。
//
// プラグイン:
//   - single-instance: 2重起動を防ぎ、deep-link URL を既存ウィンドウへ転送
//   - dialog / fs:    .ccsheet の保存/読込 + 購入物のローカル保存(バイナリ)
//   - deep-link:      paradice://auth/callback を受けて OAuth セッション交換
//   - opener:         外部ブラウザ起動 / DL 済みファイルを Explorer で表示
//   - http:           DL API 呼び出し + 署名URLからのファイル取得(CORS 回避)
//
// single-instance を deep-link より先に登録することで、OS が paradice:// を
// 受け取ったとき「新しいプロセスを起動→即 argv を既存プロセスへ転送→終了」
// という流れになり、二重ウィンドウを防ぐ。
//
// 重要(Tauri v2 の仕様): スキームを *実行時* に登録(dev の register_all)した
// 場合、single-instance が転送した argv に対して deep-link の on_open_url が
// 自動発火しない。そのため single-instance ハンドラ内で argv から URL を拾い、
// 自前のイベント "deep-link-url" でフロントへ通知する。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            use tauri::Emitter;
            // 既存インスタンスへ転送された argv の中から paradice:// URL を探す。
            for arg in &argv {
                if arg.starts_with("paradice://") {
                    let _ = app.emit("deep-link-url", arg.clone());
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // 自動更新(デスクトップのみ)。実行時に updater プラグインを差し込む。
            // 失敗(オフライン等)は致命的でないので無視。実際の更新チェックは
            // フロント(updater.ts)が起動時に行う。
            #[cfg(desktop)]
            {
                let _ = app
                    .handle()
                    .plugin(tauri_plugin_updater::Builder::new().build());
            }
            // 開発時(Windows/Linux)は scheme をランタイム登録しないと
            // deep-link が届かない。インストール版は bundler が登録する。
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
