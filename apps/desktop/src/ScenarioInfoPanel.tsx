import { useState } from "react";
import { Send } from "lucide-react";
import type { Handout, PlayScene } from "@trpg/core";

/**
 * シナリオ情報(GM 専用・デスクトップ)。Web 版 components/play/play-scenario-panel.tsx と同じ内容:
 *   - このシーン: 読み上げ文(段落ごとにチャットへ)/ GM メモ / 手がかり・判定
 *   - シナリオ: あらすじ・HO(参加者を選んで個別に配る)・NPC・GM メモ
 * ここに出る情報は参加者へは送られない(@trpg/core の projectForPlayers)。
 */
export function ScenarioInfoPanel({
  scene,
  members,
  onSay,
  onDistribute,
}: {
  scene: PlayScene;
  /** 卓に参加中の人(入室名)。ハンドアウトの配布先。 */
  members: string[];
  onSay: (text: string) => void;
  onDistribute: (handout: Handout, to: string) => void;
}) {
  const [tab, setTab] = useState<"scene" | "info">("scene");
  const active = scene.scenes?.find((s) => s.id === scene.activeSceneId);
  const info = scene.scenario;
  const paragraphs = (active?.script ?? "")
    .split(/\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="scinfo">
      <div className="scinfo-tabs">
        <button className={`btn mini ${tab === "scene" ? "on" : ""}`} onClick={() => setTab("scene")}>
          このシーン
        </button>
        <button className={`btn mini ${tab === "info" ? "on" : ""}`} onClick={() => setTab("info")}>
          シナリオ
        </button>
      </div>

      {tab === "scene" && (
        <div className="scinfo-body">
          {!active?.script && !active?.gmNote && !active?.clues?.length && (
            <p className="share-note">
              このシーンにはメモがありません(シナリオ工房から作った卓・シナリオビルダーで書いた卓で表示されます)。
            </p>
          )}
          {paragraphs.length > 0 && (
            <>
              <p className="scinfo-label">読み上げ</p>
              {paragraphs.map((p, i) => (
                <div key={i} className="scinfo-para">
                  <span>{p}</span>
                  <button className="scinfo-say" title="チャットに流す" onClick={() => onSay(p)}>
                    <Send size={11} />
                  </button>
                </div>
              ))}
            </>
          )}
          {active?.gmNote && (
            <>
              <p className="scinfo-label">GMメモ</p>
              <p className="scinfo-pre">{active.gmNote}</p>
            </>
          )}
          {active?.clues && active.clues.length > 0 && (
            <>
              <p className="scinfo-label">手がかり・判定</p>
              <ul className="scinfo-list">
                {active.clues.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === "info" && (
        <div className="scinfo-body">
          {!info && <p className="share-note">シナリオ情報はありません。</p>}
          {info?.synopsis && <p className="scinfo-pre">{info.synopsis}</p>}
          {info?.handouts && info.handouts.length > 0 && (
            <>
              <p className="scinfo-label">ハンドアウト</p>
              {info.handouts.map((h) => (
                <div key={h.id} className="scinfo-card">
                  <b>
                    {h.label} {h.title}
                  </b>
                  {h.publicText && <p className="scinfo-pre">{h.publicText}</p>}
                  {h.secretText && <p className="scinfo-pre scinfo-secret">秘匿: {h.secretText}</p>}
                  <div className="scinfo-dist">
                    <span>配る:</span>
                    {members.length === 0 && <span className="share-note">参加者が入ると選べます</span>}
                    {members.map((m) => (
                      <button
                        key={m}
                        className="btn mini"
                        title="この人だけに届きます(他の参加者には見えません)"
                        onClick={() => {
                          if (confirm(`${h.label} を「${m}」さんだけに配りますか？`)) onDistribute(h, m);
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
          {info?.npcs && info.npcs.length > 0 && (
            <>
              <p className="scinfo-label">NPC</p>
              {info.npcs.map((n) => (
                <div key={n.id} className="scinfo-card">
                  <b>{n.name}</b>
                  {n.note && <p className="scinfo-pre">{n.note}</p>}
                  {n.secret && <p className="scinfo-pre scinfo-secret">秘密: {n.secret}</p>}
                </div>
              ))}
            </>
          )}
          {info?.gmNotes && (
            <>
              <p className="scinfo-label">GMメモ</p>
              <p className="scinfo-pre">{info.gmNotes}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
