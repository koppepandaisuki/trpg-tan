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

/** キャラの差分(立ち絵/表情/状態)。portrait を切り替える候補。 */
export interface PanelVariant {
  id: string;
  /** 表示名("基本" / "笑顔" / "負傷"…)。チャットの @ラベル で参照する。 */
  label: string;
  /** data URL。 */
  image: string;
}

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
  /** カスタムシステムの表示名(CoC 以外のとき)。 */
  systemName?: string;
  /**
   * 能力値/技能クリック時の判定コマンド雛形({value} が値に置換され、
   * 末尾にラベルが付く)。未設定は CoC の "CC<=値"。
   */
  checkTemplate?: string;
  /**
   * ダイスボット id(sheet 由来)。この駒からの判定はこのボットで解釈する。
   * 卓のグローバル選択に依らず、混在システム卓でも各キャラが自分の
   * システムの記法(例: エモクロアの XDM<=能力値)で振れるようにする。
   */
  diceBot?: string;
  stats: PanelStat[];
  resources: PanelResource[];
  /** 盤面上の位置(0..1 正規化。盤面サイズに依らず保存できる)。未配置は undefined。 */
  pos?: { x: number; y: number };
  /** 盤面上の表示サイズ(px)。円形駒は直径、画像オブジェクトは幅。未指定は既定。 */
  size?: number;
  /**
   * 画像オブジェクトの高さ(px)。未指定なら元画像の縦横比で自動。指定すると
   * 縦横を独立に伸縮(自由変形)できる。円形駒(キャラ)では使わない。
   */
  height?: number;
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
  /** 位置固定(ドラッグ移動・リサイズを禁止)。 */
  locked?: boolean;
  /** 差分(立ち絵/表情)。切替は panel-update の portrait で行う。 */
  variants?: PanelVariant[];
  /**
   * 操作権の持ち主。マルチで参加者が自分で追加したキャラはその参加者の表示名が
   * 入り、本人だけがダイス/パレット/リソースを操作できる。未設定/null/"GM" は GM 所有
   * (参加者は操作不可・GM は全操作可)。GM がキャラをプレイヤーへ譲渡すると相手の
   * 表示名が入り、null へ戻すと GM 所有に戻る。
   */
  owner?: string | null;
}

/** 盤面(背景マップ + グリッド + 前景)。 */
export interface PlayBoard {
  /** 背景画像(data URL)。未設定なら無地。 */
  image: string | null;
  /** グリッド表示の on/off。 */
  grid: boolean;
  /** 前景画像(駒より上に重ねる演出レイヤー。data URL)。未設定なら無し。 */
  foreground?: string | null;
  /** 背景画像の表示倍率(Shift+ホイールで調整。未設定 = 1)。 */
  bgScale?: number;
  /** 前景画像の表示倍率(Shift+ホイールで調整。未設定 = 1)。 */
  fgScale?: number;
  /** 前景がある時に背景をぼかすか(未設定 = ぼかす)。 */
  bgBlur?: boolean;
  /** 前景の重なり順(z-index)。未設定 = 0。駒の layer がこれより大きいと駒が前。 */
  fgLayer?: number;
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
  /** このシーンに紐づく BGM(BgmTrack.id)。切替時に自動再生する。 */
  bgmId?: string;
  /** 読み上げ台本(プレイヤーに見せる導入/情景)。シナリオビルダー用。 */
  script?: string;
  /** GM だけが見る進行メモ。 */
  gmNote?: string;
  /** このシーンで出せる手がかり(箇条書き)。 */
  clues?: string[];
}

/**
 * アセットの 1 アクション(マクロの 1 ステップ)。kind ごとに使うフィールドが
 * 異なる。クリック時に actions を上から順に実行して「ひとつの演出」にする。
 */
export interface AssetAction {
  kind:
    | "scene" // シーン切替(紐づく BGM も自動再生)
    | "board-bg" // 盤面の背景に設定
    | "place-image" // 盤面の中央に画像を配置
    | "spawn-char" // 保存済みキャラを登場させる
    | "cutin" // カットインを再生
    | "telop" // テロップ(定型文)を画面に表示
    | "bgm" // BGM を再生 / 停止
    | "se"; // SE(効果音)を鳴らす
  /** board-bg / place-image: 画像(data URL)。 */
  image?: string;
  /** place-image / board-bg のラベル(駒名)。 */
  label?: string;
  /** scene: シーン id。 */
  sceneId?: string;
  /** spawn-char: ライブラリのキャラ id。 */
  charId?: string;
  /** cutin: カットイン id。 */
  cutinId?: string;
  /** bgm: BGM トラック id(null/空 = 停止)。 */
  bgmId?: string | null;
  /** se: SE トラック名。 */
  seName?: string;
  /** telop: 表示テキスト。 */
  text?: string;
}

/**
 * アセット(卓の「ワンクリック演出」)。複数アクションをまとめてボタン化したもの。
 * 旧データ互換: image だけ持つ単体画像アセットは「盤面に配置」する素材として扱う。
 */
export interface AssetItem {
  id: string;
  name: string;
  /** 旧データ互換 & サムネ表示用: 単体画像(data URL)。 */
  image?: string;
  /**
   * マクロ本体(順に実行)。未設定/空なら image を「配置」する単体素材として
   * 振る舞う(後方互換)。
   */
  actions?: AssetAction[];
}

/** カットイン(演出用の画像。クリックで画面に流す)。 */
export interface CutIn {
  id: string;
  name: string;
  /** data URL。 */
  image: string;
  /** 帯の背景色(hex)。未設定は既定の紺。 */
  bg?: string;
  /** 同時に鳴らす効果音(ローカル音声ファイルのパス)。未設定なら無音。 */
  soundPath?: string;
  soundName?: string;
}

/**
 * ハンドアウト(HO)。プレイヤー個別の導入・秘密。PLAY 中に指定相手へ配布する。
 * シナリオ特化ビルダーの目玉。公開部分は全員、秘密部分は担当者だけに見せる。
 */
export interface Handout {
  id: string;
  /** "HO1" などの短いラベル。 */
  label: string;
  title: string;
  /** 全員に見せてよい公開部分。 */
  publicText?: string;
  /** 担当プレイヤーだけに見せる秘密部分。 */
  secretText?: string;
  /** 割り当て先(参加者の表示名 or 駒 id)。未割当は誰でも取得可。 */
  assignTo?: string | null;
  /** 添付画像(data URL or Storage URL)。 */
  image?: string | null;
}

/** シナリオに登場する NPC の覚書(GM 用。必要なら駒化する)。 */
export interface ScenarioNpc {
  id: string;
  name: string;
  portrait?: string | null;
  /** 公開してよい情報。 */
  note?: string;
  /** GM だけが見る秘密。 */
  secret?: string;
}

/**
 * シナリオ情報(卓に同梱する「読み物 + 進行 + HO」メタ)。PlayScene に任意で付く。
 * 既存の .play には無いので optional(後方互換)。シナリオ特化ビルダーで編集する。
 */
export interface ScenarioInfo {
  /** あらすじ・概要。 */
  synopsis?: string;
  /** 推奨人数(表示用の自由文 "2〜4人" 等)。 */
  players?: string;
  /** 想定プレイ時間(分)。 */
  minutes?: number;
  /** GM 向けの全体メモ(進行の勘所・ネタバレ)。 */
  gmNotes?: string;
  /** ハンドアウト一覧。 */
  handouts?: Handout[];
  /** NPC 一覧。 */
  npcs?: ScenarioNpc[];
}

/** メモの 1 ページ(名前付き)。共有メモ・個人メモで使い回す。 */
export interface MemoPage {
  id: string;
  name: string;
  text: string;
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
  /** SE(効果音)リスト。単発再生のほか、カットイン/定型文に添付する音源庫。 */
  se?: PlayBgm;
  /** シーン一覧。board は active シーンの盤面を映す(scenes が真。古い .play は optional)。 */
  scenes?: SceneInfo[];
  activeSceneId?: string;
  /** シナリオテキストストック(1 行 1 テキスト。# 行は見出し)。GM の定型文置き場。 */
  textStock?: string;
  /** カットイン画像(演出)。 */
  cutins?: CutIn[];
  /** アセット(画像素材庫)。盤面へドラッグ / 配置して使う。 */
  assets?: AssetItem[];
  /** シナリオ情報(あらすじ/HO/NPC/GMメモ)。シナリオ特化ビルダーで編集。任意。 */
  scenario?: ScenarioInfo;
  /** 共有メモ(旧形式の単一テキスト。後方互換のため残す。新形式は sharedMemos)。 */
  sharedMemo?: string;
  /** 共有メモ(名前付きの複数ページ。卓の全員と共有・.play に保存)。 */
  sharedMemos?: MemoPage[];
  /** ダイスボット(システム別ダイス処理)。未設定は systemId から既定。 */
  diceBot?: string;
  /** 卓のタグ(GM のローカル整理用。ロビーのカードに表示する)。配信不要。 */
  tags?: string[];
  /** ターン管理(ラウンド数 + 手番の駒)。round 0 = 未開始。 */
  turn?: { round: number; activePanelId: string | null };
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

/** 発言。channel 未設定はメイン。個別チャットはパネル id を channel に持つ。 */
export interface ChatEvent extends BaseEvent {
  kind: "chat";
  text: string;
  channel?: string;
  /** 発言の文字色(CSS color)。未設定は既定色。 */
  color?: string;
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
  /** ダイスボットの判定詳細("スペシャル！" / "成功数2" 等)。 */
  detail?: string;
  /** シークレットダイス(他プレイヤーには出目を伏せる)。 */
  secret?: boolean;
  /** 秘匿時に出目を見せる相手(パネル id / 将来のプレイヤー id)。空=GMのみ。 */
  visibleTo?: string[];
  /** 個別チャット内で振った場合のチャンネル(未設定=メイン)。 */
  channel?: string;
  /** 発言者名の文字色(CSS color)。未設定は既定色。 */
  color?: string;
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
    height?: number;
    palette?: string;
    speed?: number;
    sceneId?: string | null;
    layer?: number;
    locked?: boolean;
    /** 差分切替(現在の立ち絵)。 */
    portrait?: string | null;
    /** 差分リストの編集。 */
    variants?: PanelVariant[];
    /** 操作権の譲渡(プレイヤー名)/解除(null=GM 所有)。 */
    owner?: string | null;
  };
}

/** 盤面設定(背景画像 / グリッド)の変更。active シーンの盤面に効く。 */
export interface BoardSetEvent extends BaseEvent {
  kind: "board-set";
  /** undefined のフィールドは据え置き。 */
  image?: string | null;
  grid?: boolean;
  /** 前景画像(駒より上のレイヤー)。null で解除。undefined は据え置き。 */
  foreground?: string | null;
  /** 背景 / 前景の表示倍率(undefined は据え置き)。 */
  bgScale?: number;
  fgScale?: number;
  /** 背景ぼかしの on/off(undefined は据え置き)。 */
  bgBlur?: boolean;
  /** 前景の重なり順(undefined は据え置き)。 */
  fgLayer?: number;
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

/** ターン管理(ラウンド / 手番)の更新。label は表示用の一文。 */
export interface TurnSetEvent extends BaseEvent {
  kind: "turn-set";
  round: number;
  activePanelId: string | null;
  label: string;
}

/** チャット/ログ履歴の全消去(駒・盤面・シーン等の状態には影響しない)。 */
export interface LogClearEvent extends BaseEvent {
  kind: "log-clear";
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
  | SceneRemoveEvent
  | TurnSetEvent
  | LogClearEvent;
