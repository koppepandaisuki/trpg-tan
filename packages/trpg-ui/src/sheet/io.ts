import type { CharacterSheet, GenericSheet, SystemDef } from "@trpg/core";

/** CoC シート(.ccsheet)か汎用シート。保存形式は同じ JSON。 */
export type AnySheet = CharacterSheet | GenericSheet;

/**
 * 保存の結果。
 *   - ref     : 次回「上書き保存」に使う保存先(デスクトップ=ファイルパス / Web=行 id)
 *   - sheetId : 保存先がシートの id を振り直したとき(Web の「別名で保存」= 複製)に返す。
 *               エディタは以後この id で上書きする。
 */
export interface SaveResult {
  ref: string;
  sheetId?: string;
}

/**
 * キャラクターシートの保存・読込(アプリごとに実装して注入する)。
 *
 * エディタ本体(CharacterSheet / GenericSheetEditor)は保存先を知らない。
 * デスクトップはローカルファイル(.ccsheet)、Web はクラウド(character_sheets)
 * に保存するが、同じエディタがどちらでも動くよう、ここだけを差し替える。
 * @trpg/core の RoomTransport と同じ「1 実装・2 アダプタ」の考え方。
 */
export interface SheetIO {
  /** 保存先の種類(ボタンの文言を合わせるため)。 */
  target: "file" | "cloud";
  /**
   * 保存。ref があれば上書き、null なら新規保存(デスクトップは保存先ダイアログ)。
   * ユーザーがキャンセルしたら null。失敗は throw(メッセージはそのまま表示する)。
   */
  save(sheet: AnySheet, ref: string | null): Promise<SaveResult | null>;
  /** 別名で保存(常に新しい保存先)。 */
  saveAs(sheet: AnySheet): Promise<SaveResult | null>;
  /**
   * 既存シートを読み込む(ファイルを開く等)。未対応の環境では undefined にすると
   * 「インポート」ボタン自体を出さない。ref=null は「未保存の新規として開く」。
   */
  load?: () => Promise<{ sheet: AnySheet; ref: string | null } | null>;
  /** 小さな通知(トースト)。無ければエディタ内のメッセージ欄に出す。 */
  notify?: (message: string) => void;
}

/**
 * システム選択・新規作成メニューに渡す「使えるシステム」と外部取り込み。
 * デスクトップはビルダーの自作システム(localStorage)も含み、キャラクター保管所は
 * Tauri の HTTP で取得する。Web はプリセットのみ・保管所はサーバー経由で取得する。
 */
export interface SheetSources {
  /**
   * CoC 以外の選べるシステム(自作 → プリセットの順)。メニューを開くたびに
   * 呼ぶので、ビルダーで追加・削除した自作システムがすぐ反映される。
   */
  getSystems: () => SystemDef[];
  /** キャラクター保管所の URL / ID からシートを取得する。 */
  importVampireBlood: (input: string) => Promise<CharacterSheet>;
}

/** 汎用シート(kind:"generic")か。CoC シートには kind が無い。 */
export function isGenericSheet(sheet: AnySheet): sheet is GenericSheet {
  return "kind" in sheet && sheet.kind === "generic";
}
