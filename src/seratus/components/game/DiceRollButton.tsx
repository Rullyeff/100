import { useEffect, useRef, useState } from "react";
import { Dice5 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { diceCharge } from "./dice-charge";

/** Hold/release is cosmetic; releasing dispatches the same ordinary roll. */
export function DiceRollButton({ disabled, shaking, onRoll, compact = false }: {
  disabled: boolean; shaking: boolean; onRoll: () => void; compact?: boolean;
}) {
  const [charging, setCharging] = useState(false);
  const [power, setPower] = useState(0);
  const held = useRef(false);
  const frame = useRef(0);
  const input = useRef<"pointer" | "keyboard" | null>(null);
  const stop = () => {
    held.current = false;
    input.current = null;
    cancelAnimationFrame(frame.current);
    setCharging(false);
    setPower(0);
  };
  const start = (source: "pointer" | "keyboard") => {
    if (disabled || held.current) return;
    held.current = true;
    input.current = source;
    setCharging(true);
    const began = performance.now();
    const tick = (now: number) => {
      if (!held.current) return;
      setPower(diceCharge(now - began));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  const release = () => {
    if (!held.current) return;
    stop();
    if (!disabled) onRoll();
  };
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);
  useEffect(() => {
    const cancel = () => stop();
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, []);

  return (
    <div className={cn("dice-charge-control", charging && "dice-charge-active", compact && "dice-charge-compact")}>
      <Button
        type="button" variant="default" disabled={disabled}
        aria-label="Lempar dadu" aria-pressed={charging}
        title="Tahan lalu lepaskan untuk melempar dadu"
        className="dice-roll-button dice-charge-button"
        onPointerDown={(e) => {
          if (e.button !== 0 || disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start("pointer");
        }}
        onPointerUp={() => { if (input.current === "pointer") release(); }}
        onPointerCancel={stop}
        onLostPointerCapture={() => { if (input.current === "pointer") stop(); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { stop(); return; }
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!e.repeat) start("keyboard");
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (input.current === "keyboard") release();
          }
        }}
        onBlur={stop}
        onClick={(e) => { if (e.detail === 0 && !held.current) onRoll(); }}
      >
        <Dice5 aria-hidden="true" />
        {!compact && <span>{shaking ? "Mengocok…" : charging ? "Siap!" : "Lempar Dadu"}</span>}
      </Button>
      <div className="dice-energy" role="meter" aria-label="Tenaga lemparan visual" aria-valuemin={0} aria-valuemax={100} aria-valuenow={power}>
        <div className="dice-energy-fill" style={{ transform: `scaleX(${power / 100})` }} />
        <span className="dice-energy-marker" style={{ left: `${power}%` }} />
      </div>
    </div>
  );
}