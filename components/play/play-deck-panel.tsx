"use client";

import { useState } from "react";
import { Layers, Plus, Shuffle, Trash2 } from "lucide-react";
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
import { buttonVariants, toolButton } from "@/components/ui/button";

/**
 * カード・山札の欄(Web)。GM と参加者で同じ部品を使う。
 *
 *   - GM: 山札を作る(トランプ / タロット / 自作)、引いて場に出す、参加者に配る、
 *     混ぜる、場を流す、削除。山札の並び・手札の中身は GM の手元だけにある。
 *   - 参加者: 場のカードと残り枚数、自分の手札(本人にだけ暗号文で届く)。
 *     GM が許可した山札からは自分で 1 枚引ける。手札は場に出せる。
 */

const rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
};

function CardChip({ card }: { card: DeckCard }) {
  return (
    <span className="inline-flex items-center rounded border border-border bg-white px-1.5 py-0.5 text-xs font-semibold shadow-sm">
      {card.label}
    </span>
  );
}

function pileCount(d: Deck) {
  return d.counts?.pile ?? d.pile.length;
}

export function PlayDeckPanel(
  props:
    | {
        mode: "gm";
        decks: Deck[];
        members: string[];
        onOp: (op: DeckOp, note: string) => void;
      }
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

  if (props.mode === "player" && decks.length === 0 && props.hands.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <Layers className="h-3.5 w-3.5 text-primary" aria-hidden />
        <h2 className="flex-1 text-xs font-semibold">カード</h2>
        {props.mode === "gm" && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className={buttonVariants({ variant: "ghost", size: "xs" })}
          >
            <Plus className="h-3 w-3" aria-hidden />
            山札を作る
          </button>
        )}
      </header>

      <div className="space-y-3 px-3 py-2.5 text-xs">
        {props.mode === "gm" && creating && (
          <form
            className="space-y-1.5 rounded border border-border p-2"
            onSubmit={(e) => {
              e.preventDefault();
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
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as DeckPreset)}
              className="w-full rounded border border-border bg-background px-2 py-1"
            >
              {DECK_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山札の名前(省略可)"
              maxLength={40}
              className="w-full rounded border border-border bg-background px-2 py-1"
            />
            {preset === "custom" && (
              <textarea
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                rows={4}
                placeholder={"1 行に 1 枚\n例: 古い鍵\n例: 血のついた日記"}
                className="w-full rounded border border-border bg-background px-2 py-1"
              />
            )}
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={selfDraw}
                onChange={(e) => setSelfDraw(e.target.checked)}
              />
              参加者が自分で引ける
            </label>
            <button
              type="submit"
              className="w-full rounded bg-primary py-1 text-primary-foreground"
            >
              作って混ぜる
            </button>
          </form>
        )}

        {decks.length === 0 && props.mode === "gm" && !creating && (
          <p className="text-muted-foreground">
            トランプ・タロット・自作のカード(手がかりカード等)を山札にして、場に出したり配ったりできます。
          </p>
        )}

        {decks.map((d) => {
          const table = d.table
            .map((id) => d.cards.find((c) => c.id === id))
            .filter((c): c is DeckCard => !!c);
          const handCounts =
            d.counts?.hands ??
            Object.fromEntries(Object.entries(d.hands).map(([k, v]) => [k, v.length]));
          return (
            <div key={d.id} className="space-y-1.5 rounded border border-border p-2">
              <div className="flex items-center gap-1.5">
                <span className="flex-1 truncate font-semibold">{d.name}</span>
                <span className="text-[11px] text-muted-foreground">山札 {pileCount(d)} 枚</span>
              </div>
              {table.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {table.map((c) => (
                    <CardChip key={c.id} card={c} />
                  ))}
                </div>
              )}
              {Object.keys(handCounts).length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  手札:{" "}
                  {Object.entries(handCounts)
                    .filter(([, n]) => n > 0)
                    .map(([who, n]) => `${who} ${n}枚`)
                    .join(" / ")}
                </p>
              )}

              {props.mode === "gm" && (
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={pileCount(d) === 0}
                    onClick={() =>
                      props.onOp(
                        { op: "draw", deckId: d.id, count: 1, to: TO_TABLE },
                        `🃏 「${d.name}」から 1 枚を場に出しました`,
                      )
                    }
                    className={toolButton}
                  >
                    場に出す
                  </button>
                  {props.members.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={pileCount(d) === 0}
                      onClick={() =>
                        props.onOp(
                          { op: "draw", deckId: d.id, count: 1, to: m },
                          `🃏 ${m} に「${d.name}」から 1 枚配りました`,
                        )
                      }
                      className={toolButton}
                      title={`${m} の手札に 1 枚(本人にだけ見えます)`}
                    >
                      {m}に配る
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={table.length === 0}
                    onClick={() =>
                      props.onOp(
                        { op: "discard", deckId: d.id },
                        `🃏 「${d.name}」の場のカードを流しました`,
                      )
                    }
                    className={toolButton}
                  >
                    場を流す
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      props.onOp(shuffleDeckOp(d, false, rng), `🃏 「${d.name}」の山札を混ぜました`)
                    }
                    className={toolButton}
                  >
                    <Shuffle className="h-3 w-3" aria-hidden />
                    混ぜる
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm("場・捨て札・全員の手札を山札に戻して混ぜますか？")) return;
                      props.onOp(
                        shuffleDeckOp(d, true, rng),
                        `🃏 「${d.name}」を全部戻して混ぜました`,
                      );
                    }}
                    className={toolButton}
                  >
                    全部戻す
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      props.onOp({ op: "selfDraw", deckId: d.id, allow: !d.selfDraw }, "")
                    }
                    aria-pressed={!!d.selfDraw}
                    className={toolButton}
                    title="参加者が自分で 1 枚ずつ引けるか"
                  >
                    自分で引ける: {d.selfDraw ? "ON" : "OFF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`山札「${d.name}」を削除しますか？`)) return;
                      props.onOp(
                        { op: "remove", deckId: d.id },
                        `🃏 山札「${d.name}」を片付けました`,
                      );
                    }}
                    className="rounded-full p-1 text-muted-foreground hover:text-red-600"
                    title="削除"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              )}

              {props.mode === "player" && d.selfDraw && (
                <button
                  type="button"
                  disabled={pileCount(d) === 0}
                  onClick={() => props.onDraw(d.id)}
                  className={toolButton}
                >
                  1 枚引く
                </button>
              )}
            </div>
          );
        })}

        {props.mode === "player" && props.hands.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground">
              あなたの手札(あなたにだけ見えています)
            </p>
            {props.hands.map((h) => {
              const deck = decks.find((d) => d.id === h.deckId);
              return (
                <div key={h.deckId} className="space-y-1">
                  {deck && <p className="text-[11px] text-muted-foreground">{deck.name}</p>}
                  <div className="flex flex-wrap gap-1">
                    {h.cards.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (confirm(`「${c.label}」を場に出しますか？`))
                            props.onPlay(h.deckId, c.id);
                        }}
                        title="クリックで場に出す"
                      >
                        <CardChip card={c} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
