import { useState } from "react";
import { Layers, Shuffle, Trash2 } from "lucide-react";
import {
  DECK_PRESETS,
  TO_TABLE,
  createDeckOp,
  presetCards,
  shuffleDeckOp,
  type Deck,
  type DeckCard,
  type DeckOp,
  type DeckPreset,
} from "@trpg/core";

/**
 * カード・山札の欄(デスクトップ)。Web 版 components/play/play-deck-panel.tsx と同じ動き。
 * GM: 作る・場に出す・配る・場を流す・混ぜる・全部戻す・削除。
 * 参加者: 場のカード・残り枚数・自分の手札(本人宛ての暗号文で届く)。
 */
const rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
};

const pileCount = (d: Deck) => d.counts?.pile ?? d.pile.length;

export function DeckPanel(
  props:
    | { mode: "gm"; decks: Deck[]; members: string[]; onOp: (op: DeckOp, note: string) => void }
    | {
        mode: "player";
        decks: Deck[];
        hands: { deckId: string; cards: DeckCard[] }[];
        onDraw: (deckId: string) => void;
        onPlay: (deckId: string, cardId: string) => void;
      },
) {
  const [creating, setCreating] = useState(false);
  const [preset, setPreset] = useState<DeckPreset>("trump");
  const [name, setName] = useState("");
  const [custom, setCustom] = useState("");
  const [selfDraw, setSelfDraw] = useState(false);
  const decks = props.decks;

  return (
    <div className="deckp">
      {props.mode === "gm" && (
        <button className="btn mini" onClick={() => setCreating((v) => !v)}>
          <Layers size={12} /> 山札を作る
        </button>
      )}
      {props.mode === "gm" && creating && (
        <div className="deckp-create">
          <select className="input" value={preset} onChange={(e) => setPreset(e.target.value as DeckPreset)}>
            {DECK_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="山札の名前(省略可)" maxLength={40} />
          {preset === "custom" && (
            <textarea className="input" rows={4} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={"1 行に 1 枚\n例: 古い鍵"} />
          )}
          <label className="deckp-check">
            <input type="checkbox" checked={selfDraw} onChange={(e) => setSelfDraw(e.target.checked)} />
            参加者が自分で引ける
          </label>
          <button
            className="btn mini btn-primary"
            onClick={() => {
              const cards = presetCards(preset, custom);
              if (cards.length === 0) return;
              const label = DECK_PRESETS.find((p) => p.id === preset)?.name ?? "山札";
              const deckName = name.trim() || label.replace(/\(.*\)$/, "");
              props.onOp(
                createDeckOp({ id: crypto.randomUUID(), name: deckName, cards, selfDraw, rng }),
                `🃏 山札「${deckName}」(${cards.length} 枚)を用意しました`,
              );
              setCreating(false);
              setName("");
              setCustom("");
            }}
          >
            作って混ぜる
          </button>
        </div>
      )}
      {decks.length === 0 && props.mode === "gm" && !creating && (
        <p className="share-note">トランプ・タロット・自作のカードを山札にして、場に出したり配ったりできます。</p>
      )}
      {decks.map((d) => {
        const table = d.table.map((id) => d.cards.find((c) => c.id === id)).filter((c): c is DeckCard => !!c);
        const handCounts = d.counts?.hands ?? Object.fromEntries(Object.entries(d.hands).map(([k, v]) => [k, v.length]));
        return (
          <div key={d.id} className="deckp-deck">
            <div className="deckp-head">
              <b>{d.name}</b>
              <span>山札 {pileCount(d)} 枚</span>
            </div>
            {table.length > 0 && (
              <div className="deckp-cards">
                {table.map((c) => (
                  <span key={c.id} className="deckp-card">
                    {c.label}
                  </span>
                ))}
              </div>
            )}
            {Object.values(handCounts).some((n) => n > 0) && (
              <p className="share-note">
                手札: {Object.entries(handCounts).filter(([, n]) => n > 0).map(([w, n]) => `${w} ${n}枚`).join(" / ")}
              </p>
            )}
            {props.mode === "gm" && (
              <div className="deckp-actions">
                <button className="btn mini" disabled={pileCount(d) === 0} onClick={() => props.onOp({ op: "draw", deckId: d.id, count: 1, to: TO_TABLE }, `🃏 「${d.name}」から 1 枚を場に出しました`)}>
                  場に出す
                </button>
                {props.members.map((m) => (
                  <button key={m} className="btn mini" disabled={pileCount(d) === 0} title={`${m} の手札に 1 枚(本人にだけ見えます)`} onClick={() => props.onOp({ op: "draw", deckId: d.id, count: 1, to: m }, `🃏 ${m} に「${d.name}」から 1 枚配りました`)}>
                    {m}に配る
                  </button>
                ))}
                <button className="btn mini" disabled={table.length === 0} onClick={() => props.onOp({ op: "discard", deckId: d.id }, `🃏 「${d.name}」の場のカードを流しました`)}>
                  場を流す
                </button>
                <button className="btn mini" onClick={() => props.onOp(shuffleDeckOp(d, false, rng), `🃏 「${d.name}」の山札を混ぜました`)}>
                  <Shuffle size={11} /> 混ぜる
                </button>
                <button
                  className="btn mini"
                  onClick={() => {
                    if (confirm("場・捨て札・全員の手札を山札に戻して混ぜますか？"))
                      props.onOp(shuffleDeckOp(d, true, rng), `🃏 「${d.name}」を全部戻して混ぜました`);
                  }}
                >
                  全部戻す
                </button>
                <button className={`btn mini ${d.selfDraw ? "on" : ""}`} onClick={() => props.onOp({ op: "selfDraw", deckId: d.id, allow: !d.selfDraw }, "")}>
                  自分で引ける: {d.selfDraw ? "ON" : "OFF"}
                </button>
                <button
                  className="btn mini"
                  title="削除"
                  onClick={() => {
                    if (confirm(`山札「${d.name}」を削除しますか？`)) props.onOp({ op: "remove", deckId: d.id }, `🃏 山札「${d.name}」を片付けました`);
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            )}
            {props.mode === "player" && d.selfDraw && (
              <button className="btn mini" disabled={pileCount(d) === 0} onClick={() => props.onDraw(d.id)}>
                1 枚引く
              </button>
            )}
          </div>
        );
      })}
      {props.mode === "player" && props.hands.length > 0 && (
        <div className="deckp-hand">
          <p className="share-note">あなたの手札(あなたにだけ見えています)</p>
          {props.hands.map((h) => (
            <div key={h.deckId} className="deckp-cards">
              {h.cards.map((c) => (
                <button
                  key={c.id}
                  className="deckp-card"
                  title="クリックで場に出す"
                  onClick={() => {
                    if (confirm(`「${c.label}」を場に出しますか？`)) props.onPlay(h.deckId, c.id);
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
