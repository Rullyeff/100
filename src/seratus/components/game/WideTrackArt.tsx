import { checkedAt } from "@/seratus/lib/checked-at";
import boardArt from "@/seratus/assets/papan-utama-100-suara.jpg";
import { gateSpace, outerSpace, pentSpace, startSpace, VIEW, type Pt } from "@/seratus/game/board";
import { AREAS, GATE_LEN, isSafeGate, OUTER_TOTAL, PENT_TOTAL } from "@/seratus/game/view";
import { GATE_TILE_COLORS, OUTER_TILE_COLORS, PENT_TILE_COLORS, START_TILE_COLORS } from "./board-palette";

export const TRACK_SIZE = {
  outer: { width: 29, height: 28, sourceWidth: 27, sourceHeight: 27 },
  gate: { width: 42, height: 27, sourceWidth: 30, sourceHeight: 26 },
  pent: { width: 26, height: 34, sourceWidth: 24, sourceHeight: 24 },
  safe: { width: 36, height: 36, sourceWidth: 30, sourceHeight: 30 },
};

type TileSize = (typeof TRACK_SIZE)["outer"];
const dark = (hex: string, pct: number) => `color-mix(in oklab, ${hex}, var(--relief-ink) ${pct}%)`;

/**
 * Satu petak sebagai balok mainan: bayangan lembut + sisi bawah tebal di bawah
 * permukaan karya seni. Sisi bawah digeser ke arah bawah layar (bukan arah
 * rotasi petak) supaya terlihat diekstrusi saat papan dimiringkan.
 * Murni presentasi; indeks petak dan pusat pion tidak berubah.
 */
function TileBlock({ point, size, color, lift, special = false }: { point: Pt; size: TileSize; color: string; lift: number; special?: boolean }) {
  const w = size.width;
  const h = size.height;
  const rad = (point.rot * Math.PI) / 180;
  const dx = lift * Math.sin(rad);
  const dy = lift * Math.cos(rad);
  return (
    <g transform={`translate(${point.x} ${point.y})`}>
      <ellipse cx="2" cy={h / 2 + lift + 2} rx={w * 0.65} ry={h * 0.32} fill="var(--relief-shadow)" />
      <g transform={`rotate(${point.rot})`}>
        {/* Sisi bawah balok, tampak di bawah permukaan petak */}
        {[1, .75, .5, .25].map((depth) => <rect key={depth} x={-w / 2 + dx * depth} y={-h / 2 + dy * depth} width={w} height={h} rx="3" fill={dark(color, 48)} stroke={dark(color, 68)} strokeWidth="0.8" />)}
        {special && (
          <rect x={-w / 2 - 2.2 + dx * 0.5} y={-h / 2 - 2.2 + dy * 0.5} width={w + 4.4} height={h + 4.4} rx="4.5" fill="none" stroke="var(--gold)" strokeWidth="1.7" opacity="0.95" />
        )}
        {/* Permukaan petak: potongan karya seni yang dikalibrasi */}
        <svg x={-w / 2} y={-h / 2} width={w} height={h} viewBox={`${-size.sourceWidth / 2} ${-size.sourceHeight / 2} ${size.sourceWidth} ${size.sourceHeight}`} preserveAspectRatio="none" overflow="hidden">
          <g transform={`rotate(${-point.rot}) translate(${-point.x} ${-point.y})`}>
            <image href={boardArt} width={VIEW} height={VIEW} />
          </g>
        </svg>
        {/* Kilau glossy seperti permukaan vinyl */}
        <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.5} rx="3" fill="url(#tileGloss)" opacity={special ? 0.5 : 0.32} />
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="3" fill="none" stroke="var(--relief-highlight)" strokeWidth="1.1" />
      </g>
    </g>
  );
}

export function WideTrackArt() {
  return (
    <g className="wide-track-art" aria-hidden="true" pointerEvents="none">
      {/* Petak biasa lebih dulu, petak istimewa yang terangkat digambar terakhir */}
      {Array.from({ length: OUTER_TOTAL }, (_, i) => (
        <TileBlock key={`o${i}`} point={outerSpace(i)} size={TRACK_SIZE.outer} color={checkedAt(OUTER_TILE_COLORS, i)} lift={9} />
      ))}
      {AREAS.flatMap((_, area) =>
        Array.from({ length: GATE_LEN }, (_, k) => (
          <TileBlock key={`g${area}-${k}`} point={gateSpace(area, k + 1)} size={TRACK_SIZE.gate} color={checkedAt(GATE_TILE_COLORS, area * GATE_LEN + k)} lift={9} />
        )),
      )}
      {Array.from({ length: PENT_TOTAL }, (_, i) =>
        isSafeGate(i) ? null : <TileBlock key={`p${i}`} point={pentSpace(i)} size={TRACK_SIZE.pent} color={checkedAt(PENT_TILE_COLORS, i)} lift={11} />,
      )}
      {/* Petak START tiap area: balok emas yang lebih tinggi */}
      {AREAS.map((_, area) => (
        <TileBlock key={`s${area}`} point={startSpace(area)} size={TRACK_SIZE.outer} color={checkedAt(START_TILE_COLORS, area)} lift={14} special />
      ))}
      {/* Gerbang Aman di sudut Pentagon: terangkat dan berbingkai emas */}
      {Array.from({ length: PENT_TOTAL }, (_, i) =>
        isSafeGate(i) ? <TileBlock key={`p${i}`} point={pentSpace(i)} size={TRACK_SIZE.safe} color={checkedAt(PENT_TILE_COLORS, i)} lift={14} special /> : null,
      )}
    </g>
  );
}

const STAR = "500,455 521,498 570,505 534,539 543,585 500,564 457,585 466,539 430,505 479,498";

/** A gold relief with an artwork top, below pawns and interactive spaces. */
export function CenterRelief() {
  return <g className="center-relief" aria-hidden="true" pointerEvents="none">
    <defs><clipPath id="center-star-relief"><polygon points={STAR} /></clipPath></defs>
    <ellipse cx="503" cy="575" rx="66" ry="27" fill="var(--relief-shadow)" />
    {[18, 14, 10, 6, 2].map((depth) => <polygon key={depth} points={STAR} transform={`translate(0 ${depth})`} fill="var(--landmark-gold-shade)" stroke="var(--relief-ink)" strokeWidth="1.4" strokeLinejoin="round" />)}
    <image href={boardArt} width={VIEW} height={VIEW} clipPath="url(#center-star-relief)" />
    <polygon points={STAR} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M500 457 480 499 433 506" fill="none" stroke="var(--relief-highlight)" strokeWidth="2.5" strokeLinecap="round" />
  </g>;
}
