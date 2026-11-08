import { checkedAt } from "@/seratus/lib/checked-at";
// Geometri papan SVG (viewBox 1000×1000) yang menempel tepat di atas gambar
// "Board Utama 100 SUARA" (1600×1600 px). Koordinat dicatat dalam piksel gambar
// lalu diskalakan; indeks petak tetap mengikuti mesin aturan.
import { GATE_LEN, OUTER_PER_AREA, PENT_TOTAL, safeGateOf, type Player } from "./view";

export const VIEW = 1000;
const S = VIEW / 1600;
const deg = (d: number) => (d * Math.PI) / 180;

export interface Pt {
  x: number;
  y: number;
  rot: number;
}

type XY = readonly [number, number];
const px = ([x, y]: XY, rot = 0): Pt => ({ x: +(x * S).toFixed(2), y: +(y * S).toFixed(2), rot });

/** Lingkar petak lengan Pendidikan (lurus) sebagai acuan; lengan lain dipetakan secara afin. */
const COLS = [658.8, 702.8, 747.2, 799.6, 851.2, 896, 940];
const ROWS = [277.2, 322, 366.4];
/** Searah jarum jam mulai dari petak setelah START (kolom, baris). */
const RING: XY[] = [[4, 0], [5, 0], [6, 0], [6, 1], [6, 2], [5, 2], [4, 2], [3, 2], [2, 2], [1, 2], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0]];

interface Arm {
  /** Sel acuan (kolom 0, baris 0), (kolom 6, baris 0), (kolom 0, baris 2) pada gambar. */
  a: XY;
  b: XY;
  d: XY;
  /** Gerbang petak 1 (dekat lingkar) dan petak 5 (dekat Pentagon). */
  g1: XY;
  g5: XY;
}
const ARMS: Arm[] = [
  { a: [658.8, 277.2], b: [940, 277.2], d: [658.8, 366.4], g1: [799.6, 424], g5: [799.6, 600] },
  { a: [1285, 535], b: [1377.5, 806], d: [1205, 565], g1: [1192.5, 717.5], g5: [1022.5, 772.5] },
  { a: [1254, 1205], b: [1039, 1385], d: [1198.5, 1136], g1: [1052.5, 1185], g5: [937.5, 1047.5] },
  { a: [540, 1377.5], b: [332.5, 1187.5], d: [601, 1312.5], g1: [535, 1172.5], g5: [657.5, 1045] },
  { a: [225, 815], b: [302, 546], d: [309, 841], g1: [400, 720], g5: [565, 772] },
];

/** Petak Pentagon: sudut = Gerbang Aman, tiga bendera di tiap sisi (searah jarum jam). */
const PENT: XY[] = [
  [801, 665], [848.5, 695], [883.5, 722.5], [918.5, 750],
  [965, 790], [952.5, 850], [938.5, 892.5], [923.5, 937.5],
  [901.5, 1000], [845, 1002.5], [800, 1002.5], [755, 1002.5],
  [697.5, 1000], [675, 935], [660, 892.5], [650, 850],
  [634, 790], [680, 745], [715, 720], [750, 692.5],
];
const PENT_EDGE_ROT = [36, 36, 36, 108, 108, 108, 180, 180, 180, 252, 252, 252, 324, 324, 324];
const CENTER: XY = [800, 835];

function armMap(area: number, [x, y]: XY): Pt {
  const { a, b, d } = checkedAt(ARMS, area);
  const u = (x - checkedAt(COLS, 0)) / (checkedAt(COLS, 6) - checkedAt(COLS, 0));
  const v = (y - checkedAt(ROWS, 0)) / (checkedAt(ROWS, 2) - checkedAt(ROWS, 0));
  const rot = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return px([a[0] + u * (b[0] - a[0]) + v * (d[0] - a[0]), a[1] + u * (b[1] - a[1]) + v * (d[1] - a[1])], +rot.toFixed(2));
}

export function outerSpace(i: number): Pt {
  const area = Math.floor(i / OUTER_PER_AREA);
  const [c, r] = checkedAt(RING, i % OUTER_PER_AREA);
  return armMap(area, [checkedAt(COLS, c), checkedAt(ROWS, r)]);
}

export function startSpace(area: number): Pt {
  return armMap(area, [checkedAt(COLS, 3), checkedAt(ROWS, 0)]);
}

export function gateSpace(area: number, n: number): Pt {
  // n = 1 paling dekat lingkar, n = GATE_LEN paling dekat Pentagon
  const { g1, g5 } = checkedAt(ARMS, area);
  const t = GATE_LEN <= 1 ? 1 : (Math.max(1, Math.min(GATE_LEN, n)) - 1) / (GATE_LEN - 1);
  const rot = (Math.atan2(g5[1] - g1[1], g5[0] - g1[0]) * 180) / Math.PI + 90;
  return px([g1[0] + (g5[0] - g1[0]) * t, g1[1] + (g5[1] - g1[1]) * t], +rot.toFixed(2));
}

export function pentSpace(j: number): Pt {
  const k = ((j % PENT_TOTAL) + PENT_TOTAL) % PENT_TOTAL;
  const edge = k % 4 === 0 ? 0 : checkedAt(PENT_EDGE_ROT, Math.floor(k / 4) * 3 + (k % 4) - 1);
  return px(checkedAt(PENT, k), edge);
}

/** Pita tertutup melalui seluruh petak lingkar `area` (untuk sorotan jalur aktif). */
export function armBandPath(area: number) {
  const pts = [startSpace(area), ...Array.from({ length: OUTER_PER_AREA }, (_, k) => outerSpace(area * OUTER_PER_AREA + k))];
  return pts.map((pt, k) => `${k ? "L" : "M"}${pt.x},${pt.y}`).join(" ") + " Z";
}

export const boardCenter = (): Pt => px(CENTER);

export function pawnPos(p: Player): Pt {
  const off = deg(p.id * 72 - 90);
  const jitter = (pt: Pt, r = 8): Pt => ({ x: pt.x + Math.cos(off) * r, y: pt.y + Math.sin(off) * r, rot: 0 });
  if (p.phase === "done") return jitter(boardCenter(), 30);
  if (p.phase === "out") return startSpace(p.area);
  if (p.phase === "pentagon") return jitter(pentSpace((safeGateOf(p.area) + p.pentSteps) % PENT_TOTAL));
  if (p.phase === "gate") return jitter(gateSpace(p.area, Math.max(1, Math.min(GATE_LEN, p.gatePos))), 5);
  if (p.outerPos < 0) return startSpace(p.area);
  return jitter(outerSpace(p.outerPos));
}
