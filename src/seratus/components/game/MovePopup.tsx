import { useEffect, useRef, useState } from "react";
import { Footprints } from "lucide-react";
import type { GameState, Player } from "@/seratus/game/view";
import { PlayerAvatar } from "./PlayerAvatar";
import { AREA_BG, PHASE_LABEL, phaseDetail } from "./theme";
import { cn } from "@/lib/utils";

const posKey = (p: Player) => `${p.phase}|${p.outerPos}|${p.gatePos}|${p.pentRound}|${p.pentSteps}`;
const DICE_LAND_MS = 2500; // tampil bersamaan dengan pion mulai melompat
const SHOW_MS = 2200;

type Info = { key: number; player: Player; steps: number | null };

/** Pop up 3D yang muncul setiap kali pion berjalan. */
export function MovePopup({ state }: { state: GameState }) {
  const prev = useRef<Record<number, string> | null>(null);
  const lastRollAt = useRef<number | undefined>(undefined);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    const keys = Object.fromEntries(state.players.map((p) => [p.id, posKey(p)]));
    const rollAt = state.log.find((e) => e.text.includes("melempar dadu"))?.at;
    const rolled = rollAt !== lastRollAt.current;
    lastRollAt.current = rollAt;
    const before = prev.current;
    prev.current = keys;
    if (!before) return;
    const moved = state.players.find((p) => before[p.id] !== keys[p.id]);
    if (!moved) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = rolled && !reduce ? DICE_LAND_MS : 0;
    timers.current.forEach(clearTimeout);
    const steps = rolled ? state.lastDice : null;
    timers.current = [
      setTimeout(() => setInfo({ key: Date.now(), player: moved, steps }), delay),
      setTimeout(() => setInfo(null), delay + SHOW_MS),
    ];
  }, [state]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!info) return null;
  const p = info.player;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center" style={{ perspective: 900 }}>
      <div key={info.key} className="move-pop relative flex items-center gap-4 rounded-3xl border-4 border-gold bg-card px-6 py-4 shadow-2xl">
        <div className={cn("move-pop-shine absolute inset-0 rounded-[20px] opacity-20", AREA_BG[p.area])} />
        <PlayerAvatar area={p.area} avatar={p.avatar} size={88} className="move-pop-avatar relative" />
        <div className="relative">
          <div className="font-display text-2xl font-extrabold leading-tight">{p.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-lg font-bold text-primary">
            <Footprints className="size-5" />
            {info.steps ? `Maju ${info.steps} langkah` : "Berpindah"}
          </div>
          <div className="mt-1 inline-block rounded-full bg-gold px-3 py-0.5 text-sm font-bold text-gold-foreground">
            {PHASE_LABEL[p.phase]} · {phaseDetail(p)}
          </div>
        </div>
      </div>
    </div>
  );
}
