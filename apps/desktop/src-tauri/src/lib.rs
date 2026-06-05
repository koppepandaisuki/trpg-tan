// Tauri v2 アプリのエントリ。今はプラグインなしの最小構成。
// 後で tauri-plugin-fs / tauri-plugin-dialog を足して .ccsheet の保存/読込を
// 実装する。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
