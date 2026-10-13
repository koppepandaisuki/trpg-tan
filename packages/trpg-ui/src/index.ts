/**
 * @trpg/ui — デスクトップ(Vite)と Web(Next.js)で共有する UI。
 *
 * いまはキャラクターシートのエディタ一式。保存・読込(SheetIO)と
 * 使えるシステム / 外部取り込み(SheetSources)だけをアプリ側が注入する。
 * スタイルは `@trpg/ui/sheet.css`(コンポーネント固有)を両アプリで読み込む。
 */
export { CharacterSheet } from "./sheet/CharacterSheet";
export { GenericSheetEditor } from "./sheet/GenericSheetEditor";
export { SheetSystemPicker } from "./sheet/SheetSystemPicker";
export { NewCharacterMenu } from "./sheet/NewCharacterMenu";
export { NumStepper } from "./sheet/NumStepper";
export { InfoTip } from "./sheet/InfoTip";
export { OccupationIcon } from "./sheet/OccupationIcon";
export { SystemIcon, SYSTEM_VISUALS, type SystemVisual } from "./sheet/system-visuals";
export {
  isGenericSheet,
  type AnySheet,
  type SaveResult,
  type SheetIO,
  type SheetSources,
} from "./sheet/io";
