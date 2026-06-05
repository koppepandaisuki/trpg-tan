/**
 * @trpg/core — TRPG 共有コア。
 *
 * Web(マーケット)とデスクトップアプリ(キャラシ/ビルド/PLAY)の双方から
 * 参照する、ランタイム依存ゼロの純 TypeScript パッケージ。
 *
 *   - dice:    ダイス記法評価 + CoC 判定
 *   - systems: システム定義(CoC6/7)
 *   - character: `.ccsheet` 永続化スキーマ
 */
export * from "./dice/index.js";
export * from "./systems/index.js";
export * from "./character/types.js";
