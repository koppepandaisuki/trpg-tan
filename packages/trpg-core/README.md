# @trpg/core

TRPG 共有コア。**Web(マーケット)とデスクトップアプリ(キャラシ/ビルド/PLAY)の双方から参照する、ランタイム依存ゼロの純 TypeScript パッケージ**。

## 構成

```
src/
├ dice/        ダイス記法評価 + CoC 判定(rng 注入でテスト可能)
│   ├ random.ts      RandomFn 抽象 + rollDie
│   ├ notation.ts    "2d6+1d4-1" 等の解析・実行
│   └ coc-check.ts   1D100 判定(6/7版の成功度・ファンブル)
├ systems/     システム定義(定義駆動)
│   ├ types.ts       SystemDefinition スキーマ
│   └ coc/           coc7.ts / coc6.ts(骨組み: 代表技能・職業のみ)
└ character/   .ccsheet 永続化スキーマ
    └ types.ts       CharacterSheet(1キャラ=1 JSON ファイルの中身)
```

## 設計方針

- **環境非依存**: `crypto` / `Date` / ファイル I/O を内部で呼ばない。ID や日時、
  乱数は呼び出し側から注入する(`RandomFn`、`createEmptySheet({ id, now })`)。
  これにより Web / Tauri / テストのどこでも同じコードが動く。
- **定義駆動**: シートは `SystemDefinition`(データ)から描画する。別システム
  対応は新しい定義を足すだけ。CoC は 6/7 版を別定義で両対応。
- **著作権配慮**: 数値ルール(技能ポイント式・能力値レンジ・信用点数)は
  ゲームの仕組み=保護外のため転記。職業の**説明文は自作**し、ルールブックの
  文章は転記しない。

## 未完(後続タスク)

- `systems/coc/*` の技能・職業は**代表例のみ**。完全版データは別途作成。
- 派生値(HP/MP/SAN/DB 等)の `compute` 関数は未実装(`formula` は意図の記述)。
- 能力値生成(ダイス→能力値)のヘルパー。

## 使い方

```ts
import { rollNotation, resolveCoCCheck, getSystem } from "@trpg/core";

rollNotation("3d6+2");              // { rolls, total, ... }
resolveCoCCheck(12, 60, "7").level; // "extreme"
getSystem("coc7")?.characteristics; // CoC7 の能力値定義
```

## テスト

```
pnpm --filter @trpg/core test
```
