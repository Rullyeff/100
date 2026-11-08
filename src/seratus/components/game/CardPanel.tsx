import { checkedAt } from "@/seratus/lib/checked-at";
import { useState, type ReactNode } from "react";
import { Bot, Hand, Lock, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  card,
  type AspirasiCard,
  type DemokrasiCard,
  type Effect,
  type KejutanCard,
  type McqCard,
  type PutusanCard,
} from "@/seratus/game/public-cards";
import { AREAS, CLAIM_COST, CONTEST_PENALTY, HOME_PENALTY, MAX_CLAIMS, canClaim, currentPlayer, escrowOwned, forfeitLabel, handCount, type Action, type GameState, type LastResult } from "@/seratus/game/view";
import { cn } from "@/lib/utils";
import { cardCat, DECK_INFO, type DeckCat } from "./decks";
import { AREA_BG, LETTERS } from "./theme";

/** Kartu fisik di meja: strip warna dek, badge jenis & area, badge hadiah. */
export function CardShell({
  deck,
  kicker,
  area,
  reward,
  code,
  children,
}: {
  deck: DeckCat;
  kicker: string;
  area?: number | undefined;
  reward?: string | undefined;
  code?: string | undefined;
  children: ReactNode;
}) {
  const d = DECK_INFO[deck];
  return (
    <div className={cn("physical-card", d.border)} key={`${code ?? deck}-${kicker}`}>
      <div className={cn("card-reverse bg-card-weave", d.bg)} aria-hidden="true"><strong>100</strong><span>SUARA</span></div>
      <div className={cn("card-front overflow-hidden rounded-lg border-2 bg-paper", d.border)}>
      <div className={cn("bg-card-weave flex flex-wrap items-center gap-2 px-4 py-2.5 text-on-deck", d.bg)}>
        <span className="flex size-7 items-center justify-center rounded-full bg-paper font-display text-sm font-extrabold">
          <span className={d.text}>{d.letter}</span>
        </span>
        <span className="font-display text-sm font-extrabold tracking-wider">KARTU {d.name.toUpperCase()}</span>
        <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[11px] font-semibold">{kicker}</span>
        {area !== undefined && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-paper px-2 py-0.5 text-[11px] font-bold text-foreground">
            <span className={cn("size-2.5 rounded-full", checkedAt(AREA_BG, area))} /> {checkedAt(AREAS, area).name}
          </span>
        )}
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {reward && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-gold bg-gold/15 px-2.5 py-0.5 text-xs font-semibold">
            <span className="size-2 rounded-full bg-gold" /> {reward}
          </div>
        )}
        {children}
      </div>
      {code && <div className="border-t border-dashed px-4 py-1.5 text-right font-mono text-[10px] text-muted-foreground">{code}</div>}
      </div>
    </div>
  );
}

function Mcq({ options, disabled, onLock }: { options: string[]; disabled?: boolean; onLock: (i: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <div className={cn("grid gap-2", options.length <= 4 && "sm:grid-cols-2")} role="radiogroup">
        {options.map((o, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={sel === i}
            disabled={disabled}
            onClick={() => setSel(i)}
            className={cn(
              "flex min-h-12 w-full items-start gap-2.5 rounded-xl border-2 bg-card px-3 py-2.5 text-left text-sm transition-all disabled:opacity-60",
              sel === i ? "border-primary bg-primary/5 shadow-card" : "border-border hover:border-gold hover:bg-accent",
            )}
          >
            <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold", sel === i ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {checkedAt(LETTERS, i)}
            </span>
            <span className="pt-0.5">{o}</span>
          </button>
        ))}
      </div>
      {!disabled && (
        <Button size="lg" className="w-full" disabled={sel === null} onClick={() => sel !== null && onLock(sel)}>
          <Lock /> Kunci Jawaban
        </Button>
      )}
    </div>
  );
}

function BotThinking({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      <Bot className="size-4 animate-pulse" /> {name} sedang memutuskan…
    </div>
  );
}

const effectText = (e: Effect) =>
  [
    e.votes ? `${e.votes > 0 ? "+" : "−"}${Math.abs(e.votes)} suara` : null,
    e.move ? `${e.move > 0 ? "maju" : "mundur"} ${Math.abs(e.move)}` : null,
    e.skip ? `lewati ${e.skip} giliran` : null,
    e.extraRoll ? "lempar lagi" : null,
  ]
    .filter(Boolean)
    .join(" · ");

export function CardPanel({
  state,
  dispatch,
  canAct,
  actor,
  actorName,
  needsReveal,
  onReveal,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  canAct: boolean;
  actor: number | null;
  actorName: string;
  needsReveal: boolean;
  onReveal: () => void;
}) {
  const pend = state.pending; if (!pend) return null;
  return (
    <section aria-label="Pertanyaan atau studi kasus" className="rounded-2xl border bg-card p-3 shadow-card sm:p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Pertanyaan / Studi Kasus</h2>
      {state.stage === "pending" && pend ? (
        needsReveal ? (
          <FaceDown cat={"cardId" in pend ? cardCat(pend.cardId) : "P"} onReveal={onReveal} />
        ) : (
          <PendingView key={`${pend.kind}-${'cardId' in pend ? pend.cardId : state.turnCount}-${actor}`} state={state} canAct={canAct} actor={actor} actorName={actorName} dispatch={dispatch} />
        )
      ) : state.lastResult ? (
        <ResultCard r={state.lastResult} />
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center text-sm text-muted-foreground">
          <Hand className="mb-2 size-6" />
          Belum ada kartu terbuka. Lempar dadu untuk melangkah — kartu sesuai petak akan muncul di sini.
        </div>
      )}
    </section>
  );
}

function FaceDown({ cat, onReveal }: { cat: DeckCat; onReveal: () => void }) {
  const d = DECK_INFO[cat];
  return (
    <div className="flex flex-col items-center gap-4 py-2 sm:flex-row">
      <div className={cn("card-facedown bg-card-weave relative flex h-40 w-28 shrink-0 rotate-[-4deg] flex-col items-center justify-center rounded-xl border-4 border-paper text-on-deck shadow-card", d.bg)}>
        <span className="font-display text-3xl font-extrabold text-gold">100</span>
        <span className="text-[10px] font-bold tracking-[0.3em]">SUARA</span>
        <span className="mt-2 text-[10px] font-semibold uppercase">{d.name}</span>
      </div>
      <div className="flex-1 text-center sm:text-left">
        <p className="font-display text-lg font-extrabold">Kamu mendarat di petak {d.name}.</p>
        <p className="text-sm text-muted-foreground">Ambil kartu teratas dari dek {d.name} untuk membacanya.</p>
        <Button variant="gold" size="lg" className="mt-3" onClick={onReveal} autoFocus>
          Ambil Kartu
        </Button>
      </div>
    </div>
  );
}

function PendingView({
  state,
  canAct,
  actor,
  actorName,
  dispatch,
}: {
  state: GameState;
  canAct: boolean;
  actor: number | null;
  actorName: string;
  dispatch: (a: Action) => void;
}) {
  const p = currentPlayer(state);
  const pend = state.pending; if (!pend) return null;
  const wait = !canAct && <BotThinking name={actorName} />;

  switch (pend.kind) {
    case "aspirasi": {
      const c = card<AspirasiCard>(pend.cardId);
      const lvl = checkedAt(["", "Mudah", "Sedang", "Sulit · SJT"], c.level);
      const reward = c.level === 3 ? "Pilihan terbaik +2 suara" : "Benar +2 suara";
      return (
        <CardShell deck="A" kicker={lvl} area={pend.area} reward={`${reward}${p.areaTokens[pend.area] ? "" : " · Token Area"}`} code={c.code ?? c.id}>
          <p className="text-base font-semibold leading-relaxed">{c.prompt}</p>
          <Mcq options={c.options ?? []} disabled={!canAct} onLock={(i) => dispatch({ type: "ANSWER", choice: i })} />
          {wait}
        </CardShell>
      );
    }
    case "cekfakta":
    case "misi": {
      const c = card<McqCard>(pend.cardId);
      return (
        <CardShell
          deck="D"
          kicker={pend.kind === "misi" ? "Misi Pemenuhan Syarat" : "Cek Fakta"}
          area={pend.area}
          reward={pend.kind === "misi" ? "Poin Kelayakan maks 5 (bukan suara asli)" : `Benar +2 suara${p.areaTokens[pend.area] ? "" : " · Token Area"}`}
          code={c.code ?? c.id}
        >
          <p className="text-base font-semibold leading-relaxed">{c.prompt}</p>
          <Mcq options={c.options ?? []} disabled={!canAct} onLock={(i) => dispatch({ type: "ANSWER", choice: i })} />
          {wait}
        </CardShell>
      );
    }
    case "dilema": {
      const c = card<DemokrasiCard>(pend.cardId);
      // Browser cards have weights stripped; weighted (SJT) dilemas are recognised by their options list.
      if (c.weights || (c.options && !c.choices)) {
        return (
          <CardShell deck="D" kicker="Dilema Demokrasi · SJT" area={pend.area} reward={`Pilihan terbaik +2 suara${p.areaTokens[pend.area] ? "" : " · Token Area"}`} code={c.code ?? c.id}>
            <p className="text-base font-semibold leading-relaxed">{c.prompt}</p>
            <Mcq options={c.options ?? []} disabled={!canAct} onLock={(i) => dispatch({ type: "ANSWER", choice: i })} />
            {wait}
          </CardShell>
        );
      }
      return (
        <CardShell deck="D" kicker="Dilema" area={pend.area} reward="Efek sesuai pilihan" code={c.code ?? c.id}>
          <p className="text-base font-semibold leading-relaxed">{c.prompt}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(c.choices ?? []).map((ch, i) => (
              <Button key={i} variant="outline" className="h-auto min-h-12 whitespace-normal rounded-xl border-2 py-2.5 text-left" disabled={!canAct} onClick={() => dispatch({ type: "ANSWER", choice: i })}>
                <b className="mr-1">{checkedAt(LETTERS, i)}.</b> {ch.label}
              </Button>
            ))}
          </div>
          {wait}
        </CardShell>
      );
    }
    case "refleksi": {
      const c = card<DemokrasiCard>(pend.cardId);
      if (c.options) {
        return (
          <CardShell deck="D" kicker="Refleksi" area={pend.area} reward={`Benar +2 suara${p.areaTokens[pend.area] ? "" : " · Token Area"}`} code={c.code ?? c.id}>
            <p className="text-base font-semibold leading-relaxed">{c.prompt}</p>
            <Mcq options={c.options ?? []} disabled={!canAct} onLock={(i) => dispatch({ type: "ANSWER", choice: i })} />
            {wait}
          </CardShell>
        );
      }
      return (
        <CardShell deck="D" kicker="Refleksi" area={pend.area} reward="+2 suara" code={c.code ?? c.id}>
          <p className="text-base font-semibold leading-relaxed">{c.prompt}</p>
          {canAct ? (
            <Button size="lg" className="w-full" onClick={() => dispatch({ type: "ACK" })}>
              Terapkan
            </Button>
          ) : (
            wait
          )}
        </CardShell>
      );
    }
    case "kejutan": {
      const kc = card<KejutanCard>(pend.cardId);
      return (
        <CardShell deck="K" kicker={kc.sub === "kesempatan" ? "Kesempatan" : "Peristiwa"} area={pend.area} reward={effectText(kc.effect)} code={kc.code ?? kc.id}>
          <p className="text-base font-semibold leading-relaxed">{kc.text}</p>
          {canAct ? (
            <Button size="lg" className="w-full" onClick={() => dispatch({ type: "ACK" })}>
              Terapkan
            </Button>
          ) : (
            wait
          )}
        </CardShell>
      );
    }
    case "forum": {
      const c = card<DemokrasiCard>(pend.cardId);
      const n = Object.keys(pend.votes).length;
      return (
        <CardShell deck="D" kicker="Forum Demokrasi" area={pend.area} reward="Dukungan ≥3 → +2 · 2 → +1" code={c.code ?? c.id}>
          <p className="text-base font-semibold leading-relaxed">{c.prompt}</p>
          {pend.stance === null ? (
            canAct ? (
              <div className="grid grid-cols-2 gap-2">
                {(c.options ?? []).map((o, i) => (
                  <Button key={i} size="lg" variant="outline" onClick={() => dispatch({ type: "FORUM_STANCE", choice: i })}>
                    {o}
                  </Button>
                ))}
              </div>
            ) : (
              wait
            )
          ) : (
            <>
              <p className="text-sm">
                {p.name} menyatakan <b>{checkedAt(c.options ?? [], pend.stance)}</b> dan menyampaikan argumen. Apakah forum mendukung?
              </p>
              <VoteCounter n={n} />
              {canAct ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Pemilih: {actorName}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="lg" onClick={() => { if (actor === null) return; dispatch({ type: "VOTE", voter: actor, choice: 0 }); }}>Dukung</Button>
                    <Button size="lg" variant="outline" onClick={() => { if (actor === null) return; dispatch({ type: "VOTE", voter: actor, choice: 1 }); }}>
                      Tidak mendukung
                    </Button>
                  </div>
                </div>
              ) : (
                wait
              )}
            </>
          )}
        </CardShell>
      );
    }
    case "putusan": {
      const c = card<PutusanCard>(pend.cardId);
      const n = Object.keys(pend.votes).length;
      return (
        <CardShell deck="R" kicker="Gerbang Demokrasi" area={p.area} reward="Voting rahasia pemain lain · seri → lebih ringan" code={c.code ?? c.id}>
          <p className="text-xs text-muted-foreground">Kejadian untuk {p.name}:</p>
          <p className="text-base font-semibold leading-relaxed">{c.text}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["a", "b"] as const).map((k, i) => (
              <button
                key={k}
                disabled={!canAct}
                onClick={() => { if (actor === null) return; dispatch({ type: "VOTE", voter: actor, choice: i }); }}
                className="flex min-h-12 items-start gap-2.5 rounded-xl border-2 bg-card px-3 py-2.5 text-left text-sm transition-all hover:border-gold hover:bg-accent disabled:opacity-60"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold">{checkedAt(LETTERS, i)}</span>
                <span className="flex-1 pt-0.5">{c[k].label}</span>
                {c.lighter === k && <span className="rounded bg-gold/25 px-1.5 text-[10px] font-semibold">lebih ringan</span>}
              </button>
            ))}
          </div>
          <VoteCounter n={n} />
          {canAct ? (
            <div className="flex items-center gap-1 text-sm font-semibold">
              <Vote className="size-4" /> Voting rahasia: {actorName} — klik A atau B
            </div>
          ) : (
            wait
          )}
        </CardShell>
      );
    }
    case "claim":
      return (
        <CardShell deck="P" kicker={`Putaran ${p.pentRound} · P${pend.space + 1}`} reward={`Jaminkan ${CLAIM_COST} suara · tetap suara sahmu`}>
          <p className="text-base font-semibold">Petak netral. Jaminkan {CLAIM_COST} suara dan taruh Token Area milikmu di petak ini?</p>
          <p className="text-sm text-muted-foreground">
            Di tangan: {handCount(state, p.id)} → {handCount(state, p.id) - CLAIM_COST} · di jaminan: {escrowOwned(state, p.id)} → {escrowOwned(state, p.id) + CLAIM_COST}. Maks {MAX_CLAIMS} petak; boleh menjaminkan seluruh suara.
          </p>
          {canAct ? (
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" variant="gold" disabled={!canClaim(state, p)} onClick={() => dispatch({ type: "CLAIM", accept: true })}>
                Klaim (−{CLAIM_COST})
              </Button>
              <Button size="lg" variant="outline" onClick={() => dispatch({ type: "CLAIM", accept: false })}>
                Lewati
              </Button>
            </div>
          ) : (
            wait
          )}
        </CardShell>
      );
    case "forfeit": {
      const payer = checkedAt(state.players, pend.payer);
      const receiver = checkedAt(state.players, pend.receiver);
      return (
        <CardShell deck="P" kicker={`Hasil Duel · P${pend.space + 1}`} area={payer.area} reward={`Diserahkan kepada ${receiver.name}`}>
          <p className="text-base font-semibold">{pend.reason}.</p>
          <p className="text-sm text-muted-foreground">{payer.name} memilih salah satu yang diserahkan kepada {receiver.name}:</p>
          {canAct ? (
            <div className="grid gap-2">
              {pend.options.map((o, i) => (
                <Button key={i} size="lg" variant={o.type === "home" ? "gold" : "outline"} className="h-auto min-h-12 whitespace-normal" onClick={() => dispatch({ type: "FORFEIT", player: pend.payer, option: i })}>
                  {forfeitLabel(state, o)}
                </Button>
              ))}
            </div>
          ) : (
            wait
          )}
        </CardShell>
      );
    }
    case "duel": {
      const c = card<McqCard>(pend.cardId);
      const opp = checkedAt(state.players, pend.opponent);
      const reward = pend.home
        ? `Menang: ${opp.name} serahkan Gerbang Aman atau 1 petak · Kalah: serahkan ${HOME_PENALTY} suara atau 1 petak`
        : `Menang: rebut petak + ${CLAIM_COST} suara jaminan · Kalah: serahkan ${CONTEST_PENALTY} suara`;
      return (
        <CardShell deck="P" kicker={`${pend.home ? "Duel Gerbang Aman" : "Duel Perebutan"} · ${p.name} vs ${opp.name}`} reward={reward} code={c.code ?? c.id}>
          <p className="text-base font-semibold leading-relaxed">{c.prompt}</p>
          <p className="text-xs text-muted-foreground">Jawaban terkunci: {Object.keys(pend.answers).length}/2 — hasil dibuka bersama.</p>
          {canAct && <div className="text-sm font-semibold">Penjawab: {actorName}</div>}
          <Mcq options={c.options ?? []} disabled={!canAct} onLock={(i) => { if (actor !== null) dispatch({ type: "DUEL_ANSWER", player: actor, choice: i }); }} />
          {wait}
        </CardShell>
      );
    }
  }
}

function VoteCounter({ n, total = 4 }: { n: number; total?: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("size-3 rounded-full", i < n ? "bg-deck-d" : "bg-muted")} />
        ))}
      </div>
      {n}/{total} suara masuk (pilihan disembunyikan)
    </div>
  );
}

export function ResultCard({ r }: { r: LastResult }) {
  let options: string[] | null = null;
  let prompt: string | null = null;
  if (r.cardId) {
    const c = card(r.cardId) as { options?: string[]; prompt?: string; text?: string };
    if (r.correct !== undefined) options = c.options ?? null;
    prompt = c.prompt ?? c.text ?? null;
  }
  const cat = r.cardId ? cardCat(r.cardId) : "P";
  return (
    <CardShell deck={cat} kicker={r.title} code={r.cardId}>
      {prompt && <p className="text-sm text-muted-foreground">{prompt}</p>}
      <ul className="space-y-0.5 text-sm" aria-live="polite">
        {r.lines.map((l, i) => (
          <li key={i} className={l.startsWith("+") || l.startsWith("Token") ? "font-semibold text-success" : l.startsWith("−") ? "font-semibold text-destructive" : ""}>
            {l}
          </li>
        ))}
      </ul>
      {options && (
        <div className="grid gap-1.5 text-xs sm:grid-cols-2">
          {options.map((o, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2 rounded-lg border px-2 py-1.5",
                i === r.correct ? "border-success bg-success/10 font-semibold" : i === r.choice ? "border-destructive bg-destructive/10" : "text-muted-foreground",
              )}
            >
              <span className="font-bold">{checkedAt(LETTERS, i)}</span>
              <span className="flex-1">{o}</span>
              {i === r.correct && <span>✓ terbaik</span>}
              {i === r.choice && i !== r.correct && <span>dipilih</span>}
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}
