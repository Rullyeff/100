import { checkedAt } from "@/seratus/lib/checked-at";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { play, setMusicTrack } from "@/seratus/lib/sfx";
import { Pause, Play, X, Map, Zap, Layers, Users, List, Maximize2, Minimize2 } from "lucide-react";
import { SoundToggle } from "@/seratus/components/SoundToggle";
import { useGameChrome } from "./PlayMenu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { currentPlayer, getActor, isSecretContext, type Action, type GameState } from "@/seratus/game/view";
import { viewerActor } from "@/seratus/game/room-rules";
import { cn } from "@/lib/utils";
import { CardPanel } from "./CardPanel";
import { MovePopup } from "./MovePopup";
import { PlayerAvatar, moodOf } from "./PlayerAvatar";
import { ControlPanel } from "./ControlPanel";
import { CardDrawFx } from "./CardDrawFx";
import { FinalPanel } from "./FinalPanel";
import { GameBoard } from "./GameBoard";
import { HandoffOverlay } from "./HandoffOverlay";
import { HudStrip } from "./HudStrip";
import { LogPanel } from "./LogPanel";
import { PlayersPanel } from "./PlayersPanel";
import { cardCat, pendingCardId, type DeckCat } from "./decks";
import { DiceTray } from "./DiceTray";
import { TurnBanner } from "./TurnBanner";
import { BoardStatus, BoardTurn } from "./BoardHud";
import { StarBurst } from "./StarBurst";
import { DICE_FLIGHT_MS, DICE_LANDED_MS, pawnRoute, pawnTravelMs } from "./pawn-motion";
import { VoteChangeFx } from "./VoteChangeFx";
import { CelebrationFx } from "./CelebrationFx";
import { BotReactionFx } from "./BotReactionFx";
import { shakeTable } from "./table-impact";
import { ArcadeReactions, ArcadeControls } from './ArcadeReactions';
import type { EmoteKey, RoomEmote } from '@/seratus/game/emotes';

const DESKTOP_QUERY = "(min-width: 768px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** Desktop table layout (panels tucked into the board) vs. the mobile tab layout. */
function useDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
}

export function GameScreen({
  state,
  dispatch: rawDispatch,
  error,
  speed,
  setSpeed,
  paused,
  setPaused,
  onQuit,
  onRestart,
  testDice,
  online,
  localBusy = false,
  localActor,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  error: string | null;
  speed: number;
  setSpeed: (n: number) => void;
  paused: boolean;
  setPaused: (b: boolean) => void;
  onQuit: () => void;
  onRestart?: () => void;
  testDice: boolean;
  online?: { viewer: number; isHost: boolean; code: string; busy: boolean; emotes?: RoomEmote[]; sendEmote?: (key: EmoteKey) => Promise<boolean> };
  localBusy?: boolean;
  localActor?: number | 'host' | null;
}) {
  // Musik latar yang lebih tenang selama permainan; kembali ke lagu menu saat keluar.
  useEffect(() => {
    setMusicTrack("game");
    return () => setMusicTrack("menu");
  }, []);
  // Setiap aksi UI diberi ID per versi state: klik ganda diproses sekali.
  const dispatch = useCallback(
    (a: Action) => {
      if (a.type === "ROLL" && window.matchMedia("(max-width: 767px)").matches) setTab("papan");
      rawDispatch({ ...a, id: crypto.randomUUID() });
    },
    [rawDispatch, state.version],
  );

  const chrome = useGameChrome();
  // Minimizing only applies to the desktop table layout; mobile keeps its normal page.
  const compact = !!chrome?.compact;
  const desktop = useDesktop();
  const actor = online ? viewerActor(state, online.viewer, online.isHost) : localActor === undefined ? getActor(state) : localActor;
  const humans = state.players.filter((p) => !p.isBot);
  const allBots = humans.length === 0;
  const actorPlayer = typeof actor === "number" ? checkedAt(state.players, actor) : null;
  const humanActor = actorPlayer && !actorPlayer.isBot ? actorPlayer : null;
  const canAct = !localBusy && !paused && (online ? actor !== null && !online.busy : actor === "host" ? !allBots : !!humanActor);
  const cur = currentPlayer(state);

  // Pass-and-play: konfirmasi serah-terima saat pemain manusia berganti
  const [confirmed, setConfirmed] = useState<number | null>(humans.length === 1 ? checkedAt(humans, 0).id : null);
  const needHandoff = !online && humans.length > 1 && humanActor !== null && confirmed !== humanActor.id;
  useEffect(() => {
    if (humans.length === 1) setConfirmed(checkedAt(humans, 0).id);
  }, [humans]);

  // "Ambil Kartu": kartu yang mendarat disimpan tertutup sampai pemain aktif mengambilnya
  const cardId = pendingCardId(state.pending);
  const cardKey = cardId ? `${state.turnCount}-${state.turnIdx}-${state.pending?.kind}-${cardId}` : null;
  const [revealed, setRevealed] = useState<string | null>(null);
  const needsReveal = !!cardKey && revealed !== cardKey && canAct && actor === cur.id && state.pending?.kind !== "putusan";
  const [tab, setTab] = useState('papan');
  const rollAt = state.log.find((entry) => entry.text.includes("melempar dadu"))?.at;
  useEffect(() => {
    if (!rollAt || !window.matchMedia("(max-width: 767px)").matches) return;
    setTab("papan");
    const frame = requestAnimationFrame(() => document.getElementById("papan-permainan")?.scrollIntoView({ block: "start", behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [rollAt]);
  const [popup, setPopup] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // Tahan kartu sampai dadu selesai mendarat, agar lemparan tidak tertutup jendela kartu
  const [diceSettling, setDiceSettling] = useState(false);
  const presentedPlayers = useRef(state.players);
  const presentedRoll = useRef(rollAt);
  useEffect(() => {
    const oldPlayers = presentedPlayers.current;
    const rolled = presentedRoll.current !== rollAt;
    presentedPlayers.current = state.players;
    presentedRoll.current = rollAt;
    if (!rolled || !rollAt || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const travel = Math.max(0, ...state.players.map((player) => {
      const old = oldPlayers.find((p) => p.id === player.id);
      return old ? pawnTravelMs(pawnRoute(old, player)) : 0;
    }));
    setDiceSettling(true);
    const t = window.setTimeout(() => setDiceSettling(false), Math.max(DICE_FLIGHT_MS, DICE_LANDED_MS + travel));
    return () => window.clearTimeout(t);
  }, [rollAt]);
  const reveal = () => {
    if (!cardKey) return;
    setRevealed(cardKey);
    setPopup(true);
  };
  // Pop up kartu tertutup sendiri saat giliran beralih ke lemparan dadu berikutnya
  useEffect(() => {
    if (state.stage === "roll" || state.stage === "over") setPopup(false);
  }, [state.stage]);

  const actorName = actorPlayer?.name ?? (online ? currentPlayer(state).name : "Bot");

  // Sound effects: presentation only, keyed so polling refreshes or a resumed game stay silent.
  const wantsOpen = !diceSettling && (popup || (!!cardKey && !needsReveal && dismissed !== cardKey)) && state.stage !== "over";
  // Animasi buka kartu: kartu teratas terangkat dari dek di papan dan terbang ke tengah sebelum jendela kartu muncul.
  const activeCat = cardId ? cardCat(cardId) : null;
  const [flight, setFlight] = useState<{ key: string; cat: DeckCat; from: DOMRect } | null>(null);
  const [flown, setFlown] = useState<string | null>(null);
  const flightTimer = useRef<number | null>(null);
  useEffect(() => () => { if (flightTimer.current) window.clearTimeout(flightTimer.current); }, []);
  useEffect(() => {
    if (!wantsOpen || !cardKey || flown === cardKey || flight?.key === cardKey) return;
    const face = activeCat ? document.querySelector(`[data-deck-spot="${activeCat}"] .board-deck-face`) : null;
    const from = face?.getBoundingClientRect();
    if (!activeCat || !from || from.width === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFlown(cardKey);
      return;
    }
    setFlight({ key: cardKey, cat: activeCat, from });
    play("flip", { strength: 0.6 });
    if (flightTimer.current) window.clearTimeout(flightTimer.current);
    flightTimer.current = window.setTimeout(() => {
      setFlown(cardKey);
      setFlight(null);
    }, 900);
  }, [wantsOpen, cardKey, activeCat, flown, flight]);
  const cardOpen = wantsOpen && (!cardKey || flown === cardKey);
  useEffect(() => { if (cardOpen) play("flip"); }, [cardOpen]);
  useEffect(() => {
    if (!cardOpen || state.pending?.kind !== "putusan") return;
    const timer = window.setTimeout(shakeTable, 1300);
    return () => window.clearTimeout(timer);
  }, [cardOpen, cardKey]);
  const result = state.lastResult;
  const resultKey = result ? `${state.turnCount}-${state.turnIdx}-${result.title}-${result.tone}` : null;
  const heardResult = useRef(resultKey);
  useEffect(() => {
    if (resultKey === heardResult.current) return;
    heardResult.current = resultKey;
    if (result?.tone === "gain") play("chime");
    else if (result?.tone === "loss") play("thud");
  }, [resultKey, result?.tone]);
  const heardOver = useRef(state.stage === "over");
  useEffect(() => {
    if (state.stage !== "over" || heardOver.current) { heardOver.current = state.stage === "over"; return; }
    heardOver.current = true;
    play("fanfare");
  }, [state.stage]);

  return (
    <ArcadeReactions state={state} sender={online ? online.viewer : humanActor?.id ?? confirmed ?? humans[0]?.id ?? null} online={online?.sendEmote ? { events: online.emotes ?? [], send: online.sendEmote } : undefined}>
    <div className="game-screen mx-auto w-full max-w-[1560px] space-y-4 px-3 py-4 pb-24 sm:px-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-2 lg:space-y-0 lg:py-2">
      <MovePopup state={state} />
      <VoteChangeFx state={state} />
      <CelebrationFx state={state} />
      <BotReactionFx state={state} />
      {flight && <CardDrawFx key={flight.key} cat={flight.cat} from={flight.from} />}
      {needHandoff && humanActor && (
        <HandoffOverlay player={humanActor} secret={isSecretContext(state)} onReady={() => setConfirmed(humanActor.id)} />
      )}

      <div className="game-session-bar flex shrink-0 flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          {online ? `Ruang ${online.code}` : allBots ? "Simulasi 5 Bot" : `${humans.length} manusia · ${5 - humans.length} bot`}
        </span>
        <span className="game-session-note text-xs text-muted-foreground">{online ? `Kamu: ${state.players[online.viewer]?.name} · ${online.busy ? 'Menyimpan…' : 'Tersambung'}` : 'Ruang demo lokal · tersimpan otomatis'}</span>
        <TurnBanner state={state} actor={online ? getActor(state) : actor} />
        <div className="ml-auto flex items-center gap-2">
          <ArcadeControls />
          {compact && paused && <span className="rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold">Dijeda</span>}
          {!online && <label className="flex items-center gap-1.5 text-xs">
            <span className="game-speed-label">Kecepatan bot</span>
            <select className="rounded-md border bg-card px-2 py-1 text-xs" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              <option value={1400}>Lambat</option>
              <option value={700}>Normal</option>
              <option value={250}>Cepat</option>
              <option value={40}>Kilat</option>
            </select>
          </label>}
          <Button size="sm" variant="outline" disabled={online && (!online.isHost || online.busy)} onClick={() => setPaused(!paused)}>
            {paused ? <Play /> : <Pause />} {paused ? "Lanjut" : "Jeda"}
          </Button>
          {!online && onRestart && <Button size="sm" variant="outline" onClick={() => { if (window.confirm("Mulai permainan baru dengan pemain yang sama? Permainan saat ini akan dihapus.")) onRestart(); }}>
            Main Baru
          </Button>}
          <Button size="sm" variant="ghost" onClick={() => { if (online || window.confirm("Akhiri permainan ini? Kemajuan akan dihapus dan kembali ke pengaturan.")) onQuit(); }}>
            <X /> {online ? "Keluar" : "Akhiri"}
          </Button>
          {compact && <SoundToggle className="game-session-sound" />}
          {chrome && (
            <Button
              size="sm"
              variant="outline"
              className="hidden lg:inline-flex"
              aria-pressed={compact}
              aria-label={compact ? "Tampilkan Menu" : "Layar Penuh"}
              title={compact ? "Tampilkan menu atas" : "Perkecil menu atas agar papan memenuhi layar"}
              onClick={() => chrome.setCompact(!compact)}
            >
              {compact ? <Minimize2 /> : <Maximize2 />} <span className="hidden xl:inline">{compact ? "Tampilkan Menu" : "Layar Penuh"}</span>
            </Button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {paused && !compact && <div className="rounded-lg bg-gold/20 px-3 py-2 text-sm font-semibold">Permainan dijeda.</div>}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card p-2 lg:hidden">
        <div role="tablist" aria-label="Panel permainan" className="grid h-14 grid-cols-5 gap-1">
          {[{id:'papan',label:'Papan',Icon:Map},{id:'aksi',label:'Aksi',Icon:Zap},{id:'kartu',label:'Kartu',Icon:Layers},{id:'pemain',label:'Pemain',Icon:Users},{id:'log',label:'Log',Icon:List}].map(({id,label,Icon})=><Button key={id} role="tab" aria-selected={tab===id} variant={tab===id?'default':'ghost'} onClick={()=>setTab(id)} className="h-12 min-w-0 flex-col gap-1 px-1 text-xs"><Icon className="size-4"/>{label}</Button>)}
        </div>
      </div>

      <div className={cn("game-workspace grid gap-4 lg:min-h-0 lg:flex-1", desktop && "game-workspace-board")}>
        {!desktop && <HudStrip state={state} />}
        {!desktop && (
          <aside className={cn("game-actions order-1 space-y-4", tab !== 'aksi' && 'hidden')}>
            <ControlPanel
              state={state}
              dispatch={dispatch}
              canAct={canAct && state.stage !== "over"}
              actorName={actorName}
              needsReveal={needsReveal && !diceSettling}
              onReveal={reveal}
              testDice={testDice}
            />
            <DiceTray value={state.lastDice} />
          </aside>
        )}

        <main id="papan-permainan" className={cn("game-board-region order-3 min-w-0 lg:block lg:min-h-0 lg:col-start-2 lg:row-span-2 lg:row-start-1",tab !== 'papan' && 'hidden')}>
          <GameBoard
            state={state}
            drawReady={needsReveal && !diceSettling}
            onOpenCard={state.pending && state.stage !== "over" ? (needsReveal ? reveal : () => setPopup(true)) : undefined}
            overlay={desktop && (
              <div className="board-hud">
                <BoardTurn state={state} />
                <BoardStatus state={state} />
                <ControlPanel
                  variant="dock"
                  state={state}
                  dispatch={dispatch}
                  canAct={canAct && state.stage !== "over"}
                  actorName={actorName}
                  needsReveal={needsReveal && !diceSettling}
                  onReveal={reveal}
                  testDice={testDice}
                />
              </div>
            )}
          />
        </main>

        <aside className={cn("game-players order-4 lg:hidden lg:min-h-0 lg:overflow-y-auto lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:pb-40",tab !== 'pemain' && 'hidden')}>
          <PlayersPanel state={state} />
        </aside>

        <div id="kartu-aktif" className={cn("game-card-region order-2 min-w-0 empty:hidden scroll-mt-4 lg:hidden",tab !== 'kartu' && 'hidden')}>
          {state.stage === "over" ? (
            <FinalPanel state={state} dispatch={dispatch} actor={actor} canAct={canAct} onRestart={onQuit} />
          ) : (
            <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground lg:hidden">Kartu dibuka dengan mengetuk gambar kartu di papan.</p>
          )}
        </div>

        {!desktop && (
          <div className={cn("game-log-region order-5 min-w-0", tab !== 'log' && 'hidden')}>
            <LogPanel state={state} />
          </div>
        )}
      </div>

      <Dialog open={cardOpen} onOpenChange={(o) => { setPopup(o); if (!o) setDismissed(cardKey); }}>
            <DialogContent className="card-dialog max-h-[96dvh] max-w-2xl overflow-y-auto p-4 sm:p-6">
              {cardOpen && <StarBurst key={cardKey ?? "card"} />}
              <DialogTitle className="sr-only">Kartu yang dibuka</DialogTitle>
              <DialogDescription className="sr-only">Baca pertanyaan dan pilih jawaban</DialogDescription>
              <div className="flex items-center gap-3">
                <PlayerAvatar area={cur.area} avatar={cur.avatar} playerId={cur.id} mood={moodOf(state, cur.id)} size={36} />
                <div className="text-sm font-semibold">{cur.name} <span className="font-normal text-muted-foreground">{moodOf(state, cur.id) === "thinking" ? "sedang berpikir…" : moodOf(state, cur.id) === "happy" ? "senang, jawabannya benar!" : moodOf(state, cur.id) === "sad" ? "kurang tepat kali ini" : ""}</span></div>
              </div>
              <CardPanel
                state={state}
                dispatch={dispatch}
                canAct={canAct}
                actor={typeof actor === "number" ? actor : null}
                actorName={actorName}
                needsReveal={needsReveal}
                onReveal={reveal}
              />
              {state.stage === "end" && (
                <Button variant="default" disabled={!canAct} onClick={() => { setPopup(false); dispatch({ type: "END_TURN" }); }}>
                  Akhiri Giliran
                </Button>
              )}
            </DialogContent>
          </Dialog>
    </div>
    </ArcadeReactions>
  );
}
