import type { CoCEdition, CoCCheckResult } from "../dice/coc-check.js";
import type { CompareOp } from "../dice/command.js";

/**
 * PLAY(セッション卓)の永続化スキーマと、イベントソーシングの型。
 *
 * 設計:
 *   - 卓の状態 = 「パネル(キャラ駒)の集合」＋「イベント列(ログ)」。
 *   - 状態は reduce(scene, event) で前進する純粋な遷移。ダイスの乱数は
 *     *イベント生成時*(権威=GM)に消費され、結果はイベントに刻まれる。
 *     これにより reducer は決定論的で、後からネットワークに乗せても
 *     全員が同じログから同じ状態を再構成できる。
 *   - これを JSON 直列化したものが `.play` ファイル(1 セッション=1 ファイル)。
 */

export const PLAY_SCHEMA_VERSION = 1 as const;

/** パネル上で「クリックして判定」できる項目(能力値/技能/派生値)。 */
export interface PanelStat {
  key: string; // "STR" / "spot_hidden"
  label: string; // "筋力" / "目星"
  /** 素の値(能力値 or 技能%)。表示用。 */
  value: number;
  /** 1D100 ≤ target で判定する目標値(版差は取り込み時に解決済み)。 */
  target: number;
  kind: "characteristic" | "skill" | "derived";
}

/** HP/SAN/MP 等、卓で増減する可変リソース。 */
export interface PanelResource {
  key: string; // "hp" / "san" / "mp" / 任意
  label: string; // "HP"
  current: number;
  max: number;
}

export type PanelSource = "sheet" | "token";

/** 卓上のキャラ駒。.ccsheet 由来(snapshot)か自由トークン。 */
export interface Panel {
  id: string;
  source: PanelSource;
  name: string;
  portrait?: string | null;
  color: string;
  /** sheet 由来のとき: 元システム / 版 / 元シート id。 */
  systemId?: string;
  edition?: CoCEdition;
  sheetId?: string;
  stats: PanelStat[];
  resources: PanelResource[];
  /** 盤面上の位置(0..1 正規化。盤面サイズに依らず保存できる)。未配置は undefined。 */
  pos?: { x: number; y: number };
  /** 盤面上の表示サイズ(px)。円形駒は直径、画像オブジェクトは幅。未指定は既定。 */
  size?: number;
  /** 情報/メモ(右クリックメニューで編集)。 */
  note?: string;
  /** プレイヤーに秘匿するか(GM 視点では薄く表示。将来の同期で非送信)。 */
  hidden?: boolean;
  /**
   * チャットパレット(1 行 1 コマンド)。クリックでこの駒として送信する。
   * 例: "1d100<=70 目星" / "1d6+1 ダメージ" / "# 攻撃" / "「やあ」"。
   */
  palette?: string;
  /** 速さ(行動順)。シート由来は DEX で初期化。大きいほど先に並ぶ。 */
  speed?: number;
  /** 帰属シーン。未設定 = 全シーン共通(次シーンへ引き継ぐ)。 */
  sceneId?: string | null;
  /** 盤面上の重なり順(大きいほど前面)。未設定は 0。 */
  layer?: number;
}

/** 盤面(背景マップ + グリッド)。 */
export interface PlayBoard {
  /** 背景画像(data URL)。未設定なら無地。 */
  image: string | null;
  /** グリッド表示の on/off。 */
  grid: boolean;
}

/** BGM トラック(ローカル音声ファイルへの参照)。実体は埋め込まずパスだけ持つ。 */
export interface BgmTrack {
  id: string;
  name: string;
  /** ローカル音声ファイルの絶対パス。再生時に読み込んで鳴らす。 */
  path: string;
}

/** BGM(GM ローカル再生のプレイリスト)。音声は配信しない設計。 */
export interface PlayBgm {
  tracks: BgmTrack[];
}

/** シーン。盤面(背景+グリッド)を切り替える単位。キャラ/ログ/BGM は卓で共有。 */
export interface SceneInfo {
  id: string;
  name: string;
  board: PlayBoard;
}

/** カットイン(演出用の画像。クリックで画面に流す)。 */
export interface CutIn {
  id: string;
  name: string;
  /** data URL。 */
  image: string;
}

/** セッション卓(シーン)の全状態。 */
export interface PlayScene {
  schemaVersion: typeof PLAY_SCHEMA_VERSION;
  id: string;
  title: string;
  /** 卓の既定システム(coc7/coc6/"")。フリーダイスや判定の版解決に使う。 */
  systemId: string;
  panels: Panel[];
  /** 盤面。古い .play には無い場合があるので optional。 */
  board?: PlayBoard;
  /** BGM プレイリスト(GM ローカル)。古い .play には無い場合があるので optional。 */
  bgm?: PlayBgm;
  /** シーン一覧。board は active シーンの盤面を映す(scenes が真。古い .play は optional)。 */
  scenes?: SceneInfo[];
  activeSceneId?: string;
  /** シナリオテキストストック(1 行 1 テキスト。# 行は見出し)。GM の定型文置き場。 */
  textStock?: string;
  /** カットイン画像(演出)。 */
  cutins?: CutIn[];
  log: PlayEvent[];
  meta: { createdAt: string; updatedAt: string };
}

/* ===== イベント(判別共用体) ===== */

interface BaseEvent {
  id: string;
  ts: string; // ISO
  /** 行為者の表示名(パネル名 or "GM")。 */
  actor: string;
}

/** 発言。 */
export interface ChatEvent extends BaseEvent {
  kind: "chat";
  text: string;
}

/** ダイス(技能/能力判定 or フリーダイス)。結果は生成時に確定済み。 */
export interface RollEvent extends BaseEvent {
  kind: "roll";
  /** 表示ラベル("目星 判定" / "2d6+1")。 */
  label: string;
  /** フリーダイスの記法(技能判定のときは未設定)。 */
  notation?: string;
  /** 各ダイスの出目。 */
  dice: number[];
  /** 合計(符号・定数込み)。判定のときは出目そのもの。 */
  total: number;
  /** CoC 判定だった場合の成功度など。 */
  check?: CoCCheckResult;
  /** 比較付きロール(2d6>=8 等)の成否。 */
  success?: boolean;
  /** 比較付きロールの比較条件(表示用)。 */
  compare?: { op: CompareOp; target: number };
  /** シークレットダイス(他プレイヤーには出目を伏せる)。 */
  secret?: boolean;
  /** 秘匿時に出目を見せる相手(パネル id / 将来のプレイヤー id)。空=GMのみ。 */
  visibleTo?: string[];
}

/** リソース(HP/SAN/MP…)の増減。 */
export interface ResourceEvent extends BaseEvent {
  kind: "resource";
  panelId: string;
  resourceKey: string;
  label: string; // "HP"
  delta: number; // 適用した増減
  current: number; // 適用後の現在値
}

/** パネルの追加。 */
export interface PanelAddEvent extends BaseEvent {
  kind: "panel-add";
  panel: Panel;
}

/** パネルの削除。 */
export interface PanelRemoveEvent extends BaseEvent {
  kind: "panel-remove";
  panelId: string;
}

/** システムメッセージ(参加/退出/シーン作成など)。 */
export interface SystemEvent extends BaseEvent {
  kind: "system";
  text: string;
}

/** 駒を盤面上で移動(座標は 0..1 正規化)。 */
export interface PanelMoveEvent extends BaseEvent {
  kind: "panel-move";
  panelId: string;
  x: number;
  y: number;
}

/** 駒の属性(名前/情報/秘匿/サイズ/パレット)の更新。指定したフィールドだけ反映。 */
export interface PanelUpdateEvent extends BaseEvent {
  kind: "panel-update";
  panelId: string;
  patch: {
    name?: string;
    note?: string;
    hidden?: boolean;
    size?: number;
    palette?: string;
    speed?: number;
    sceneId?: string | null;
    layer?: number;
  };
}

/** 盤面設定(背景画像 / グリッド)の変更。active シーンの盤面に効く。 */
export interface BoardSetEvent extends BaseEvent {
  kind: "board-set";
  /** undefined のフィールドは据え置き。 */
  image?: string | null;
  grid?: boolean;
}

/** シーン追加(追加後そのシーンへ切替)。 */
export interface SceneAddEvent extends BaseEvent {
  kind: "scene-add";
  scene: SceneInfo;
}

/** シーン切替。 */
export interface SceneSelectEvent extends BaseEvent {
  kind: "scene-select";
  sceneId: string;
}

/** シーン名の変更。 */
export interface SceneRenameEvent extends BaseEvent {
  kind: "scene-rename";
  sceneId: string;
  name: string;
}

/** シーン削除(最後の1つは消せない)。 */
export interface SceneRemoveEvent extends BaseEvent {
  kind: "scene-remove";
  sceneId: string;
}

export type PlayEvent =
  | ChatEvent
  | RollEvent
  | ResourceEvent
  | PanelAddEvent
  | PanelRemoveEvent
  | SystemEvent
  | PanelMoveEvent
  | PanelUpdateEvent
  | BoardSetEvent
  | SceneAddEvent
  | SceneSelectEvent
  | SceneRenameEvent
  | SceneRemoveEvent;
