import { CheckCircle2, Coins, Flag, History, RotateCw } from "lucide-react";
import { currentPlayer, GATE_LEN, PENT_TOTAL, type GameState } from "@/seratus/game/view";
import { cn } from "@/lib/utils";
import { instruction, PHASE_GUIDE } from "./HudStrip";
import { HistoryDialog, icon } from "./LogPanel";
import { TabletopPawn } from "./TabletopPawn";
import { AREA_BG, PHASE_LABEL } from "./theme";

const TONE = { info: "", gain: "text-success", loss: "text-destructive", system: "text-primary" } as const;

/** Top-left board corner: whose turn it is, what to do, and the phase. */
export function BoardTurn({ state }: { state: GameState }) {
  const p = currentPlayer(state);
  const over = state.stage === "over";
  return (
    <section aria-label="Giliran pemain" className="bhud bhud-tl">
      <div className="bhud-turn">
        <TabletopPawn area={p.area} />
        <div className="min-w-0">
          <div className="bhud-name">{over ? "Hasil Akhir" : p.name}</div>
          <div className="bhud-hint">{instruction(state)}</div>
        </div>
      </div>
      <div className="bhud-phase" title={over ? "Penghitungan suara sah" : PHASE_GUIDE[p.phase]}>
        <Flag aria-hidden />
        <span>{over ? "Selesai" : PHASE_LABEL[p.phase]}</span>
        {!over && <em>{PHASE_GUIDE[p.phase]}</em>}
      </div>
    </section>
  );
}

/** Top-right board corner: the 100-vote total, the round, and the latest activity. */
export function BoardStatus({ state }: { state: GameState }) {
  const p = currentPlayer(state);
  const ok = state.tokens.length === 100 && new Set(state.tokens.map((t) => t.id)).size === 100;
  const round =
    p.phase === "pentagon"
      ? `Putaran ${p.pentRound}${p.pentRound <= 2 ? "/2" : "+"} · ${p.pentSteps}/${PENT_TOTAL}`
      : p.phase === "gate"
        ? `Gerbang ${p.gatePos}/${GATE_LEN}`
        : null;
  const latest = state.log.slice(0, 3);
  return (
    <section aria-label="Status permainan" className="bhud bhud-tr">
      <div className="bhud-stats">
        <span className="bhud-stat" title={ok ? "100 suara sah" : "Total suara"}>
          <Coins aria-hidden /> <b>100</b> {ok && <CheckCircle2 className="text-success" aria-label="Invarian 100 suara sah" />}
        </span>
        <span className="bhud-stat" title={round ?? "Ronde permainan"}>
          <RotateCw aria-hidden /> <b>Ronde {state.turnCount}</b>
        </span>
      </div>
      {round && <div className="bhud-round">{round}</div>}
      <ol className="bhud-log" aria-live="polite">
        {latest.map((e, i) => (
          <li key={state.log.length - i} className={cn(TONE[e.tone])} title={e.text}>
            <span aria-hidden>{icon(e)}</span>
            {e.who !== undefined && <i className={AREA_BG[state.players[e.who].area]} />}
            <span className="bhud-log-text">{e.text}</span>
          </li>
        ))}
      </ol>
      <HistoryDialog state={state}>
        <button type="button" className="bhud-history" title="Lihat seluruh riwayat aktivitas">
          <History aria-hidden /> Riwayat ({state.log.length})
        </button>
      </HistoryDialog>
    </section>
  );
}
