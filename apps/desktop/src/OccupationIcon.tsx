/**
 * 職業のワンポイント・アイコン(統一デザインの簡易ラインアイコン)。
 * currentColor で描くので、配置側の色をそのまま受け継ぐ。
 */
export function OccupationIcon({
  id,
  size = 20,
  className,
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {glyph(id)}
    </svg>
  );
}

function glyph(id: string) {
  switch (id) {
    case "doctor": // 医師 = 聴診器
      return (
        <>
          <circle cx="5" cy="3.6" r="1.2" />
          <circle cx="12.5" cy="3.6" r="1.2" />
          <path d="M5 4.8v2.7a3.75 3.75 0 0 0 7.5 0V4.8" />
          <path d="M8.75 11v2.5a4.75 4.75 0 0 0 9.5 0v-1" />
          <circle cx="18.25" cy="9.4" r="1.8" />
        </>
      );
    case "nurse": // 看護師 = 医療十字
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8.5v7M8.5 12h7" />
        </>
      );
    case "detective": // 私立探偵 = 虫眼鏡
      return (
        <>
          <circle cx="10" cy="10" r="6" />
          <line x1="20.5" y1="20.5" x2="14.5" y2="14.5" />
        </>
      );
    case "clergy": // 聖職者 = 十字
      return <path d="M12 3v18M7 8h10" />;
    case "professor": // 大学教授 = 角帽
      return (
        <>
          <path d="M2 8.5 12 4.5l10 4-10 4-10-4Z" />
          <path d="M6.5 10.6V14c0 1.4 2.5 2.4 5.5 2.4s5.5-1 5.5-2.4v-3.4" />
          <path d="M21.6 8.8v3.7" />
        </>
      );
    case "engineer": // 技師 = 歯車
      return (
        <>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" />
        </>
      );
    case "journalist": // 記者 = 新聞
      return (
        <>
          <path d="M4 5h12v14H6a2 2 0 0 1-2-2V5Z" />
          <path d="M16 8h4v9a2 2 0 0 1-2 2" />
          <path d="M7 8.5h6M7 11.5h6M7 14.5h4" />
        </>
      );
    case "author": // 作家 = ペン
      return (
        <>
          <path d="M4.5 19.5 6 15 16 5l3 3L9 18l-4.5 1.5Z" />
          <path d="M14 7l3 3" />
        </>
      );
    case "police": // 警察官 = 盾(バッジ)
      return (
        <>
          <path d="M12 2.5 19.5 5.3v5.7c0 4.7-3.2 8-7.5 9.5-4.3-1.5-7.5-4.8-7.5-9.5V5.3L12 2.5Z" />
          <path d="M9.4 12l1.9 1.9 3.4-3.7" />
        </>
      );
    case "soldier": // 軍人 = 星(階級章)
      return (
        <path d="M12 3l2.5 5.1 5.6.8-4 4 1 5.6L12 15.9 6.9 18.5l1-5.6-4-4 5.6-.8L12 3Z" />
      );
    case "antiquarian": // 古物商 = 壺
      return (
        <>
          <path d="M8.5 3.5h7" />
          <path d="M10 3.5c0 2.2-3.2 3-3.2 7.5 0 4.6 2.4 8.5 5.2 8.5s5.2-3.9 5.2-8.5c0-4.5-3.2-5.3-3.2-7.5" />
          <path d="M6.8 9l2 1.8M17.2 9l-2 1.8" />
        </>
      );
    case "criminal": // 犯罪者 = 仮面
      return (
        <>
          <path d="M3.5 10.5c0-2 2-3.5 4.5-3.5 1.6 0 3 .7 4 1.8 1-1.1 2.4-1.8 4-1.8 2.5 0 4.5 1.5 4.5 3.5 0 3-2.3 5.5-5 5.5-1.6 0-2.9-.8-3.5-2-.6 1.2-1.9 2-3.5 2-2.7 0-5-2.5-5-5.5Z" />
          <path d="M7 10.5h2M15 10.5h2" />
        </>
      );
    case "dilettante": // 自由人 = シルクハット
      return (
        <>
          <rect x="8" y="3.5" width="8" height="11" rx="1" />
          <path d="M4 15h16" />
          <path d="M8 11.5h8" />
        </>
      );
    case "entertainer": // 芸能人 = 音符
      return (
        <>
          <circle cx="7" cy="17.5" r="2.3" />
          <circle cx="17" cy="15.5" r="2.3" />
          <path d="M9.3 17.5V6.5l10-2v11" />
        </>
      );
    case "student": // 学生 = 本
      return (
        <>
          <path d="M12 6.5C9 5 5.5 5.5 3.5 6v12c2-.5 5.5-1 8.5.5" />
          <path d="M12 6.5C15 5 18.5 5.5 20.5 6v12c-2-.5-5.5-1-8.5.5" />
          <path d="M12 6.5v12" />
        </>
      );
    case "tribe_member": // 野外活動家 = 山
      return (
        <>
          <path d="M3 19l5.5-9 3.5 5 2.5-3.5L21 19H3Z" />
          <circle cx="17" cy="6.4" r="1.6" />
        </>
      );
    default: // 既定 = ブリーフケース
      return (
        <>
          <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
          <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
          <path d="M3 12.5h18" />
        </>
      );
  }
}
