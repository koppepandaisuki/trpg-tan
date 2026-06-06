// Tauri v2 アプリのエントリ。
//
// プラグイン:
//   - dialog / fs: .ccsheet の保存/読込(保存先選択 + テキスト読み書き)
//   - deep-link:  paradice://auth/callback を受けて OAuth セッション交換
//   - opener:     外部ブラウザで Supabase ログインURLを開く
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
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
