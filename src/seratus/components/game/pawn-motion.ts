import { checkedAt } from "@/seratus/lib/checked-at";
import { pawnPos, type Pt } from "@/seratus/game/board";
import { GATE_LEN, OUTER_PER_AREA, OUTER_TOTAL, PENT_TOTAL, type Player } from "@/seratus/game/view";

export const DICE_FLIGHT_MS = 3000;
export const DICE_LANDED_MS = DICE_FLIGHT_MS * 0.85;
export const PAWN_STEP_MS = 280;

/** Only interpolate the projected journey; never infer or apply game actions. */
export function pawnRoute(old: Player, next: Player): Pt[] {
  const from = pawnPos(old);
  const to = pawnPos(next);
  if (from.x === to.x && from.y === to.y) return [];
  const route = [from];
  const visit = (patch: Partial<Player>) => route.push(pawnPos({ ...old, ...patch }));
  if (old.phase === "outer" && next.phase === "outer") {
    const start = old.outerPos < 0 ? old.area * OUTER_PER_AREA - 1 : old.outerPos;
    const forward = (next.outerPos - start + OUTER_TOTAL) % OUTER_TOTAL;
    const backward = (start - next.outerPos + OUTER_TOTAL) % OUTER_TOTAL;
    const distance = forward <= 12 ? forward : backward <= 12 ? -backward : 0;
    for (let k = 1; k < Math.abs(distance); k++) {
      visit({ outerPos: (start + k * Math.sign(distance) + OUTER_TOTAL) % OUTER_TOTAL });
    }
  } else if (next.phase === "gate" && (old.phase === "outer" || old.phase === "gate")) {
    const start = old.phase === "outer" ? 0 : old.gatePos;
    const direction = Math.sign(next.gatePos - start);
    for (let k = start + direction; direction && k !== next.gatePos; k += direction) visit({ phase: "gate", gatePos: k });
  } else if (next.phase === "pentagon" && (old.phase === "gate" || old.phase === "outer")) {
    for (let k = old.phase === "gate" ? old.gatePos + 1 : 1; k <= GATE_LEN; k++) visit({ phase: "gate", gatePos: k });
  } else if (old.phase === "pentagon" && (next.phase === "pentagon" || next.phase === "done")) {
    const end = next.pentRound > old.pentRound || next.phase === "done" ? PENT_TOTAL : next.pentSteps;
    for (let k = old.pentSteps + 1; k < end; k++) visit({ pentSteps: k });
    if (next.phase === "done") visit({ pentSteps: 0 });
  }
  route.push(to);
  return route;
}

export const pawnTravelMs = (route: Pt[]) => Math.max(0, route.length - 1) * PAWN_STEP_MS;

export function pawnHopFrames(route: Pt[], mobile: boolean): Keyframe[] {
  if (route.length < 2) return [];
  const lift = mobile ? 28 : 20;
  const translate = (x: number, y: number, sx = 1, sy = 1) => `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
  const frames: Keyframe[] = [{ transform: translate(checkedAt(route, 0).x, checkedAt(route, 0).y), offset: 0 }];
  const steps = route.length - 1;
  for (let k = 1; k <= steps; k++) {
    const a = checkedAt(route, k - 1), b = checkedAt(route, k);
    frames.push(
      { transform: translate(a.x, a.y, 1.08, .92), offset: (k - 1 + .12) / steps, easing: "cubic-bezier(.2,.7,.4,1)" },
      { transform: translate((a.x + b.x) / 2, (a.y + b.y) / 2 - lift, .98, 1.06), offset: (k - 1 + .5) / steps, easing: "cubic-bezier(.6,0,.9,.5)" },
      { transform: translate(b.x, b.y, 1.1, .9), offset: (k - 1 + .85) / steps, easing: "ease-out" },
      { transform: translate(b.x, b.y), offset: k / steps },
    );
  }
  return frames;
}