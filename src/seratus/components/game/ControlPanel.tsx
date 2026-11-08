import { useEffect, useRef, useState } from "react";
import { Bot, Hand, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentPlayer, GATE_LEN, type Action, type GameState } from "@/seratus/game/view";
import { Dice3D } from "./Dice3D";
import { DiceTray } from "./DiceTray";
import { DiceRollButton } from "./DiceRollButton";

export function ControlPanel({
  state,
  dispatch,
  canAct,
  actorName,
  needsReveal,
  onReveal,
  testDice,
  variant = "panel",
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  canAct: boolean;
  actorName: string;
  needsReveal: boolean;
  onReveal: () => void;
  testDice: boolean;
  variant?: "panel" | "dock";
}) {
  const p = currentPlayer(state);
  const over = state.stage === "over";
  const rollOk = canAct && state.stage === "roll";
  const endOk = canAct && state.stage === "end";
  const actorIsTurn = actorName === p.name;

  // Kocok dadu sebentar di tempat sebelum benar-benar dilempar ke papan
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (shakeTimer.current) clearTimeout(shakeTimer.current); }, []);
  const throwDice = (v?: number) => {
    if (!rollOk || shaking || shakeTimer.current) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return dispatch({ type: "ROLL", ...(v ? { value: v } : {}) });
    setShaking(true);
    shakeTimer.current = setTimeout(() => {
      shakeTimer.current = null;
      setShaking(false);
      dispatch({ type: "ROLL", ...(v ? { value: v } : {}) });
    }, 650);
  };

  if (variant === "dock") {
    // Desktop: a slim dock tucked into the board's lower-left corner.
    return (
      <section aria-label="Kontrol aksi" className="board-dock">
        <DiceTray value={state.lastDice} />
        <div className="board-dock-row">
          <Dice3D
            value={state.lastDice}
            rollKey={state.log.find((e) => e.text.includes("melempar dadu"))?.at ?? 0}
            canThrow={rollOk && !shaking}
            shaking={shaking}
            onThrow={() => throwDice()}
          />
          <DiceRollButton compact disabled={!rollOk || shaking} shaking={shaking} onRoll={() => throwDice()} />
        </div>
        {testDice && rollOk && (
          <div className="board-dock-test">
            {[1, 2, 3, 4, 5, 6].map((v) => (
              <Button key={v} variant="outline" disabled={shaking} onClick={() => throwDice(v)} aria-label={`Dadu bernilai ${v}`}>{v}</Button>
            ))}
          </div>
        )}
        <div className="board-dock-row">
          <Button variant="outline" className="board-dock-btn text-success border-success" disabled={!needsReveal} onClick={onReveal} aria-label="Ambil kartu" title="Ambil kartu">
            <Hand />
          </Button>
          <Button variant="outline" className="board-dock-btn text-destructive border-destructive" disabled={!endOk} onClick={() => dispatch({ type: "END_TURN" })} aria-label="Akhiri giliran" title="Akhiri giliran">
            <SkipForward />
          </Button>
        </div>
        {!canAct && !over && (
          <div className="board-dock-wait" title={`${actorName} ${actorIsTurn ? "bermain" : "memilih"}…`}>
            <Bot className="animate-pulse" /> <span>{actorName}</span>
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Kontrol aksi" className="rounded-2xl border bg-card p-4 shadow-card">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aksi Giliran</h2>
      <div className="mt-3 flex items-center gap-4">
        <Dice3D
          value={state.lastDice}
          rollKey={state.log.find((e) => e.text.includes("melempar dadu"))?.at ?? 0}
          canThrow={rollOk && !shaking}
          shaking={shaking}
          onThrow={() => throwDice()}
        />
        <div className="min-w-0 flex-1 text-sm">
          <div className="text-xs text-muted-foreground">{rollOk ? (shaking ? "Mengocok dadu…" : "Klik / tarik dadu untuk melempar") : "Angka dadu terakhir"}</div>
          <div className="font-display text-3xl font-extrabold leading-none">{state.lastDice ?? "–"}</div>
          {!canAct && !over && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Bot className="size-3.5 animate-pulse" /> {actorName} {actorIsTurn ? "bermain" : "memilih"}…
            </div>
          )}
        </div>
      </div>

      <div className="ctl-buttons mt-4 grid gap-2">
        <DiceRollButton disabled={!rollOk || shaking} shaking={shaking} onRoll={() => throwDice()} />
        {testDice && rollOk && (
          <div className="grid grid-cols-6 gap-1">
            {[1, 2, 3, 4, 5, 6].map((v) => (
              <Button key={v} size="sm" variant="outline" disabled={shaking} onClick={() => throwDice(v)} aria-label={`Dadu bernilai ${v}`}>
                {v}
              </Button>
            ))}
          </div>
        )}
        <div className="ctl-pair grid grid-cols-2 gap-2">
          <Button variant="outline" className="text-success border-success" disabled={!needsReveal} onClick={onReveal} title="Ambil kartu">
            <Hand /> <span className="ctl-label">Ambil Kartu</span>
          </Button>
          <Button variant="outline" className="text-destructive border-destructive" disabled={!endOk} onClick={() => dispatch({ type: "END_TURN" })} title="Akhiri giliran">
            <SkipForward /> <span className="ctl-label">Akhiri Giliran</span>
          </Button>
        </div>
      </div>
      {p.phase === "gate" && p.gatePos >= GATE_LEN && state.stage === "roll" && (
        <p className="mt-2 text-xs text-muted-foreground">Lemparan berikutnya membawa {p.name} langsung ke Gerbang Aman.</p>
      )}
    </section>
  );
}
