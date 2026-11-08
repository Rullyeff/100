import { checkedAt } from "@/seratus/lib/checked-at";
import { useEffect, useState } from "react";
import { Crown, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { card, type FdtCard, type McqCard } from "@/seratus/game/public-cards";
import { AREAS, escrowOwned, fdtVoters, handCount, type Action, type GameState } from "@/seratus/game/view";
import { cn } from "@/lib/utils";
import { CardShell } from "./CardPanel";
import { AREA_BG, LETTERS } from "./theme";

export function FinalPanel({
  state,
  dispatch,
  actor,
  canAct,
  onRestart,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  actor: number | "host" | null;
  canAct: boolean;
  onRestart: () => void;
}) {
  const f = state.final; if (!f) return null;
  const ranked = [...state.players].sort((a, b) => checkedAt(f.scores, b.id) - checkedAt(f.scores, a.id));
  const actorP = typeof actor === "number" ? checkedAt(state.players, actor) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Trophy className="size-5 text-gold" /> Penghitungan Suara Sah
        </div>
        <ol className="mt-3 space-y-1.5">
          {ranked.map((p, i) => (
            <li key={p.id} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", f.winners.includes(p.id) && "bg-gold/20")}>
              <span className="w-4 text-sm font-bold text-muted-foreground">{i + 1}</span>
              <span className={cn("size-3 rounded-full", checkedAt(AREA_BG, p.area))} />
              <span className="flex-1 truncate font-semibold">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                {handCount(state, p.id)} tangan + {escrowOwned(state, p.id)} petak
              </span>
              <span className="w-8 text-right font-display text-lg font-extrabold">{checkedAt(f.scores, p.id)}</span>
              {f.winners.includes(p.id) && <Crown className="size-4 text-gold" />}
            </li>
          ))}
        </ol>
      </div>

      {f.stage === "done" && (
        <div className="rounded-xl bg-primary p-5 text-center text-primary-foreground shadow-card">
          <Crown className="mx-auto size-8 text-gold" />
          <div className="mt-2 font-display text-2xl font-extrabold">
            {f.winners.map((id) => checkedAt(state.players, id).name).join(" & ")}
          </div>
          <div className="text-sm opacity-80">{f.winners.length > 1 ? "Menang bersama" : `Pemenang · ${checkedAt(AREAS, checkedAt(state.players, checkedAt(f.winners, 0)).area).name}`}</div>
          <div className="mt-1 text-xs opacity-70">{f.note}</div>
          <Button variant="gold" className="mt-4" onClick={onRestart}>
            Main lagi dengan ruang baru
          </Button>
        </div>
      )}

      {f.stage === "argue" && f.caseId && (
        <CardShell deck="D" kicker="Final Democracy Test">
          <p className="text-sm">Skor tertinggi seri. Finalis: {f.finalists.map((id) => checkedAt(state.players, id).name).join(", ")}.</p>
          <p className="font-medium">{card<FdtCard>(f.caseId).text}</p>
          <p className="text-xs text-muted-foreground">Setiap finalis menyampaikan argumentasi lalu bantahan. Pemain nonfinalis kemudian memilih.</p>
          <div className="space-y-2">
            {f.finalists.map((id) => (
              <SpeechTimer key={id} name={checkedAt(state.players, id).name} />
            ))}
          </div>
          {canAct ? (
            <Button variant="gold" className="w-full" onClick={() => dispatch({ type: "FDT_START_VOTE" })}>
              Tutup debat & mulai voting
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Bot sedang berdebat…</p>
          )}
        </CardShell>
      )}

      {f.stage === "vote" && (
        <CardShell deck="D" kicker="Voting Nonfinalis">
          <p className="text-sm">
            Suara masuk: {Object.keys(f.votes).length}/{fdtVoters(state).length} (rahasia)
          </p>
          {canAct && actorP ? (
            <>
              <div className="text-sm font-semibold">Pemilih: {actorP.name}</div>
              <div className="grid gap-2">
                {f.finalists.map((id) => (
                  <Button key={id} variant="outline" onClick={() => dispatch({ type: "VOTE", voter: actorP.id, choice: id })}>
                    {checkedAt(state.players, id).name} paling meyakinkan
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{actorP?.name} sedang memilih…</p>
          )}
        </CardShell>
      )}

      {f.stage === "objective" && f.objective && (
        <ObjectiveView key={`${f.objective.cardId}-${actor}`} state={state} dispatch={dispatch} canAct={canAct} actor={actorP?.id ?? null} />
      )}
    </div>
  );
}

function ObjectiveView({ state, dispatch, canAct, actor }: { state: GameState; dispatch: (a: Action) => void; canAct: boolean; actor: number | null }) {
  const f = state.final; if (!f) return null;
  const objective = f.objective; if (!objective) return null; const c = card<McqCard>(objective.cardId);
  const [sel, setSel] = useState<number | null>(null);
  return (
    <CardShell deck="P" kicker={`Penentu objektif · ronde ${objective.round}/3`}>
      <p className="font-medium">{c.prompt}</p>
      <p className="text-xs text-muted-foreground">
        Terkunci {Object.keys(objective.answers).length}/{f.finalists.length}. {actor !== null && `Penjawab: ${checkedAt(state.players, actor).name}`}
      </p>
      <div className="space-y-1.5">
        {c.options.map((o, i) => (
          <button
            key={i}
            disabled={!canAct}
            onClick={() => setSel(i)}
            className={cn("flex w-full gap-2 rounded-lg border px-3 py-2 text-left text-sm", sel === i ? "border-primary ring-1 ring-primary" : "hover:bg-accent")}
          >
            <b>{checkedAt(LETTERS, i)}</b> {o}
          </button>
        ))}
      </div>
      {canAct && actor !== null && (
        <Button className="w-full" disabled={sel === null} onClick={() => sel !== null && dispatch({ type: "FDT_ANSWER", player: actor, choice: sel })}>
          Kunci Jawaban
        </Button>
      )}
    </CardShell>
  );
}

function SpeechTimer({ name }: { name: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null || left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <span className="font-semibold">{name}</span>
      {left === null ? (
        <Button size="sm" variant="outline" onClick={() => setLeft(60)}>
          <Timer /> Mulai 60 dtk
        </Button>
      ) : (
        <span className={cn("font-mono font-bold tabular-nums", left <= 10 && "text-destructive")}>{left > 0 ? `${left} dtk` : "Waktu habis"}</span>
      )}
    </div>
  );
}
