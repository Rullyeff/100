import { CheckCircle2, Coins, Flag, RotateCw } from "lucide-react";
import {
  AREAS,
  GATE_LEN,
  PENT_TOTAL,
  currentPlayer,
  getActor,
  isEligibleForGate,
  stockCount,
  type GameState,
} from "@/seratus/game/view";
import { cn } from "@/lib/utils";
import { AREA_BG, PHASE_LABEL } from "./theme";
import { TabletopPawn } from "./TabletopPawn";

export function instruction(s: GameState): string {
  const p = currentPlayer(s);
  if (s.stage === "over") return s.final?.stage === "done" ? "Permainan selesai" : "Final Democracy Test berlangsung";
  if (s.stage === "end") return "Baca hasil, lalu akhiri giliran";
  if (s.stage === "pending") {
    const k = s.pending?.kind;
    if (k === "putusan" || (k === "forum" && s.pending && "stance" in s.pending && s.pending.stance !== null)) {
      const a = getActor(s);
      return typeof a === "number" ? `${s.players[a].name} memberi suara rahasia` : "Voting berlangsung";
    }
    if (k === "claim") return "Putuskan klaim petak Pentagon (jaminkan 4 suara)";
    if (k === "duel") return "Duel: kedua pemain mengunci jawaban";
    if (k === "forfeit" && s.pending?.kind === "forfeit") return `${s.players[s.pending.payer].name} memilih apa yang diserahkan`;
    return "Ambil kartu dan jawab pertanyaan";
  }
  if (p.phase === "outer") return isEligibleForGate(s, p) ? "Lempar dadu untuk masuk Gerbang Demokrasi" : "Lempar dadu dan melangkah ke area";
  if (p.phase === "gate") return p.gatePos >= GATE_LEN ? "Lempar dadu untuk mengisi Gerbang Aman" : "Lempar dadu di jalur Gerbang";
  return "Lempar dadu dan kelilingi Pentagon";
}

export const PHASE_GUIDE: Record<string, string> = {
  outer: "Kumpulkan 16 suara di tangan",
  gate: "Putusan Rakyat di tiap petak gerbang",
  pentagon: "Putaran 1 klaim · Putaran 2 duel & perebutan",
  done: "Menunggu pemain lain",
  out: "Gugur",
};

export function HudStrip({ state }: { state: GameState }) {
  const p = currentPlayer(state);
  const stocks = AREAS.map((_, i) => stockCount(state, i));
  const stock = stocks.reduce((a, b) => a + b, 0);
  const ok = state.tokens.length === 100 && new Set(state.tokens.map(t=>t.id)).size===100;
  const phases = (["outer", "gate", "pentagon"] as const).map((ph) => state.players.filter((x) => x.phase === ph).length);

  return (
    <div className="game-hud grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Hud label="Giliran Pemain">
        <div className="flex items-center gap-3">
          <TabletopPawn area={p.area} />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-extrabold">{state.stage === "over" ? "—" : p.name}</div>
            <div className="text-xs text-muted-foreground">{instruction(state)}</div>
          </div>
        </div>
      </Hud>
      <Hud label="Fase Permainan">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-gold">
            <Flag className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-display text-base font-extrabold">{state.stage === "over" ? "Hasil Akhir" : PHASE_LABEL[p.phase]}</div>
            <div className="text-xs text-muted-foreground">{state.stage === "over" ? "Penghitungan suara sah" : PHASE_GUIDE[p.phase]}</div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5">Luar {phases[0]}</span>
          <span className="rounded bg-muted px-1.5">Gerbang {phases[1]}</span>
          <span className="rounded bg-muted px-1.5">Pentagon {phases[2]}</span>
        </div>
      </Hud>
      <Hud label="Total Suara">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground">
            <Coins className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-extrabold leading-none">100</span>
              {ok && <CheckCircle2 className="size-4 text-success" aria-label="Invarian 100 suara sah" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {100 - stock} beredar · {stock} di stok area
            </div>
          </div>
        </div>
        <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" title="Sisa stok per area">
          {stocks.map((n, i) => (
            <div key={i} className={cn("h-full", AREA_BG[i])} style={{ width: `${n}%` }} title={`${AREAS[i].name}: ${n}/20`} />
          ))}
        </div>
      </Hud>
      <Hud label="Ronde / Putaran">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-gold">
            <RotateCw className="size-5" />
          </span>
          <div>
            <div className="font-display text-2xl font-extrabold leading-none">Ronde {state.turnCount}</div>
            <div className="text-xs text-muted-foreground">
              {p.phase === "pentagon" ? `Putaran ${p.pentRound}${p.pentRound <= 2 ? "/2" : " (tambahan)"} · ${p.pentSteps}/${PENT_TOTAL} langkah` : p.phase === "gate" ? `Gerbang ${p.gatePos}/${GATE_LEN}` : "Putaran Pentagon 0/2"}
              {state.extended && <span className="block">Target {state.extended.target} suara sah</span>}
            </div>
          </div>
        </div>
      </Hud>
    </div>
  );
}

function Hud({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-t-4 border-t-gold bg-card p-3 shadow-card">
      <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-primary">{label}</div>
      {children}
    </div>
  );
}
