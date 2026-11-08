import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { DECK_INFO, DECK_VAR, type DeckCat } from "./decks";

/** Presentation-only: the top card lifts off its board deck and flies to the centre, then the card dialog takes over. */
export function CardDrawFx({ cat, from }: { cat: DeckCat; from: DOMRect }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(220, vw * 0.5, vh * 0.42);
  const h = w * 1.4;
  const cx = vw / 2;
  const cy = vh / 2;
  const d = DECK_INFO[cat];
  const style = {
    width: w,
    height: h,
    left: cx - w / 2,
    top: cy - h / 2,
    "--dx": `${from.left + from.width / 2 - cx}px`,
    "--dy": `${from.top + from.height / 2 - cy}px`,
    "--s": String(Math.max(0.12, from.width / w)),
    "--deck": DECK_VAR[cat],
  } as CSSProperties;
  return (
    <div className="card-draw-fx" aria-hidden="true">
      <div className="card-draw-fx-dim" />
      <div className="card-draw-fx-card" style={style}>
        <div className={cn("card-draw-fx-back bg-card-weave", d.bg)}>
          <strong>100</strong>
          <span>SUARA</span>
          <small>{d.name}</small>
        </div>
      </div>
    </div>
  );
}
