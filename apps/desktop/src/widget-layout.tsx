import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * フローティング・ウィジェットの配置(位置・サイズ・重なり順)を保持する層。
 *
 * 配置は「GM ローカルの UI 状態」なので .play(共有/同期対象)には載せず、
 * localStorage に卓 id ごとに保存する(BGM 音量と同じ思想)。これにより
 * コアのスキーマを汚さず、Phase 2(別ウィンドウ切り離し)へも素直に拡張できる。
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}
export type RectMap = Record<string, Rect>;

const keyOf = (playId: string) => `trpg.play.layout.v1::${playId}`;

function load(playId: string): RectMap {
  try {
    const raw = localStorage.getItem(keyOf(playId));
    if (!raw) return {};
    const m = JSON.parse(raw) as RectMap;
    return m && typeof m === "object" ? m : {};
  } catch {
    return {};
  }
}
function save(playId: string, map: RectMap): void {
  try {
    localStorage.setItem(keyOf(playId), JSON.stringify(map));
  } catch {
    // 配置は副次的なので容量超過等は無視。
  }
}

export interface WidgetLayoutApi {
  has: (id: string) => boolean;
  get: (id: string) => Rect | undefined;
  /** 未登録なら既定矩形で確定(最前面 z を割り当て)。登録済みなら何もしない。 */
  ensure: (id: string, def: Rect) => void;
  set: (id: string, rect: Rect) => void;
  bringToFront: (id: string) => void;
}

const Ctx = createContext<WidgetLayoutApi | null>(null);

export function WidgetLayoutProvider({
  playId,
  children,
}: {
  playId: string;
  children: ReactNode;
}) {
  const [map, setMap] = useState<RectMap>(() => load(playId));
  const zRef = useRef(10);

  // 卓を切り替えたら配置を読み直す。z カウンタも現在の最大値に合わせる。
  useEffect(() => {
    const m = load(playId);
    setMap(m);
    const zs = Object.values(m).map((r) => r.z);
    zRef.current = zs.length ? Math.max(10, ...zs) : 10;
  }, [playId]);

  // 変更のたびに保存(小さなオブジェクトなので素直に書く)。
  useEffect(() => {
    save(playId, map);
  }, [playId, map]);

  // map に依存させることで、配置が変わるたびに Context 値の identity が変わり、
  // 購読側(各ウィジェット)が再描画される。ここを [] にすると値が固定され、
  // ドラッグしても見た目が動かない(状態だけ更新され描画されない)バグになる。
  const api = useMemo<WidgetLayoutApi>(
    () => ({
      has: (id) => map[id] !== undefined,
      get: (id) => map[id],
      ensure: (id, def) =>
        setMap((m) =>
          m[id] ? m : { ...m, [id]: { ...def, z: (zRef.current += 1) } },
        ),
      set: (id, rect) => setMap((m) => ({ ...m, [id]: rect })),
      bringToFront: (id) =>
        setMap((m) => {
          const cur = m[id];
          if (!cur) return m;
          const z = (zRef.current += 1);
          if (cur.z === z) return m;
          return { ...m, [id]: { ...cur, z } };
        }),
    }),
    [map],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWidgetLayout(): WidgetLayoutApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWidgetLayout must be used within WidgetLayoutProvider");
  return c;
}
