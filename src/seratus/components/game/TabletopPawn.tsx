import { useId } from "react";
import { areaVar } from "./theme";

/** Printed tabletop pawn portrait; never changes the projected player position. */
export function TabletopPawn({ area }: { area: number }) {
  const id = useId().replaceAll(":", "");
  return <svg viewBox="0 0 48 60" className="tabletop-pawn" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" x2="1"><stop offset="0" stopColor={`color-mix(in oklab, ${areaVar(area)}, var(--foreground) 45%)`} /><stop offset=".38" stopColor={areaVar(area)} /><stop offset=".55" stopColor={`color-mix(in oklab, ${areaVar(area)}, var(--paper) 40%)`} /><stop offset="1" stopColor={areaVar(area)} /></linearGradient></defs>
    <ellipse cx="24" cy="55" rx="20" ry="4" fill="var(--table-shadow)" />
    <path d="M9 47 Q15 39 18 23 L30 23 Q33 39 39 47 Q44 55 24 56 Q4 55 9 47Z" fill={`url(#${id})`} stroke={areaVar(area)} />
    <ellipse cx="24" cy="47" rx="16" ry="4" fill={`url(#${id})`} stroke="var(--piece-highlight)" />
    <circle cx="24" cy="14" r="11" fill={`url(#${id})`} stroke={areaVar(area)} />
    <ellipse cx="20" cy="10" rx="4" ry="2.5" fill="var(--piece-highlight)" transform="rotate(-35 20 10)" />
  </svg>;
}