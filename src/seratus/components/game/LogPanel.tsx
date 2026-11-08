import { useEffect, useState, type ReactNode } from "react";
import { History, PanelRightClose } from "lucide-react";
import type { GameState, LogEntry } from "@/seratus/game/engine";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AREA_BG } from "./theme";

const TONE = {
  info: "text-foreground",
  gain: "text-success",
  loss: "text-destructive",
  system: "text-primary font-semibold",
};

const LATEST_COUNT = 5;
/** Desktop: the history owns the whole right column, so it shows more recent entries and scrolls. */
const DESKTOP_COUNT = 30;

export function icon(e: LogEntry) {
  if (e.text.includes("melempar dadu")) return "🎲";
  if (e.text.includes("Putusan Rakyat") || e.text.includes("Voting")) return "🗳️";
  if (e.text.includes("Duel")) return "⚔️";
  if (e.text.includes("MATI SURI") || e.text.includes("mati suri")) return "💤";
  if (e.text.includes("Token Area")) return "🏅";
  if (e.text.includes("mengklaim")) return "🏛️";
  if (e.tone === "gain") return "✅";
  if (e.tone === "loss") return "⚠️";
  if (e.tone === "system") return "📣";
  return "•";
}

const fmt = (t?: number) =>
  t ? new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":") : "--:--";

function Row({ e, players }: { e: LogEntry; players: GameState["players"] }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <time className="w-11 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{fmt(e.at)}</time>
      <span className="w-5 shrink-0 text-center" aria-hidden>
        {icon(e)}
      </span>
      {e.who !== undefined && <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", AREA_BG[players[e.who].area])} />}
      <span className={cn("min-w-0 flex-1", TONE[e.tone])}>{e.text}</span>
    </li>
  );
}


export function LogPanel({ state, onMinimize }: { state: GameState; onMinimize?: () => void }) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const log = state.log;
  // The engine stores the newest entry first.
  const latest = log.slice(0, wide ? DESKTOP_COUNT : LATEST_COUNT);

  return (
    <section aria-label="Riwayat aktivitas" className="log-panel flex h-full flex-col rounded-2xl border bg-card p-3 shadow-card sm:p-4">
      <h2 className="mb-2 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Riwayat Aktivitas
        <span className="ml-auto font-semibold normal-case">{log.length} peristiwa</span>
        {onMinimize && (
          <button
            type="button"
            className="log-toggle hidden size-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground md:grid"
            aria-label="Perkecil panel riwayat"
            title="Perkecil panel riwayat agar papan lebih besar"
            onClick={onMinimize}
          >
            <PanelRightClose className="size-3.5" />
          </button>
        )}
      </h2>
      <ol className="min-h-0 flex-1 divide-y overflow-hidden pr-1 text-sm" aria-live="polite">
        {latest.map((e, i) => (
          <Row key={log.length - i} e={e} players={state.players} />
        ))}
      </ol>
      <HistoryDialog state={state}>
        <Button variant="outline" size="sm" className="mt-2 h-7 w-full gap-1.5 text-xs">
          <History className="size-3.5" aria-hidden />
          Lihat seluruh riwayat ({log.length})
        </Button>
      </HistoryDialog>
    </section>
  );
}

/** Full game history in a dialog; the trigger is whatever button the caller passes. */
export function HistoryDialog({ state, children }: { state: GameState; children: ReactNode }) {
  const log = state.log;
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Riwayat Aktivitas</DialogTitle>
          <DialogDescription>Seluruh {log.length} peristiwa permainan, dari awal hingga sekarang.</DialogDescription>
        </DialogHeader>
        <ol className="min-h-0 flex-1 divide-y overflow-y-auto px-5 py-2 text-sm">
          {log.slice(0, 500).map((e, i) => (
            <Row key={log.length - i} e={e} players={state.players} />
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
