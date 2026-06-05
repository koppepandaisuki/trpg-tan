# TRPG Desktop(Tauri + Vite + React)

TRPG デスクトップアプリ。**キャラシ / ビルド / PLAY** を担う本体(Phase 1 は
キャラシ MVP)。共有コア `@trpg/core` を参照する。

## 前提(初回のみ)

- Rust(`rustup`)+ Windows は MSVC ビルドツール(C++ build tools)
- WebView2 ランタイム(Win11 標準 / Win10 等は別途)

## 開発

```bash
# リポジトリルートで(pnpm ワークスペース)
pnpm install

# デスクトップアプリを起動(ネイティブ窓が開く。初回は Rust 依存の
# コンパイルで数分かかる)
pnpm --filter desktop tauri dev

# フロントだけブラウザで確認(Rust 不要、UI 開発の高速ループ)
pnpm --filter desktop dev   # → http://localhost:5173
```

## ビルド(配布物)

```bash
pnpm --filter desktop tauri build
```

## 構成

```
apps/desktop/
├ index.html / src/        Vite + React フロント(UI)
│   └ App.tsx              @trpg/core を呼ぶ動作確認画面(キャラシの種)
└ src-tauri/               Tauri(Rust)シェル
    ├ Cargo.toml / src/    最小エントリ(プラグインなし)
    ├ tauri.conf.json      ウィンドウ / バンドル設定
    ├ capabilities/        権限(今は core のみ)
    └ icons/               app/icon.png から `tauri icon` で生成
```

## 次の実装

- `tauri-plugin-fs` / `tauri-plugin-dialog` を足して `.ccsheet`(JSON)の
  保存 / 読込。
- キャラシ画面(いあきゃら参照: 6/7版・能力値生成・技能割り振り・ロール)。
- アイコンの再生成: `pnpm --filter desktop tauri icon ../../app/icon.png`。
