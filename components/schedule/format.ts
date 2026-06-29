/**
 * 日程調整の日時表示(JST 固定)。サーバ/クライアント両方から使える純関数。
 * 候補は timestamptz(UTC) で保存し、表示は常に Asia/Tokyo に正規化する。
 */

function tokyoParts(iso: string) {
  const f = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    month: get("month"),
    day: get("day"),
    weekday: get("weekday"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** "6/28(土)" */
export function fmtDate(iso: string): string {
  const p = tokyoParts(iso);
  return `${p.month}/${p.day}(${p.weekday})`;
}

/** "20:00" */
export function fmtTime(iso: string): string {
  const p = tokyoParts(iso);
  return `${p.hour}:${p.minute}`;
}

/** "6/28(土) 20:00" */
export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

/**
 * datetime-local / date+time の入力(ブラウザのローカル解釈を避け JST 固定)を
 * UTC の ISO 文字列に変換する。`local` は "YYYY-MM-DDTHH:MM"。
 */
export function jstLocalToIso(local: string): string {
  return new Date(`${local}:00+09:00`).toISOString();
}

/** date("YYYY-MM-DD") + time("HH:MM") を JST 固定で ISO に。 */
export function jstDateTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}
