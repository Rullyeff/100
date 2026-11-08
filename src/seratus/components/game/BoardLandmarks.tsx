import { checkedAt } from "@/seratus/lib/checked-at";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { boardCenter, pentSpace } from "@/seratus/game/board";
import { AREAS, escrowCount, homeOwnerOf, isSafeGate, PENT_TOTAL, type GameState } from "@/seratus/game/view";
import { areaVar } from "./theme";

/** Tiny board toys follow public ownership only; never create a claim or move a pawn. */
export function BoardLandmarks({ state }: { state: GameState }) {
  const center = boardCenter();
  const owners = Array.from({ length: PENT_TOTAL }, (_, space) =>
    isSafeGate(space) ? homeOwnerOf(state, Math.floor(space / (PENT_TOTAL / AREAS.length))) : checkedAt(state.spaces, space),
  );
  const previous = useRef(owners);
  const [built, setBuilt] = useState<number[]>([]);
  useEffect(() => {
    const fresh = owners.flatMap((owner, space) => owner != null && owner !== checkedAt(previous.current, space) ? [space] : []);
    previous.current = owners;
    if (!fresh.length || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setBuilt(fresh);
    const timer = window.setTimeout(() => setBuilt([]), 850);
    return () => window.clearTimeout(timer);
  }, [state.spaces, state.homeOwner]);
  return (
    <g className="board-landmarks" pointerEvents="none" aria-hidden="true">
      {Array.from({ length: PENT_TOTAL }, (_, space) => {
        const home = isSafeGate(space);
        const area = Math.floor(space / (PENT_TOTAL / AREAS.length));
        const owner = home ? homeOwnerOf(state, area) : checkedAt(state.spaces, space);
        const player = owner == null ? undefined : state.players.find((p) => p.id === owner);
        if (!player) return null;
        const point = pentSpace(space);
        const dx = center.x - point.x;
        const dy = center.y - point.y;
        const length = Math.hypot(dx, dy);
        if (!length) return null;
        // Place on the inside lip of the tile, leaving its original pawn centre free.
        const inset = home ? 22 : 17;
        return (
          <g key={space} transform={`translate(${point.x + dx / length * inset} ${point.y + dy / length * inset})`} data-landmark-space={space} data-landmark-owner={player.id}>
            <Landmark built={built.includes(space)} color={areaVar(player.area)} home={home} votes={escrowCount(state, space)} variant={area % 2 === 0 ? "office" : "outpost"} />
          </g>
        );
      })}
    </g>
  );
}

function Landmark({ built, color, home, votes, variant }: { built: boolean; color: string; home: boolean; votes: number; variant: "office" | "outpost" }) {
  const roof = home ? -43 : variant === "office" ? -32 : -23;
  return (
    <g className={`board-landmark ${home ? "board-landmark-home" : "board-landmark-tower"}${built ? " board-landmark-built" : ""}`} style={{ "--landmark-owner": color } as CSSProperties}>
      <ellipse className="landmark-shadow" cx="3" cy="7" rx={home ? 19 : 16} ry="6" />
      <ellipse className="landmark-contact" cx="1" cy="5" rx={home ? 13 : 11} ry="3" />
      <g className="landmark-toy">
        <path className="landmark-base-side" d="M-15 1 0 8 15 1V6L0 13-15 6Z" />
        <path className="landmark-base-top" d="M-15 1 0-6 15 1 0 8Z" />
        {home ? (
          <>
            <path className="landmark-front" d="M-12-22 0-28V5L-12-1Z" />
            <path className="landmark-side" d="M0-28 12-22V-1L0 5Z" />
            <path className="landmark-roof" d="M-14-23 0-30 14-23 0-16Z" />
            <path className="landmark-gold" d="M-7-33 0-37V-20L-7-24Z" />
            <path className="landmark-gold-side" d="M0-37 7-33V-24L0-20Z" />
            <path className="landmark-roof" d="M-9-34 0-43 9-34 0-29Z" />
            <path className="landmark-window" d="M-10-19-7-17V-13L-10-15ZM-5-16-2-14V-10L-5-12ZM3-14 6-16V-12L3-10ZM8-17 10-18V-14L8-13ZM-4-31-2-30V-26L-4-27ZM2-30 4-31V-27L2-26Z" />
            <path className="landmark-door" d="M-8-7-3-4V3L-8 0Z" />
            <path className="landmark-trim" d="M-12-10 0-4 12-10" />
            <path className="landmark-highlight" d="M-12-21V-2M0-15V4" />
            <path className="landmark-star" d="m0-39 1 2 2 .3-1.5 1.4.3 2-1.8-1-1.8 1 .3-2L-3-36.7-1-37Z" />
          </>
        ) : (
          <>
            <path className="landmark-front" d="M-11-15 1-21V5L-11-1Z" />
            <path className="landmark-side" d="M1-21 12-15V-1L1 5Z" />
            {variant === "office" ? (
              <>
                <path className="landmark-front" d="M-11-25 1-31V-8L-11-14Z" />
                <path className="landmark-side" d="M1-31 12-25V-14L1-8Z" />
                <path className="landmark-lid" d="M-13-26 1-33 14-26 1-19Z" />
                <path className="landmark-trim" d="M-11-17 1-11 12-17" />
                <path className="landmark-window" d="M-9-23-6-21V-17L-9-19ZM-4-20-1-18V-14L-4-16ZM4-19 7-21V-17L4-15ZM9-22 11-23V-19L9-18Z" />
                <path className="landmark-roof" d="M-6-28 1-32 8-28 1-24Z" />
              </>
            ) : (
              <>
                <path className="landmark-roof" d="M-14-16-2-24 15-16 2-9Z" />
                <path className="landmark-roof-side" d="M-14-16 2-9 15-16V-13L2-6-14-13Z" />
                <path className="landmark-window" d="M-9-11-6-9V-5L-9-7ZM5-10 9-12V-8L5-6Z" />
              </>
            )}
            <path className="landmark-highlight" d="M-11-14V-1M1-8V4" />
            <path className="landmark-door" d="M-4-6 0-4V4L-4 2Z" />
            <g className="landmark-vote-plaque" transform="translate(10 3)">
              <rect x="-7" y="-6" width="14" height="12" rx="3" />
              <text className="landmark-votes" y="3.2" textAnchor="middle">{votes}</text>
            </g>
          </>
        )}
        <path className="landmark-pole" d={`M8 ${roof + 9}V${roof - 10}`} />
        <circle className="landmark-gold" cx="8" cy={roof - 10} r="1.5" />
        <g className="landmark-flag" transform={`translate(8 ${roof - 8})`}>
          <path className="landmark-front" d="M0 0Q5-2 11 0L11 8Q5 6 0 8Z" />
          <path className="landmark-flag-gloss" d="M2 1Q6 0 9 2" />
          <path className="landmark-symbol" d={home ? "m3 4 3-2 3 2M4 4v2h4V4" : "m3 4 2 2 4-4"} />
        </g>
      </g>
      {built && <g className="landmark-build-sparks"><path d="m-17-18 2-4 2 4 4 2-4 2-2 4-2-4-4-2Zm37-15 1.5-3 1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5Z" /><circle cx="-10" cy="-35" r="1.7" /><circle cx="22" cy="-12" r="1.5" /></g>}
    </g>
  );
}