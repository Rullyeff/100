import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { GameState } from "@/seratus/game/view";
import { celebrationSnapshot, freshCelebrations } from "./celebration-events";

type Burst = { key: string; x: number; y: number; big: boolean };

/** Short, upright confetti bursts on fresh public achievements; no actions or audio. */
export function CelebrationFx({ state }: { state: GameState }) {
  const previous = useRef(celebrationSnapshot(state));
  const [bursts, setBursts] = useState<Burst[]>([]);
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const clear = () => { timers.current.forEach(window.clearTimeout); timers.current.clear(); setBursts([]); };
    const hide = () => { if (document.hidden) clear(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("resize", clear);
    window.addEventListener("scroll", clear, true);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("resize", clear);
      window.removeEventListener("scroll", clear, true);
      timers.current.forEach(window.clearTimeout);
    };
  }, []);
  useEffect(() => {
    const next = celebrationSnapshot(state);
    const events = freshCelebrations(previous.current, next);
    previous.current = next;
    if (!events.length || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const visibleRect = (selector: string) => [...document.querySelectorAll(selector)].map((el) => el.getBoundingClientRect()).find((r) => r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0);
    const board = visibleRect(".game-board-viewport");
    const additions = events.slice(0, 2).flatMap((event) => {
      const big = event.kind === "win" || event.kind === "done";
      const target = (big ? visibleRect('[role="dialog"]') : null) ?? visibleRect(`[data-vote-player="${event.playerId}"]`) ?? visibleRect(`[data-pawn="${event.playerId}"]`) ?? board;
      if (!target) return [];
      return [{ key: `${next.version}-${event.playerId}`, big, x: Math.min(innerWidth - 50, Math.max(50, target.left + target.width / 2)), y: Math.min(innerHeight - 90, Math.max(80, target.top + target.height / 2)) }];
    });
    setBursts((old) => [...old.slice(-2), ...additions]);
    const timer = window.setTimeout(() => {
      setBursts((old) => old.filter((item) => !additions.some((a) => a.key === item.key)));
      timers.current.delete(timer);
    }, 1900);
    timers.current.add(timer);
  }, [state]);
  if (!bursts.length) return null;
  return createPortal(<div className="celebration-layer" aria-hidden="true">
    {bursts.map((burst) => <div key={burst.key} data-celebration={burst.key} className="celebration-burst" style={{ left: burst.x, top: burst.y } as CSSProperties}>
      {Array.from({ length: burst.big ? 32 : 18 }, (_, i) => {
        const angle = (i * 137.5) * Math.PI / 180;
        const spread = (burst.big ? 180 : 105) * (.5 + (i % 5) * .12);
        return <i key={i} className={i % 6 === 0 ? "celebration-star" : "celebration-confetti"} style={{ "--confetti-x": `${Math.cos(angle) * spread}px`, "--confetti-y": `${-65 - (i % 7) * 14}px`, "--confetti-fall": `${80 + (i % 5) * 20}px`, "--confetti-spin": `${(i % 2 ? 1 : -1) * (180 + i * 31)}deg`, animationDelay: `${(i % 4) * 35}ms` } as CSSProperties}>{i % 6 === 0 ? "✦" : null}</i>;
      })}
    </div>)}
  </div>, document.body);
}