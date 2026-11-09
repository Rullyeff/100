import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { checkedAt } from "@/seratus/lib/checked-at";
import { pawnPos, pentSpace, type Pt } from "@/seratus/game/board";
import { AREAS, currentPlayer, escrowCount, PENT_TOTAL, type GameState, type Player } from "@/seratus/game/view";
import boardArtUrl from "@/seratus/assets/papan-utama-100-suara.jpg";
import { play } from "@/seratus/lib/sfx";
import { avatarOf } from "./PlayerAvatar";
import { DICE_LANDED_MS, PAWN_STEP_MS, pawnRoute } from "./pawn-motion";
import { cardCat, deckCounts, pendingCardId, SPOT_DECKS } from "./decks";

/** Board art is 1000 SVG units wide; the 3D board is 10 world units. */
const U = 100;
const toWorld = (p: { x: number; y: number }) => new THREE.Vector3((p.x - 500) / U, 0, (p.y - 500) / U);
const BOARD_TOP = 0.02;
const HOP_HEIGHT = 0.45;
const OVERVIEW = { pos: new THREE.Vector3(0, 11.5, 8.5), look: new THREE.Vector3(0, 0, 0.4) };
const FOLLOW_OFFSET = new THREE.Vector3(0, 4.2, 3.6);
const CAMERA_EASE = 2.6;

const CARD_SPOTS = [
  { x: 339, y: 291, w: 79, h: 112 },
  { x: 581, y: 291, w: 79, h: 112 },
  { x: 266, y: 535, w: 80, h: 113 },
  { x: 654, y: 535, w: 79, h: 112 },
];

/** Three.js cannot parse OKLCH tokens, so resolve CSS colors through a 2D canvas. */
function cssColor(expr: string, fallback = "#c9a24a") {
  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.color = expr;
  document.documentElement.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return fallback;
  ctx.fillStyle = resolved;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

/** Shared per-frame impulses, outside React state. */
const fx = { shake: 0, focus: null as THREE.Vector3 | null, focusUntil: 0 };

export function Board3D({ state, onOpenCard, drawReady }: { state: GameState; onOpenCard?: (() => void) | undefined; drawReady: boolean }) {
  const [ready, setReady] = useState(false);
  const colors = useMemo(() => ({
    areas: AREAS.map((_, i) => cssColor(`var(--area-${i})`)),
    gold: cssColor("var(--gold)"),
    table: cssColor("var(--primary)", "#3b2a1a"),
    paper: cssColor("var(--paper)", "#f4ead2"),
  }), []);
  return (
    <div className="board-3d-canvas" data-scene-ready={ready ? "" : undefined}>
      <Canvas dpr={[1, 1.75]} camera={{ position: OVERVIEW.pos.toArray(), fov: 40, near: 0.1, far: 80 }} gl={{ antialias: true }}>
        <color attach="background" args={[colors.table]} />
        <fog attach="fog" args={[colors.table, 16, 34]} />
        <hemisphereLight args={["#fff6e0", "#3a2a18", 0.7]} />
        <directionalLight position={[5, 10, 4]} intensity={1.6} color="#fff1d6" />
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
          <Lightformer intensity={1} color="#ffd9a0" position={[-6, 2, -2]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
          <Lightformer intensity={0.8} color="#a0c4ff" position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} />
        </Environment>
        <Table color={colors.table} />
        <Suspense fallback={null}>
          <BoardSlab onDrawn={() => setReady(true)} />
        </Suspense>
        <Owners state={state} colors={colors.areas} paper={colors.paper} />
        <Decks state={state} onOpenCard={onOpenCard} drawReady={drawReady} gold={colors.gold} />
        {state.players.map((p) => (
          <Pawn3D key={p.id} player={p} color={checkedAt(colors.areas, p.area)} active={p.id === currentPlayer(state).id && state.stage !== "over"} rollAt={state.log.find((e) => e.text.includes("melempar dadu"))?.at} />
        ))}
        <CameraRig state={state} />
      </Canvas>
    </div>
  );
}

function Table({ color }: { color: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`;
      g.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * 256;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(80, y + 6, 170, y - 6, 256, y + 2);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [color]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.42}>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial map={tex} roughness={0.75} />
    </mesh>
  );
}

function BoardSlab({ onDrawn }: { onDrawn: () => void }) {
  const art = useLoader(THREE.TextureLoader, boardArtUrl);
  art.colorSpace = THREE.SRGBColorSpace;
  art.anisotropy = 8;
  const drawn = useRef(false);
  useFrame(() => { if (!drawn.current) { drawn.current = true; requestAnimationFrame(onDrawn); } });
  return (
    <group>
      <RoundedBox args={[10.5, 0.4, 10.5]} radius={0.08} position-y={-0.2}>
        <meshStandardMaterial color="#5b3a1f" roughness={0.55} metalness={0.1} />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} position-y={BOARD_TOP}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial map={art} roughness={0.5} metalness={0.02} />
      </mesh>
    </group>
  );
}

function Owners({ state, colors, paper }: { state: GameState; colors: string[]; paper: string }) {
  return (
    <group>
      {Array.from({ length: PENT_TOTAL }, (_, j) => {
        const owner = checkedAt(state.spaces, j);
        if (owner === null) return null;
        const p = toWorld(pentSpace(j));
        const n = escrowCount(state, j);
        return (
          <group key={j} position={[p.x, BOARD_TOP, p.z]}>
            {Array.from({ length: Math.min(6, Math.max(1, Math.ceil(n / 2))) }, (_, k) => (
              <mesh key={k} position-y={0.025 + k * 0.05}>
                <cylinderGeometry args={[0.13, 0.13, 0.045, 20]} />
                <meshStandardMaterial color={k % 2 ? paper : checkedAt(colors, checkedAt(state.players, owner).area)} roughness={0.35} metalness={0.2} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function Decks({ state, onOpenCard, drawReady, gold }: { state: GameState; onOpenCard?: (() => void) | undefined; drawReady: boolean; gold: string }) {
  const pending = pendingCardId(state.pending);
  const activeCat = pending ? cardCat(pending) : null;
  const glow = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(({ clock }) => {
    glow.current.forEach((m) => { if (m) m.emissiveIntensity = 0.4 + Math.sin(clock.elapsedTime * 4) * 0.3; });
  });
  return (
    <group>
      {CARD_SPOTS.map((s, i) => {
        const cat = checkedAt(SPOT_DECKS, i);
        const { left } = deckCounts(state, cat);
        const active = !!onOpenCard && activeCat === cat;
        const c = toWorld({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
        const h = 0.08 + Math.min(left, 40) * 0.006;
        return (
          <group key={cat} position={[c.x, BOARD_TOP, c.z]}>
            <mesh
              position-y={h / 2 + (active && drawReady ? 0.12 : 0)}
              onClick={active ? (e) => { e.stopPropagation(); onOpenCard?.(); } : undefined}
              onPointerOver={active ? () => { document.body.style.cursor = "pointer"; } : undefined}
              onPointerOut={() => { document.body.style.cursor = ""; }}
            >
              <boxGeometry args={[s.w / U * 0.92, h, s.h / U * 0.92]} />
              <meshStandardMaterial
                ref={(m) => { if (m) glow.current[i] = m; }}
                color={active ? gold : "#efe4c8"}
                emissive={active ? gold : "#000000"}
                emissiveIntensity={active ? 0.5 : 0}
                transparent
                opacity={active ? 0.95 : 0.35}
                roughness={0.4}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function makeAvatarTexture(src: string | undefined, ring: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const paint = (img?: HTMLImageElement) => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = ring;
    g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.clip();
    g.fillStyle = "#f4ead2"; g.fillRect(0, 0, 128, 128);
    if (img) g.drawImage(img, 10, 6, 108, 108);
    g.restore();
    t.needsUpdate = true;
  };
  paint();
  if (src) { const img = new Image(); img.onload = () => paint(img); img.src = src; }
  return t;
}

const pawnProfile = [
  [0, 0], [0.24, 0], [0.25, 0.05], [0.2, 0.09], [0.13, 0.16], [0.09, 0.36], [0.14, 0.42], [0.07, 0.46], [0, 0.47],
].map(([x, y]) => new THREE.Vector2(x, y));

function Pawn3D({ player, color, active, rollAt }: { player: Player; color: string; active: boolean; rollAt: number | undefined }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const before = useRef(player);
  const lastRoll = useRef(rollAt);
  const motion = useRef<{ route: THREE.Vector3[]; start: number } | null>(null);
  const offset = useMemo(() => new THREE.Vector3(((player.id % 3) - 1) * 0.12, 0, (Math.floor(player.id / 3) - 0.5) * 0.12), [player.id]);
  const avatar = useMemo(() => makeAvatarTexture(avatarOf(player)?.src, color), [player.avatar, color]);
  const here = (p: Pt) => toWorld(p).add(offset);

  useEffect(() => {
    const old = before.current;
    const rolled = lastRoll.current !== rollAt;
    before.current = player;
    lastRoll.current = rollAt;
    const route = pawnRoute(old, player);
    if (route.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { motion.current = null; return; }
    const start = performance.now() + (rolled ? DICE_LANDED_MS : 0);
    motion.current = { route: route.map(here), start };
    const taps = route.slice(1).map((_, k) => window.setTimeout(() => { if (!document.hidden) play("hop", { step: k }); }, start - performance.now() + (k + 0.85) * PAWN_STEP_MS));
    return () => taps.forEach((t) => window.clearTimeout(t));
  }, [player.phase, player.outerPos, player.gatePos, player.pentSteps, player.pentRound, player.area, rollAt]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const m = motion.current;
    const target = here(pawnPos(player));
    let y = 0;
    if (m) {
      const t = (performance.now() - m.start) / PAWN_STEP_MS;
      const last = m.route.length - 1;
      if (t >= last) { motion.current = null; g.position.copy(target); fx.shake = Math.max(fx.shake, 0.25); }
      else {
        const k = Math.max(0, Math.floor(t));
        const f = Math.max(0, t - k);
        g.position.lerpVectors(checkedAt(m.route, k), checkedAt(m.route, k + 1), f);
        y = Math.sin(f * Math.PI) * HOP_HEIGHT;
        if (active) { fx.focus = g.position.clone(); fx.focusUntil = performance.now() + 900; }
      }
    } else g.position.copy(target);
    g.position.y = BOARD_TOP + y + (active && !m ? Math.sin(clock.elapsedTime * 3) * 0.03 + 0.03 : 0);
    if (ring.current) { ring.current.visible = active; ring.current.rotation.z = clock.elapsedTime; }
  });

  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005} scale={1}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.01}>
        <ringGeometry args={[0.32, 0.38, 6]} />
        <meshBasicMaterial color="#ffd54a" />
      </mesh>
      <group scale={player.phase === "out" ? 0.8 : 1.25}>
        <mesh>
          <latheGeometry args={[pawnProfile, 28]} />
          <meshStandardMaterial color={color} roughness={0.28} metalness={0.35} transparent={player.phase === "out"} opacity={player.phase === "out" ? 0.4 : 1} />
        </mesh>
        <sprite position-y={0.72} scale={0.5}>
          <spriteMaterial map={avatar} depthWrite={false} />
        </sprite>
      </group>
    </group>
  );
}

function CameraRig({ state }: { state: GameState }) {
  const controls = useRef<OrbitImpl>(null);
  const { camera } = useThree();
  const look = useRef(OVERVIEW.look.clone());
  const user = useRef(0);
  const rollAt = state.log.find((e) => e.text.includes("melempar dadu"))?.at;
  useEffect(() => { if (rollAt) fx.shake = 0.6; }, [rollAt]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now();
    const following = fx.focus && now < fx.focusUntil && now - user.current > 2500;
    const idle = now - user.current > 4000;
    if (following && fx.focus) {
      const goalLook = fx.focus;
      const goalPos = goalLook.clone().add(FOLLOW_OFFSET);
      const k = 1 - Math.exp(-CAMERA_EASE * dt);
      look.current.lerp(goalLook, k);
      camera.position.lerp(goalPos, k);
    } else if (idle) {
      const k = 1 - Math.exp(-CAMERA_EASE * 0.5 * dt);
      look.current.lerp(OVERVIEW.look, k);
      camera.position.lerp(OVERVIEW.pos, k);
    }
    if (fx.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * fx.shake * 0.08;
      camera.position.y += (Math.random() - 0.5) * fx.shake * 0.08;
      fx.shake *= Math.exp(-6 * dt);
    }
    if (controls.current && (following || idle)) controls.current.target.copy(look.current);
    controls.current?.update();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={4}
      maxDistance={17}
      minPolarAngle={0.15}
      maxPolarAngle={1.15}
      onStart={() => { user.current = performance.now(); }}
      onEnd={() => { user.current = performance.now(); }}
    />
  );
}
