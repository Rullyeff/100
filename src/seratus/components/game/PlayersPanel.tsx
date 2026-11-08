import { Bot, Coins, Home, MapPin, ShieldAlert, User } from "lucide-react";
import {
  AREAS,
  currentPlayer,
  escrowOwned,
  handCount,
  homesOwned,
  MAX_CLAIMS,
  ownedSpaces,
  QUALIFY_VOTES,
  type GameState,
} from "@/seratus/game/view";
import { cn } from "@/lib/utils";
import { PlayerAvatar, moodOf } from './PlayerAvatar';
import { BookOpen, Leaf, ChartColumn, Landmark, Accessibility } from "lucide-react";
import { AREA_BG, PHASE_LABEL, phaseDetail } from "./theme";

export function PlayersPanel({ state }: { state: GameState }) {
  const cur = currentPlayer(state);
  return (
    <section aria-label="Pemain" className="space-y-2.5">
      <h2 className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Pemain <span className="font-semibold normal-case">5 / 5</span>
      </h2>
      {state.order.map((id) => {
        const p = state.players[id];
        const hand = handCount(state, p.id);
        const esc = escrowOwned(state, p.id);
        const active = p.id === cur.id && state.stage !== "over";
        const reading = active && state.stage === "pending" && !!state.pending && "cardId" in state.pending && state.pending.kind !== "forum" && state.pending.kind !== "putusan";
        const status = p.phase === "out" ? "Gugur" : p.phase === "done" ? "Selesai" : reading ? (p.isBot ? "Membaca soal…" : "Menjawab…") : active ? "Sedang Aktif" : "Menunggu";
        return (
          <article
            key={p.id}
            data-vote-player={p.id}
            className={cn(
              "rounded-2xl border bg-card p-3 shadow-card transition-all",
              active && "player-card-active border-gold bg-gold/5 ring-2 ring-gold/60",
            )}
          >
            <div className="flex items-center gap-2.5">
              <PlayerAvatar area={p.area} avatar={p.avatar} playerId={p.id} mood={moodOf(state, p.id)} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{p.name}</span>
                  {p.isBot ? <Bot className="size-3.5 shrink-0 text-muted-foreground" aria-label="Bot" /> : <User className="size-3.5 shrink-0 text-muted-foreground" aria-label="Manusia" />}
                </div>
                <span
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    active ? "bg-gold text-gold-foreground" : p.phase === "done" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  {reading && <BookOpen className="turn-reading-icon size-3" aria-hidden="true" />}
                  {status}
                </span>
              </div>
              <div className="text-right" title={`${hand} di tangan + ${esc} di petak`}>
                <div className="flex items-center justify-end gap-1 font-display text-xl font-extrabold leading-none">
                  <Coins className="size-4 text-gold" /> {hand}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  di tangan{esc ? ` · +${esc} petak` : ""}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5" aria-label="Token Area">
              {AREAS.map((a, i) => (
                <span
                  key={a.name}
                  title={`Token ${a.name}${p.areaTokens[i] ? " ✓" : " (belum)"}`}
                  className={cn(
                    "size-6 rounded-full border-2 transition-all",
                    p.areaTokens[i] ? cn(AREA_BG[i], "border-paper shadow-[0_0_0_1px_var(--border),inset_0_-3px_0_oklch(0_0_0/20%)]") : "border-dashed border-muted-foreground/40 bg-muted",
                  )}
                >
                  {(() => { const Icon = [BookOpen, Leaf, ChartColumn, Landmark, Accessibility][i]; return <Icon className="size-3" aria-hidden="true" />; })()}
                  <span className="sr-only">{a.name}</span>
                </span>
              ))}
              <span className="ml-auto text-[10px] text-muted-foreground">{p.areaTokens.filter(Boolean).length}/5 token</span>
            </div>

            <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="size-3" /> {PHASE_LABEL[p.phase]} · {phaseDetail(p)}
              {ownedSpaces(state, p.id).length > 0 && <span className="ml-auto">{ownedSpaces(state, p.id).length}/{MAX_CLAIMS} petak</span>}
            </div>
            {p.phase === "outer" && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" title={`Syarat Gerbang: ${QUALIFY_VOTES} suara di tangan`}>
                <div className="h-full bg-gold transition-all" style={{ width: `${Math.min(100, ((hand + p.emergency) / QUALIFY_VOTES) * 100)}%` }} />
              </div>
            )}
            {(() => {
              const homes = homesOwned(state, p.id);
              const lostHome = !homes.includes(p.area);
              const extraHomes = homes.filter((a) => a !== p.area);
              if (!(p.phase === "out" || lostHome || extraHomes.length || p.skipTurns > 0 || p.emergency > 0)) return null;
              return (
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  {p.phase === "out" && (
                    <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive">
                      <ShieldAlert className="size-3" /> Gugur
                    </span>
                  )}
                  {p.phase !== "out" && lostHome && (
                    <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive">
                      <Home className="size-3" /> Gerbang Aman lepas
                    </span>
                  )}
                  {extraHomes.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded bg-gold/20 px-1.5 py-0.5 font-semibold">
                      <Home className="size-3" /> Gerbang {AREAS[a].name}
                    </span>
                  ))}
                  {p.skipTurns > 0 && <span className="rounded bg-muted px-1.5 py-0.5">Lewati {p.skipTurns} giliran</span>}
                  {p.emergency > 0 && <span className="rounded bg-muted px-1.5 py-0.5">Poin Kelayakan {p.emergency}</span>}
                </div>
              );
            })()}
          </article>
        );
      })}
    </section>
  );
}
