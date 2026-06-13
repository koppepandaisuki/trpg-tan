import { useEffect, useState } from "react";
import { Users, Lock } from "lucide-react";

/**
 * メモ(共有 / 個人)。
 *  - 共有: .play(卓データ)に保存し、将来の同期で全員と共有する想定
 *  - 個人: この端末の localStorage のみ(誰にも共有されない GM の手元メモ)
 */
const personalKey = (playId: string) => `trpg.play.memo.v1::${playId}`;

export function MemoPanel({
  playId,
  shared,
  onSharedChange,
}: {
  playId: string;
  shared: string;
  onSharedChange: (text: string) => void;
}) {
  const [tab, setTab] = useState<"shared" | "personal">("shared");
  const [personal, setPersonal] = useState("");

  useEffect(() => {
    setPersonal(localStorage.getItem(personalKey(playId)) ?? "");
  }, [playId]);

  function savePersonal(text: string) {
    setPersonal(text);
    try {
      localStorage.setItem(personalKey(playId), text);
    } catch {
      // 容量超過などは無視(メモは副次データ)
    }
  }

  return (
    <div className="memo-panel">
      <div className="memo-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "shared"}
          className={`plog-tab ${tab === "shared" ? "active" : ""}`}
          onClick={() => setTab("shared")}
        >
          <Users size={13} /> 共有
        </button>
        <button
          role="tab"
          aria-selected={tab === "personal"}
          className={`plog-tab ${tab === "personal" ? "active" : ""}`}
          onClick={() => setTab("personal")}
        >
          <Lock size={13} /> 個人
        </button>
      </div>

      {tab === "shared" ? (
        <textarea
          className="input memo-area"
          value={shared}
          onChange={(e) => onSharedChange(e.target.value)}
          placeholder="卓の全員と共有するメモ（.play に保存されます）"
        />
      ) : (
        <textarea
          className="input memo-area"
          value={personal}
          onChange={(e) => savePersonal(e.target.value)}
          placeholder="自分だけのメモ（この端末にのみ保存・共有されません）"
        />
      )}
    </div>
  );
}
