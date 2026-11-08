import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Coins } from "lucide-react";
import type { GameState } from "@/seratus/game/view";
import { voteChanges, voteTotals } from "./vote-changes";

type Float = { key: string; playerId: number; delta: number; x: number; y: number; dx: number; dy: number };

/** Show only fresh hand-total changes, never historical rolls or resumed results. */
export function VoteChangeFx({ state }: { state: GameState }) {
  const previous = useRef(voteTotals(state));
  const [floats, setFloats] = useState<Float[]>([]);
  const timers = useRef<Set<number>>(new Set());
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);
  useEffect(() => {
    const clear = () => { setFloats([]); timers.current.forEach((t) => window.clearTimeout(t)); timers.current.clear(); };
    const hide = () => { if (document.hidden) clear(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("resize", clear);
    window.addEventListener("scroll", clear, true);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("resize", clear);
      window.removeEventListener("scroll", clear, true);
    };
  }, []);
  useEffect(() => {
    const totals = voteTotals(state);
    const changes = voteChanges(previous.current, totals);
    previous.current = totals;
    if (!changes.length || document.hidden) return;
    const visibleRect = (selector: string) => [...document.querySelectorAll(selector)].map((el) => el.getBoundingClientRect()).find((r) => r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0);
    const source = visibleRect('[role="dialog"]') ?? visibleRect('.game-board-viewport');
    const additions = changes.map(({ playerId, delta }, index) => {
      const target = visibleRect(`[data-vote-player="${playerId}"]`) ?? visibleRect(`[data-pawn="${playerId}"]`) ?? source;
      const tx = target ? Math.min(innerWidth - 70, Math.max(70, target.left + target.width / 2)) : innerWidth / 2;
      const ty = target ? Math.min(innerHeight - 70, Math.max(70, target.top + target.height / 2)) : innerHeight / 2;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const x = !reduced && source ? source.left + source.width / 2 : tx;
      const y = !reduced && source ? Math.min(innerHeight - 50, Math.max(50, source.top + source.height * .55 + index * 44)) : ty;
      return { key: `${state.version}-${playerId}`, playerId, delta, x, y, dx: tx - x, dy: ty - y - 12 };
    });
    setFloats((items) => [...items, ...additions]);
    const timer = window.setTimeout(() => {
      setFloats((items) => items.filter((item) => !additions.some((a) => a.key === item.key)));
      timers.current.delete(timer);
    }, 1450);
    timers.current.add(timer);
  }, [state.version, state.tokens, state.players]);
  if (!floats.length) return null;
  return createPortal(<div className="vote-fx-layer" aria-live="polite" aria-atomic="false">
    {floats.map((item) => <div key={item.key} data-vote-change={item.playerId} className={`vote-float ${item.delta > 0 ? "vote-float-gain" : "vote-float-loss"}`} style={{ left: item.x, top: item.y, "--vote-dx": `${item.dx}px`, "--vote-dy": `${item.dy}px` } as CSSProperties}>
      <div className="vote-float-label"><Coins aria-hidden="true" /> <span>{item.delta > 0 ? "+" : "−"}{Math.abs(item.delta)} Suara{item.delta > 0 ? "!" : ""}</span></div>
      {item.delta > 0 && <div className="vote-gain-stars" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i}>✦</i>)}</div>}
    </div>)}
  </div>, document.body);
}