import type { GameState } from "@/seratus/game/engine";

/** Human-like bot pause (ms) by situation; `speed` 700 = normal, scaled proportionally. */
export function botThinkMs(s: GameState, speed: number, rnd: () => number = Math.random): number {
  const jitter = (min: number, max: number) => min + rnd() * (max - min);
  let ms: number;
  if (s.stage === "roll") ms = jitter(800, 1400); // pick up the dice
  else if (s.stage === "end") ms = jitter(3500, 4200); // watch dice land and pawn move first
  else {
    const kind = s.pending?.kind;
    switch (kind) {
      case "aspirasi": case "cekfakta": case "misi": case "dilema": case "refleksi": case "duel":
        ms = jitter(3000, 4500); break; // read the card and options
      case "kejutan": ms = jitter(2500, 3500); break;
      case "forum": case "putusan": ms = jitter(1500, 2500); break;
      case "claim": case "forfeit": ms = jitter(1800, 2800); break;
      default: ms = jitter(1200, 2000);
    }
  }
  return Math.round(ms * (speed / 700));
}
