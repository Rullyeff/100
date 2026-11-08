import { useEffect, useRef } from "react";
import { pawnPos } from "@/seratus/game/board";
import { type Player } from "@/seratus/game/view";
import { avatarOf } from "./PlayerAvatar";
import { areaVar } from "./theme";
import { play } from "@/seratus/lib/sfx";
import { DICE_LANDED_MS, PAWN_STEP_MS, pawnHopFrames, pawnRoute, pawnTravelMs } from "./pawn-motion";

/** Presentation-only movement; positions always come from the server state. */
export function BoardPawn({ player, active, rollAt }: { player: Player; active: boolean; rollAt: number | undefined }) {
  const group = useRef<SVGGElement>(null);
  const before = useRef(player);
  const lastRoll = useRef(rollAt);
  const pt = pawnPos(player);
  useEffect(() => {
    const old = before.current;
    const rolled = lastRoll.current !== rollAt;
    before.current = player;
    lastRoll.current = rollAt;
    const from = pawnPos(old);
    const to = pawnPos(player);
    if (!group.current || (from.x === to.x && from.y === to.y)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const route = pawnRoute(old, player);
    const duration = pawnTravelMs(route);
    const delay = rolled ? DICE_LANDED_MS : 0;
    const animation = group.current.animate(pawnHopFrames(route, mobile), { duration, delay, fill: "backwards" });
    // One tap per landed space, timed to the keyframes above.
    const steps = route.length - 1;
    const taps = Array.from({ length: steps }, (_, k) =>
      window.setTimeout(() => { if (!document.hidden) play("hop", { step: k }); }, delay + (k + .85) * PAWN_STEP_MS),
    );
    return () => { animation.cancel(); taps.forEach((t) => window.clearTimeout(t)); };
    // Polling returns fresh player objects; only actual position changes may restart a hop.
  }, [player.id, player.phase, player.outerPos, player.gatePos, player.pentSteps, player.pentRound, player.area, rollAt]);
  return (
    <g ref={group} data-pawn={player.id} style={{ transform: `translate(${pt.x}px, ${pt.y}px)` }} opacity={player.phase === "out" ? .35 : 1}>
      <title>{`${player.name}`}</title>
      <g className="pawn-stand" transform="scale(1.7)">
      <ellipse cy="8" rx="14" ry="5" fill="var(--table-shadow)" />
      {active && <ellipse className="pawn-active-ring" cy="7" rx="18" ry="7" fill="none" stroke="var(--destination)" strokeWidth="3" />}
      <g className={active ? "pawn-idle" : undefined}><g className={active ? "pawn-body pawn-body-active" : "pawn-body"} filter="url(#drop)">
        <ellipse cy="6" rx="12" ry="5" fill={areaVar(player.area)} stroke="var(--board-edge)" strokeWidth="1.5" />
        <path d="M-10,4 Q-9,-3 -5,-9 L5,-9 Q9,-3 10,4 Q0,10 -10,4Z" fill={`url(#pawn${player.area})`} stroke="var(--board-edge)" strokeWidth="1.2" />
        <circle cy="-18" r="14" fill={`url(#pawn${player.area})`} stroke="var(--paper)" strokeWidth="2.5" />
        <clipPath id={`avclip${player.id}`}><circle cy="-18" r="12" /></clipPath>
        <image href={avatarOf(player).src} x="-12" y="-31" width="24" height="24" clipPath={`url(#avclip${player.id})`} preserveAspectRatio="xMidYMin slice" />
        <ellipse cx="-4" cy="-26" rx="4" ry="2" fill="var(--piece-highlight)" />
      </g></g>
      </g>
    </g>
  );
}