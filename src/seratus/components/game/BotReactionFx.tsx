import { checkedAt } from "@/seratus/lib/checked-at";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GameState } from "@/seratus/game/view";
import { freshBotReactions, reactionSnapshot, REACTION_COPY, type BotReaction } from "./bot-reactions";

type Bubble = BotReaction & { key: string; name: string; line: string; left: number; top: number };
const LIFE_MS = 2600;

/** Fresh, short bot comments beside the visible player marker; resuming stays quiet. */
export function BotReactionFx({ state }: { state: GameState }) {
  const previous = useRef(reactionSnapshot(state));
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const timers = useRef(new Set<number>());
  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
  };
  useEffect(() => {
    const clear = () => { timers.current.forEach(window.clearTimeout); timers.current.clear(); setBubbles([]); };
    const hidden = () => { if (document.hidden) clear(); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("resize", clear);
    window.addEventListener("scroll", clear, true);
    return () => { timers.current.forEach(window.clearTimeout); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("resize", clear); window.removeEventListener("scroll", clear, true); };
  }, []);
  useEffect(() => {
    const next = reactionSnapshot(state);
    const reactions = freshBotReactions(previous.current, next);
    previous.current = next;
    if (!reactions.length || document.hidden) return;
    // Let the floating score reach its player before the comment appears.
    reactions.forEach((reaction, index) => schedule(() => {
      if (document.hidden) return;
      const rect = [...document.querySelectorAll(`[data-vote-player="${reaction.playerId}"], [data-pawn="${reaction.playerId}"]`)]
        .map((el) => el.getBoundingClientRect()).find((r) => r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0);
      const player = state.players.find((p) => p.id === reaction.playerId);
      if (!rect || !player) return;
      const copy = REACTION_COPY[reaction.kind];
      const key = `${state.version}-${reaction.playerId}`;
      const left = Math.max(8, Math.min(innerWidth - 192, rect.left + rect.width / 2 - 92));
      const top = Math.max(8, Math.min(innerHeight - 72, rect.top >= 78 ? rect.top - 72 : rect.bottom + 8));
      const line = checkedAt(copy.lines, (state.version + reaction.playerId) % copy.lines.length);
      setBubbles((items) => [...items.filter((b) => b.playerId !== reaction.playerId), { ...reaction, key, name: player.name, line, left, top }]);
      schedule(() => setBubbles((items) => items.filter((b) => b.key !== key)), LIFE_MS);
    }, 1500 + index * 180));
  }, [state]);
  if (!bubbles.length) return null;
  return createPortal(<div className="bot-reaction-layer" aria-live="polite" aria-atomic="false">
    {bubbles.map((bubble) => <div key={bubble.key} data-bot-reaction={bubble.playerId} className={`bot-reaction bot-reaction-${bubble.kind}`} style={{ left: bubble.left, top: bubble.top }}>
      <span className="bot-reaction-emoji" aria-hidden="true">{REACTION_COPY[bubble.kind].emoji}</span>
      <div><strong>{bubble.name}</strong><p>{bubble.line}</p></div>
    </div>)}
  </div>, document.body);
}