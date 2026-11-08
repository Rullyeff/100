import { checkedAt } from "@/seratus/lib/checked-at";
import { BoardPawn } from "./BoardPawn";
import { useCallback, useEffect, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Box, Minus, Plus, RotateCcw, Square } from "lucide-react";
import {
  AREAS,
  currentPlayer,
  escrowCount,
  GATE_LEN,
  homeOwnerOf,
  isSafeGate,
  OUTER_TOTAL,
  outerArea,
  outerKejutanSub,
  outerType,
  PENT_TOTAL,
  safeGateOf,
  type GameState,
} from "@/seratus/game/view";
import boardArtUrl from "@/seratus/assets/papan-utama-100-suara.jpg";
const boardArt = { url: boardArtUrl };
import { Button } from "@/components/ui/button";
import { armBandPath, gateSpace, outerSpace, pentSpace, VIEW } from "@/seratus/game/board";
import { areaVar } from "./theme";
import { cardCat, DECK_INFO, DECK_VAR, deckCounts, pendingCardId, SPOT_DECKS } from "./decks";
import { cn } from "@/lib/utils";
import { BoardPlayers } from "./BoardPlayers";
import { InspectableSpace, SpaceTooltip, TableLightParticles, TabletopDecor, type SpaceInspection } from "./BoardAtmosphere";
import { CenterRelief, TRACK_SIZE, WideTrackArt } from "./WideTrackArt";
import { BoardLandmarks } from "./BoardLandmarks";

const TYPE_NAME: Record<string, string> = {
  A1: "Aspirasi Mudah",
  A2: "Aspirasi Sedang",
  A3: "Aspirasi Sulit (SJT)",
  D: "Demokrasi",
  K: "Kejutan",
  E: "Petak Kosong",
};
const TYPE_DESCRIPTION: Record<string, string> = {
  A1: "Jawab kartu Aspirasi tingkat mudah di area ini.",
  A2: "Jawab kartu Aspirasi tingkat sedang di area ini.",
  A3: "Jawab kartu Aspirasi sulit berbentuk situasi dan pilihan tindakan (SJT).",
  D: "Buka kartu Demokrasi: Cek Fakta, Dilema, atau Refleksi. Jika Misi aktif, buka kartu Misi.",
  E: "Petak istirahat: tidak ada kartu yang dibuka saat mendarat di sini.",
};
const mix = (c: string, w: string, pct: number) => `color-mix(in oklab, ${c}, ${w} ${pct}%)`;
const LOUPE_SIZE = 170;
const LOUPE_ZOOM = 2.4;

/** Posisi keempat gambar kartu pada gambar papan (diskalakan dari 1600px). */
const CARD_SPOTS = [
  { x: 339, y: 291, w: 79, h: 112 },
  { x: 581, y: 291, w: 79, h: 112 },
  { x: 266, y: 535, w: 80, h: 113 },
  { x: 654, y: 535, w: 79, h: 112 },
];

export function GameBoard({ state, onOpenCard, drawReady = false, overlay }: { state: GameState; onOpenCard?: (() => void) | undefined; drawReady?: boolean; overlay?: ReactNode }) {
  const pendingCard = pendingCardId(state.pending);
  const activeCat = pendingCard ? cardCat(pendingCard) : null;
  const [zoom, setZoom] = useState(1);
  const [inspected, setInspected] = useState<SpaceInspection | null>(null);
  const dismissInspection = useCallback(() => setInspected(null), []);
  const [loupe, setLoupe] = useState<{ x: number; y: number; vx: number; vy: number; span: number } | null>(null);
  const rollAt = state.log.find((e) => e.text.includes("melempar dadu"))?.at;
  const cur = currentPlayer(state);
  const curPentSpace = cur.phase === "pentagon" ? (safeGateOf(cur.area) + cur.pentSteps) % PENT_TOTAL : -1;
  const curOuter = cur.phase === "outer" ? cur.outerPos : -1;
  const [tilt, setTilt] = useBoardTilt();
  useEffect(() => { setInspected(null); setLoupe(null); }, [zoom, tilt]);

  return (
    <div className="game-board tabletop-board relative rounded-3xl border bg-card p-2 shadow-card">
      <div className="absolute right-4 top-4 z-10 flex gap-1">
        {[
          { l: tilt ? "Tampilan datar" : "Tampilan meja 3D", i: tilt ? <Square className="size-4" /> : <Box className="size-4" />, f: () => setTilt(!tilt), on: tilt },
          { l: "Perbesar papan", i: <Plus className="size-4" />, f: () => setZoom((z) => Math.min(2.2, z + 0.3)) },
          { l: "Perkecil papan", i: <Minus className="size-4" />, f: () => setZoom((z) => Math.max(1, z - 0.3)) },
          { l: "Atur ulang zoom", i: <RotateCcw className="size-4" />, f: () => setZoom(1) },
        ].map((b) => (
          <Button key={b.l} size="icon" variant="outline" aria-label={b.l} title={b.l} aria-pressed={"on" in b ? b.on : undefined} className="size-9 bg-card/90" onClick={() => { dismissInspection(); setLoupe(null); b.f(); }}>
            {b.i}
          </Button>
        ))}
      </div>
      <div className={cn("game-board-viewport overflow-auto rounded-2xl", tilt && "board-3d")}>
        <div className="board-stage">
        <div className="board-slab" style={{ width: `${zoom * 100}%` }}>
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Papan 100 SUARA: ${OUTER_TOTAL} petak Jalur Luar, ${GATE_LEN * 5} Gerbang Demokrasi, ${PENT_TOTAL} Pentagon Demokrasi`}
          className="block h-auto w-full"
          onPointerMove={(e) => {
            // The loupe maps flat screen coordinates; skip it while the board is tilted.
            if (e.pointerType !== "mouse" || tilt) return;
            const r = e.currentTarget.getBoundingClientRect();
            const hostElement = e.currentTarget.closest(".game-board");
            if (!hostElement) return;
            const host = hostElement.getBoundingClientRect();
            const scale = VIEW / r.width;
            setLoupe({
              x: e.clientX - host.left,
              y: e.clientY - host.top,
              vx: (e.clientX - r.left) * scale,
              vy: (e.clientY - r.top) * scale,
              span: (LOUPE_SIZE * scale) / LOUPE_ZOOM,
            });
          }}
          onPointerLeave={() => setLoupe(null)}
        >
          <defs>
            <radialGradient id="skyGlow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" style={{ stopColor: "var(--paper)", stopOpacity: 0.92 }} />
              <stop offset="70%" style={{ stopColor: "var(--paper)", stopOpacity: 0.55 }} />
              <stop offset="100%" style={{ stopColor: "var(--paper)", stopOpacity: 0.15 }} />
            </radialGradient>
            <radialGradient id="emblemG" cx="50%" cy="35%" r="70%">
              <stop offset="0%" style={{ stopColor: mix("var(--gold)", "white", 55) }} />
              <stop offset="100%" style={{ stopColor: "var(--gold)" }} />
            </radialGradient>
            {AREAS.map((_, i) => (
              <radialGradient key={i} id={`pawn${i}`} cx="35%" cy="30%" r="75%">
                <stop offset="0%" style={{ stopColor: mix(areaVar(i), "white", 60) }} />
                <stop offset="45%" style={{ stopColor: areaVar(i) }} />
                <stop offset="100%" style={{ stopColor: mix(areaVar(i), "black", 40) }} />
              </radialGradient>
            ))}
            <filter id="drop" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="black" floodOpacity="0.3" />
            </filter>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="black" floodOpacity="0.22" />
            </filter>
            <linearGradient id="tileGloss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.55" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g id="board-root">
          {/* Gambar Board Utama 100 SUARA; petak interaktif menempel di atasnya */}
          <rect width={VIEW} height={VIEW} fill="var(--board)" />
          <image href={boardArt.url} width={VIEW} height={VIEW} preserveAspectRatio="xMidYMid meet" />
          <WideTrackArt />
          <TabletopDecor />
          <CenterRelief />

          {/* Sorotan jalur area pemain aktif */}
          <path d={armBandPath(cur.area)} className="active-route" fill="none" stroke="var(--destination)" strokeWidth="4" strokeDasharray="7 6" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" style={{ filter: "none" }} />

          {/* Jalur Luar */}
          {Array.from({ length: OUTER_TOTAL }, (_, i) => {
            const pt = outerSpace(i);
            const t = outerType(i);
            const area = outerArea(i);
            const here = i === curOuter;
            const name = t === "K" ? `Kejutan ${outerKejutanSub(i) === "kesempatan" ? "Kesempatan" : "Peristiwa"}` : TYPE_NAME[t];
            const label = `L${i + 1} · ${name} · ${checkedAt(AREAS, area).name}`;
            const description = t === "K" ? `Buka kartu ${outerKejutanSub(i) === "kesempatan" ? "Kesempatan" : "Peristiwa"} dan ikuti dampaknya pada permainan.` : TYPE_DESCRIPTION[t];
            return (
              <InspectableSpace key={`o${i}`} id={`o${i}`} label={label} description={description} point={pt} here={here} inspected={inspected?.id === `o${i}`} onInspect={setInspected} {...TRACK_SIZE.outer}>
                {here && <circle className="destination-halo" r="22" fill="none" stroke="var(--destination)" strokeWidth="4" />}
                <rect transform={`rotate(${pt.rot})`} x="-13.5" y="-13.5" width="27" height="27" rx="3" fill="transparent" stroke={here ? "var(--gold)" : "none"} strokeWidth="3.5" />
              </InspectableSpace>
            );
          })}

          {/* Gerbang Demokrasi */}
          {AREAS.map((_, a) =>
            Array.from({ length: GATE_LEN }, (_, k) => {
              const n = k + 1;
              const pt = gateSpace(a, n);
              const here = cur.phase === "gate" && cur.area === a && cur.gatePos === n;
              const label = `Gerbang Demokrasi ${checkedAt(AREAS, a).name} · petak ${n} · Putusan Rakyat`;
              return (
                <InspectableSpace key={`g${a}-${n}`} id={`g${a}-${n}`} label={label} description="Memicu Putusan Rakyat: pemain lain memberikan suara atas keputusan bersama." point={pt} here={here} inspected={inspected?.id === `g${a}-${n}`} onInspect={setInspected} {...TRACK_SIZE.gate}>
                  {here && <circle className="destination-halo" r="20" fill="none" stroke="var(--destination)" strokeWidth="4" />}
                  <rect transform={`rotate(${pt.rot})`} x="-15" y="-13" width="30" height="26" rx="3" fill="transparent" stroke={here ? "var(--gold)" : "none"} strokeWidth="3.5" />
                </InspectableSpace>
              );
            }),
          )}

          {/* Pentagon */}
          {Array.from({ length: PENT_TOTAL }, (_, j) => {
            const pt = pentSpace(j);
            const owner = checkedAt(state.spaces, j);
            const safe = isSafeGate(j);
            const gateArea = Math.floor(j / (PENT_TOTAL / AREAS.length));
            const here = j === curPentSpace;
            const homeOwner = checkedAt(state.players, homeOwnerOf(state, gateArea));
            const label = safe
              ? `Gerbang Aman ${checkedAt(AREAS, gateArea).name} · milik ${homeOwner?.name ?? "-"}`
              : `Pentagon P${j + 1} · ${owner === null ? "netral" : `milik ${checkedAt(state.players, owner).name} (${escrowCount(state, j)} suara)`}`;
            return (
              <InspectableSpace key={`p${j}`} id={`p${j}`} label={label} description={safe ? "Gerbang Aman dengan pemilik yang tercatat di papan. Pada putaran lanjutan Pentagon, tantang pemilik jika bukan milikmu." : "Petak dapat diklaim dengan menjaminkan suara di tangan. Suara jaminan tetap sah; pemilik dan jaminannya ditampilkan di papan."} point={pt} here={here} inspected={inspected?.id === `p${j}`} onInspect={setInspected} {...(safe ? TRACK_SIZE.safe : TRACK_SIZE.pent)}>
                {here && <circle className="destination-halo" r="22" fill="none" stroke="var(--destination)" strokeWidth="4" />}
                {safe ? (
                  <circle r="14" fill="transparent" stroke={homeOwner && homeOwner.area !== gateArea ? areaVar(homeOwner.area) : here ? "var(--gold)" : "none"} strokeWidth="4" />
                ) : owner !== null ? (
                  <g filter="url(#soft)">
                    <circle r="11" fill={areaVar(checkedAt(state.players, owner).area)} stroke="var(--paper)" strokeWidth="2" />
                    <text y="3.8" textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--on-deck)">{escrowCount(state, j)}</text>
                  </g>
                ) : (
                  <rect transform={`rotate(${pt.rot})`} x="-12" y="-12" width="24" height="24" rx="3" fill="transparent" stroke={here ? "var(--gold)" : "none"} strokeWidth="3.5" />
                )}
              </InspectableSpace>
            );
          })}

          {/* Miniatur di bibir dalam petak; pusat dan hit area tetap tidak berubah. */}
          <BoardLandmarks state={state} />

          {/* Pion berdimensi dengan lompatan per petak */}
          {state.players.map((p) => <BoardPawn key={p.id} player={p} active={p.id === cur.id && state.stage !== "over"} rollAt={rollAt} />)}

          {/* Empat dek kartu di papan: dek yang menunggu menyala dan bisa diketuk */}
          {CARD_SPOTS.map((s, i) => {
            const cat = checkedAt(SPOT_DECKS, i);
            const { left, total } = deckCounts(state, cat);
            const active = !!onOpenCard && activeCat === cat;
            const ready = active && drawReady;
            const name = DECK_INFO[cat].name;
            const open = () => onOpenCard?.();
            return (
              <g
                key={`card-spot-${cat}`}
                data-deck-spot={cat}
                className={cn("board-deck", active && "board-card-spot", ready && "board-deck-ready")}
                {...(active
                  ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": ready ? `Ambil kartu ${name}` : `Lihat kartu ${name}`,
                      onClick: open,
                      onKeyDown: (e: ReactKeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } },
                    }
                  : { role: "img", "aria-label": `Dek ${name}, sisa ${left} kartu` })}
              >
                <title>{`Dek ${name} · sisa ${left} dari ${total}${ready ? " — klik untuk mengambil" : ""}`}</title>
                {/* Alas emas bertingkat di bawah tiap dek, seperti nampan kartu di meja */}
                <rect x={s.x - 6} y={s.y - 6 + 8} width={s.w + 12} height={s.h + 12} rx="13" fill="var(--slab-edge-deep)" opacity="0.85" />
                {[18, 14, 10, 6].map((depth) => <rect key={depth} x={s.x} y={s.y + depth} width={s.w} height={s.h} rx="8" fill="var(--relief-card-edge)" stroke="var(--relief-card-line)" strokeWidth="1.5" pointerEvents="none" />)}
                <rect x={s.x - 6} y={s.y - 6} width={s.w + 12} height={s.h + 12} rx="13" fill="var(--gold)" opacity="0.5" stroke="var(--on-deck)" strokeWidth="1.5" />
                <rect className="board-deck-face" x={s.x} y={s.y} width={s.w} height={s.h} rx="10" fill="transparent" />
                {activeCat && !active && <rect className="board-deck-dim" x={s.x} y={s.y} width={s.w} height={s.h} rx="10" />}
                {active && (
                  <>
                    <rect x={s.x - 5} y={s.y - 5} width={s.w + 10} height={s.h + 10} rx="14" fill="none" stroke="var(--gold)" strokeWidth="7" className="board-card-spot-ring" />
                    {/* Kartu teratas terangkat dengan warna deknya, supaya jelas dek mana yang harus diambil */}
                    <g className="board-deck-lift" style={{ "--deck": DECK_VAR[cat] } as CSSProperties}>
                      <rect x={s.x + 3} y={s.y + 3} width={s.w - 6} height={s.h - 6} rx="9" fill="var(--deck)" stroke="var(--on-deck)" strokeWidth="4" />
                      <rect x={s.x + 10} y={s.y + 10} width={s.w - 20} height={s.h - 20} rx="5" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
                      <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 2} textAnchor="middle" fontSize="24" fontWeight="900" fill="var(--gold)">100</text>
                      <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 17} textAnchor="middle" fontSize="9" fontWeight="900" letterSpacing="2.5" fill="var(--on-deck)">SUARA</text>
                    </g>
                  </>
                )}
                <g className={cn("board-deck-count", active && "board-deck-count-active")} transform={`translate(${s.x + s.w - 4} ${s.y + 4})`}>
                  <circle r="19" strokeWidth="2.5" />
                  <text y="5.5" textAnchor="middle" fontSize={left > 99 ? 14 : 17} fontWeight="900">{left}</text>
                </g>
                {ready && (
                  <g className="board-deck-tag" transform={`translate(${s.x + s.w / 2} ${s.y + s.h + 2})`}>
                    <rect x="-40" y="-14" width="80" height="28" rx="14" fill="var(--gold)" stroke="var(--on-deck)" strokeWidth="2.5" />
                    <text y="5.5" textAnchor="middle" fontSize="16" fontWeight="900" letterSpacing="1" fill="var(--gold-foreground)">AMBIL</text>
                  </g>
                )}
              </g>
            );
          })}
          </g>
        </svg>
        </div>
        </div>
        <TableLightParticles />
        <BoardPlayers state={state} />
        {overlay}
      </div>
      {loupe && !inspected && (
        <div
          className="board-loupe"
          aria-hidden="true"
          style={{ left: loupe.x - LOUPE_SIZE / 2, top: loupe.y - LOUPE_SIZE / 2, width: LOUPE_SIZE, height: LOUPE_SIZE }}
        >
          <svg
            viewBox={`${loupe.vx - loupe.span / 2} ${loupe.vy - loupe.span / 2} ${loupe.span} ${loupe.span}`}
            width="100%"
            height="100%"
          >
            <rect x={-VIEW} y={-VIEW} width={VIEW * 3} height={VIEW * 3} fill="var(--board)" />
            <use href="#board-root" />
          </svg>
        </div>
      )}
      {inspected && <SpaceTooltip space={inspected} onDismiss={dismissInspection} />}
      <div className="game-board-legend flex flex-wrap gap-x-4 gap-y-1 px-3 pb-1 pt-2 text-xs text-muted-foreground">
        <Legend color="var(--deck-a)" label="Kotak suara: Aspirasi (2 Mudah · 5 Sedang · 10 Sulit)" />
        <Legend color="var(--deck-d)" label="Timbangan: Demokrasi" />
        <Legend color="var(--deck-k)" label="Hadiah: Kejutan" />
        <Legend color="var(--paper)" label="Polos: petak kosong" />
        <Legend color="var(--deck-r)" label={`Tangan: Putusan Rakyat · Gerbang 1–${GATE_LEN}`} />
        <Legend color="var(--deck-p)" label="Bendera: Pentagon · ikon area = Gerbang Aman" />
      </div>
    </div>
  );
}

const TILT_KEY = "100suara:board-3d";

/** Tilted tabletop view (desktop only, CSS); the choice is remembered, default on. */
function useBoardTilt() {
  const [tilt, setTiltState] = useState(true);
  useEffect(() => {
    if (localStorage.getItem(TILT_KEY) === "0") setTiltState(false);
  }, []);
  const setTilt = (v: boolean) => {
    setTiltState(v);
    localStorage.setItem(TILT_KEY, v ? "1" : "0");
  };
  return [tilt, setTilt] as const;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
