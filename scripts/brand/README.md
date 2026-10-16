# ブランド画像の作り直し

配色・文言を変えたときに、OGP・Stripe のプラン画像・インストーラー画像を同じ見た目で描き直す。
描画は Next 同梱の `@vercel/og`(satori + resvg)を使う。配色の規則は decisions.md D-105。

日本語フォントは macOS のヒラギノを使う(リポジトリには入れない)。`.ttc` は satori が読めないので、
1 書体ずつ取り出してから渡す。

```sh
OUT=$(mktemp -d); FONTS=$(mktemp -d)
cd /System/Library/Fonts
python3 "$OLDPWD/scripts/brand/ttc2otf.py" "ヒラギノ角ゴシック W3.ttc" 0 "$FONTS/kaku-w3.otf"
python3 "$OLDPWD/scripts/brand/ttc2otf.py" "ヒラギノ角ゴシック W6.ttc" 0 "$FONTS/kaku-w6.otf"
python3 "$OLDPWD/scripts/brand/ttc2otf.py" "ヒラギノ角ゴシック W8.ttc" 0 "$FONTS/kaku-w8.otf"
python3 "$OLDPWD/scripts/brand/ttc2otf.py" "ヒラギノ明朝 ProN.ttc" 2 "$FONTS/mincho-2.otf"
cd -
node scripts/brand/render-brand.mjs "$PWD" "$OUT" "$FONTS"
python3 scripts/brand/png2bmp.py "$OUT/installer-sidebar.png" "$OUT/sidebar.bmp"
python3 scripts/brand/png2bmp.py "$OUT/installer-header.png" "$OUT/header.bmp"
```

出力と置き場所:

| 出力 | 置き場所 |
|---|---|
| `opengraph-image.png`(1200×630) | `app/opengraph-image.png` と `app/twitter-image.png` |
| `stripe-plan-play.png` / `stripe-plan-pro.png`(1024²) | `branding/`。Stripe ダッシュボードの商品画像に手で上げる |
| `sidebar.bmp` / `header.bmp` | `apps/desktop/src-tauri/installer/`(NSIS。32bit・下から上の BMP) |
| `installer-*.png` | `branding/installer-*-preview.png`(確認用) |

トップページの画面写真(`public/screens/`)は、見本の卓をブラウザで開いて撮ったもの(PC 幅 800×500、スマホ 750×1624)。
