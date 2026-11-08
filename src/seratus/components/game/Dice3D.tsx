import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { play } from "@/seratus/lib/sfx";
import { StarBurst } from "./StarBurst";
import { DICE_FLIGHT_MS } from "./pawn-motion";
import { shakeTable } from "./table-impact";

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

// Muka kubus: nilai → transformasi muka, dan rotasi kubus agar nilai menghadap depan
const FACES: { v: number; t: string }[] = [
  { v: 1, t: "rotateY(0deg)" },
  { v: 6, t: "rotateY(180deg)" },
  { v: 2, t: "rotateY(90deg)" },
  { v: 5, t: "rotateY(-90deg)" },
  { v: 3, t: "rotateX(90deg)" },
  { v: 4, t: "rotateX(-90deg)" },
];
const SHOW: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  2: [0, -90],
  5: [0, 90],
  3: [-90, 0],
  4: [90, 0],
};
const pose = (v: number | null, extraX = 0, extraY = 0) => {
  const [x, y] = SHOW[v ?? 1] ?? [0, 0];
  return `rotateX(${x - 18 + extraX}deg) rotateY(${y + 24 + extraY}deg)`;
};

export function Cube({ value, size, style, cubeRef }: { value: number | null; size: number; style?: React.CSSProperties; cubeRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div className="dice3d-scene" style={{ width: size, height: size, ...style }}>
      <div ref={cubeRef} className="dice3d-cube" style={{ transform: pose(value), ["--half" as string]: `${size / 2}px` }}>
        {FACES.map((f) => (
          <div key={f.v} className="dice3d-face" style={{ transform: `${f.t} translateZ(var(--half))` }}>
            {(PIPS[f.v] ?? []).map(([r, c], i) => (
              <span key={i} className="dice3d-pip" style={{ top: `${25 + r * 25}%`, left: `${25 + c * 25}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dadu 3D di panel + lemparan menuju wadah di sudut meja. */
export function Dice3D({
  value,
  rollKey,
  canThrow = false,
  shaking = false,
  onThrow,
}: {
  value: number | null;
  rollKey: number;
  canThrow?: boolean;
  shaking?: boolean;
  onThrow?: () => void;
}) {
  const [grabbed, setGrabbed] = useState(false);
  const homeRef = useRef<HTMLElement | null>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const flyCube = useRef<HTMLDivElement>(null);
  const lastKey = useRef(rollKey);
  const [flying, setFlying] = useState<number | null>(null);
  const [landingBurst, setLandingBurst] = useState<{ key: number; x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const screen = homeRef.current?.closest<HTMLElement>(".game-screen");
    if (!screen) return;
    screen.dataset['dicePhase'] = flying !== null ? "flying" : shaking ? "shaking" : "resting";
    return () => { delete screen.dataset['dicePhase']; };
  }, [flying, shaking]);

  useEffect(() => { if (shaking) play("rattle"); }, [shaking]);

  useEffect(() => {
    if (rollKey === lastKey.current || !value) return;
    lastKey.current = rollKey;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { play("clack"); return; }
    setFlying(rollKey);
  }, [rollKey, value]);

  useEffect(() => {
    if (flying === null || !flyRef.current || !flyCube.current) return;
    const home = homeRef.current?.getBoundingClientRect();
    const tray = [...document.querySelectorAll<HTMLElement>(".dice-tray-floor")].find((el) => el.getBoundingClientRect().width > 0);
    const landing = tray?.getBoundingClientRect();
    const board = (document.querySelector(".game-board-viewport:not(.hidden *)") as HTMLElement | null)?.getBoundingClientRect();
    const size = 44;
    const tx = landing?.width ? landing.left + landing.width / 2 : board?.width ? board.left + board.width / 2 : window.innerWidth / 2;
    const ty = landing?.width ? landing.top + landing.height / 2 : board?.width ? board.top + board.height / 2 : window.innerHeight / 2;
    // Every roll is thrown from the hand control into the tray, so the dice always travels visibly.
    const sx = home?.width ? home.left + home.width / 2 : Math.max(50, tx - 160);
    const sy = home?.width ? home.top + home.height / 2 : Math.max(100, ty - 90);
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy);
    // Lemparan nyata: cepat, melengkung tinggi, memantul dua kali, lalu berhenti
    // Fisika bertenaga ~3 detik: lempar cepat, jatuh bergravitasi, dua pantulan mengecil, lalu diam (~2.5s, sinkron dengan pion)
    const duration = DICE_FLIGHT_MS;
    const UP = "cubic-bezier(.2,.7,.4,1)"; // melambat menuju puncak
    const DOWN = "cubic-bezier(.6,0,.9,.5)"; // percepatan gravitasi
    const impact = tray?.animate(
      [
        { transform: "translate(0,0)" }, { transform: "translate(-2px,4px)" },
        { transform: "translate(2px,-1px)" }, { transform: "translate(0,0)" },
      ],
      { duration: 260, delay: duration * 0.45, easing: "ease-out" },
    );
    const arc = Math.min(170, Math.max(110, dist * 0.35), Math.max(70, sy - 40));
    const at = (f: number, lift: number, s: number, sq = 1) =>
      `translate(${sx - size / 2 + dx * f + Math.sin(f * Math.PI) * 30}px, ${sy - size / 2 + dy * f - lift}px) scale(${s * (2 - sq)}, ${s * sq})`;
    const move = flyRef.current.animate(
      [
        { transform: at(0, 0, 1), opacity: 1, offset: 0, easing: UP },
        { transform: at(0.45, arc, 1.6), offset: 0.22, easing: DOWN }, // puncak
        { transform: at(0.9, 0, 1, 0.78), offset: 0.45, easing: UP }, // benturan keras + gepeng
        { transform: at(0.95, arc * 0.28, 1.12), offset: 0.57, easing: DOWN },
        { transform: at(0.98, 0, 1, 0.88), offset: 0.68, easing: UP }, // pantulan kedua
        { transform: at(0.995, arc * 0.07, 1.06), offset: 0.75, easing: DOWN },
        { transform: at(1, 0, 1, 0.96), offset: 0.81, easing: "ease-out" },
        { transform: at(1, 0, 1), offset: 0.85 }, // berhenti
        { transform: at(1, 0, 1), opacity: 1, offset: 1 },
      ],
      { duration, fill: "forwards" },
    );
    const shadowEl = flyRef.current.querySelector(".dice3d-shadow");
    const shadow =
      shadowEl instanceof HTMLElement
        ? shadowEl.animate(
            [
              { transform: "scale(0.8)", opacity: 0.3, offset: 0, easing: UP },
              { transform: "scale(1.8)", opacity: 0.06, offset: 0.22, easing: DOWN },
              { transform: "scale(1.1)", opacity: 0.55, offset: 0.45 },
              { transform: "scale(1.3)", opacity: 0.25, offset: 0.57 },
              { transform: "scale(1)", opacity: 0.5, offset: 0.68 },
              { transform: "scale(1)", opacity: 0.5, offset: 1 },
            ],
            { duration, fill: "forwards" },
          )
        : null;
    // Putaran liar multi-poros di udara, direm setiap benturan, berakhir tepat di angka hasil
    const spinX = 1080 + 360 * (flying % 2);
    const spinY = 1440;
    const spinZ = 360 * (flying % 3 === 0 ? -1 : 1);
    const tumble = flyCube.current.animate(
      [
        { transform: pose(value, 0, 0) + " rotateZ(0deg)", offset: 0, easing: "linear" },
        { transform: pose(value, spinX * 0.8, spinY * 0.8) + ` rotateZ(${spinZ * 0.8}deg)`, offset: 0.45, easing: "ease-out" },
        { transform: pose(value, spinX - 40, spinY - 25) + ` rotateZ(${spinZ * 0.95}deg)`, offset: 0.68, easing: "ease-out" },
        { transform: pose(value, spinX + 6, spinY + 4) + ` rotateZ(${spinZ}deg)`, offset: 0.8, easing: "ease-in-out" },
        { transform: pose(value, spinX, spinY) + ` rotateZ(${spinZ}deg)`, offset: 0.86 },
        { transform: pose(value, spinX, spinY) + ` rotateZ(${spinZ}deg)`, offset: 1 },
      ],
      { duration, fill: "forwards" },
    );
    move.onfinish = () => setFlying(null);
    // Sounds follow the flight: whoosh on release, then one clack per bounce (matching the keyframe offsets).
    play("throw");
    const sounds = ([[0.45, 1], [0.68, 0.55], [0.81, 0.3]] as const).map(([at, strength]) =>
      window.setTimeout(() => play("clack", { strength }), duration * at),
    );
    const tableImpact = window.setTimeout(shakeTable, duration * .45);
    const sparkle = window.setTimeout(() => setLandingBurst({ key: flying, x: tx, y: ty }), duration * 0.81);
    return () => {
      window.clearTimeout(sparkle);
      window.clearTimeout(tableImpact);
      sounds.forEach((t) => window.clearTimeout(t));
      move.cancel();
      tumble.cancel();
      shadow?.cancel();
      impact?.cancel();
    };
  }, [flying, value]);

  return (
    <>
      {landingBurst && <StarBurst key={landingBurst.key} point={landingBurst} />}
      {canThrow || shaking ? (
        <Button
          variant="ghost"
          type="button"
          data-sfx="off"
          ref={(node) => { homeRef.current = node; }}
          aria-label="Lempar dadu (klik atau tarik dadunya)"
          title="Klik atau tarik dadu untuk melempar"
          disabled={!canThrow}
          onPointerDown={(e) => {
            if (!canThrow) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setGrabbed(true);
          }}
          onPointerUp={() => {
            if (!grabbed) return;
            setGrabbed(false);
            onThrow?.();
          }}
          onPointerCancel={() => setGrabbed(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onThrow?.();
            }
          }}
          className={cn(
            "dice3d-home shrink-0 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-gold",
            "h-14 w-14 p-0",
            canThrow && !shaking && "dice3d-ready cursor-grab",
            grabbed && "dice3d-grabbed cursor-grabbing",
            shaking && "dice3d-shaking",
          )}
        >
          {value === null ? <Cube value={null} size={56} /> : <Hand className="size-7 text-primary" />}
        </Button>
      ) : (
        <div ref={(node) => { homeRef.current = node; }} className="dice3d-home flex size-14 shrink-0 items-center justify-center">
          {value === null ? <Cube value={null} size={56} /> : <Hand className="size-7 text-muted-foreground" aria-hidden="true" />}
        </div>
      )}
      {mounted && flying !== null &&
        createPortal(
          <div ref={flyRef} aria-hidden className="dice3d-flight pointer-events-none fixed left-0 top-0 z-[45]" style={{ opacity: 0 }}>
            <div className="dice3d-shadow" />
            <div className="dice-flight-trail">
              {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} />)}
            </div>
            <Cube value={value} size={44} cubeRef={flyCube} />
          </div>,
          document.body,
        )}
    </>
  );
}
