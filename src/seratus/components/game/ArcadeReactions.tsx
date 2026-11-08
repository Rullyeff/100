import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Smile, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type GameState } from '@/seratus/game/view';
import { EMOTES, EMOTE_COOLDOWN_MS, EMOTE_LIFE_MS, type EmoteKey, type RoomEmote } from '@/seratus/game/emotes';
import { arcadeSnapshot, freshArcadeEvents, type ArcadeMood, type Cue } from './arcade-events';
import { createAnnouncer, CUE_LABEL } from '@/seratus/lib/announcer';

const MoodContext = createContext<Partial<Record<number, ArcadeMood>>>({});
export const useArcadeMood = (playerId?: number) => useContext(MoodContext)[playerId ?? -1];
type OnlineEmotes = { events: RoomEmote[]; send: (key: EmoteKey) => Promise<boolean> };
const ControlsContext = createContext<ReactNode>(null);
export function ArcadeControls() { return useContext(ControlsContext); }

export function ArcadeReactions({ state, sender, online, children }: { state: GameState; sender: number | null; online?: OnlineEmotes | undefined; children: ReactNode }) {
  const previous = useRef(arcadeSnapshot(state));
  const [moods, setMoods] = useState<Partial<Record<number, ArcadeMood>>>({});
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);
  const [cue, setCue] = useState<Cue | null>(null);
  const [open, setOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const sending = useRef(false);
  const [bubbles, setBubbles] = useState<(RoomEmote & { left: number; top: number })[]>([]);
  const seen = useRef(new Set(online?.events.map(e => e.id) ?? []));
  const timers = useRef(new Set<number>());
  const voice = useRef<ReturnType<typeof createAnnouncer> | null>(null);
  const schedule = (fn: () => void, delay: number) => { const t = window.setTimeout(() => { timers.current.delete(t); fn(); }, delay); timers.current.add(t); };
  const announce = (key: Cue) => { if (!enabledRef.current || document.hidden) return; voice.current?.say(key); setCue(key); schedule(() => setCue(current => current === key ? null : current), 2200); };
  useEffect(() => {
    const value = localStorage.getItem('100suara-announcer') !== 'off'; setEnabled(value); enabledRef.current = value;
    voice.current = createAnnouncer();
    // A restored untouched game is still version zero: require a newly created timestamp too.
    const createdAt = Math.max(0, ...state.log.map(entry => entry.at ?? 0));
    if (state.version === 0 && state.turnCount === 1 && state.stage === 'roll' && Date.now() - createdAt < 1500) announce('start');
    const clear = () => { setBubbles([]); setMoods({}); setCue(null); };
    const hide = () => { if (document.hidden) clear(); };
    window.addEventListener('resize', clear); window.addEventListener('scroll', clear, true); document.addEventListener('visibilitychange', hide);
    return () => { voice.current?.dispose(); timers.current.forEach(window.clearTimeout); window.removeEventListener('resize', clear); window.removeEventListener('scroll', clear, true); document.removeEventListener('visibilitychange', hide); };
  }, []);
  useEffect(() => {
    const next = arcadeSnapshot(state); const events = freshArcadeEvents(previous.current, next); previous.current = next;
    if (document.hidden) return;
    events.moods.forEach(({ playerId, mood }) => { setMoods(old => ({ ...old, [playerId]: mood })); schedule(() => setMoods(old => { if (old[playerId] !== mood) return old; const copy = { ...old }; delete copy[playerId]; return copy; }), 3200); });
    events.cues.forEach((key, i) => schedule(() => announce(key), 450 + i * 1700));
  }, [state]);
  const showEmote = (event: RoomEmote) => {
    if (document.hidden || Date.now() - event.at >= EMOTE_LIFE_MS) return;
    const rect = [...document.querySelectorAll(`[data-vote-player="${event.playerId}"], [data-pawn="${event.playerId}"]`)].map(el => el.getBoundingClientRect()).find(r => r.width > 0 && r.top < innerHeight && r.bottom > 0);
    const left = Math.max(8, Math.min(innerWidth - 172, rect ? rect.left + rect.width / 2 - 80 : innerWidth / 2 - 80));
    const top = Math.max(8, Math.min(innerHeight - 160, rect ? (rect.top > 95 ? rect.top - 88 : rect.bottom + 8) : 100));
    setBubbles(old => [...old.filter(b => b.playerId !== event.playerId), { ...event, left, top }]);
    schedule(() => setBubbles(old => old.filter(b => b.id !== event.id)), Math.min(3500, EMOTE_LIFE_MS - (Date.now() - event.at)));
  };
  useEffect(() => { for (const event of online?.events ?? []) { if (seen.current.has(event.id)) continue; seen.current.add(event.id); showEmote(event); } if (seen.current.size > 200) seen.current = new Set(online?.events.map(e => e.id) ?? []); }, [online?.events]);
  const send = async (key: EmoteKey) => {
    if (sender === null || cooldown || sending.current) return;
    sending.current = true; setCooldown(true); setOpen(false);
    try {
      if (online) { await online.send(key); }
      else showEmote({ id: crypto.randomUUID(), playerId: sender, key, at: Date.now() });
    } finally { sending.current = false; schedule(() => setCooldown(false), EMOTE_COOLDOWN_MS); }
  };
  const controls = <>
    <Button size="icon" variant="ghost" title={enabled ? 'Matikan announcer' : 'Nyalakan announcer'} aria-label={enabled ? 'Matikan announcer' : 'Nyalakan announcer'} aria-pressed={enabled} onClick={() => { const next = !enabled; enabledRef.current = next; setEnabled(next); localStorage.setItem('100suara-announcer', next ? 'on' : 'off'); if (!next) { voice.current?.dispose(); voice.current = createAnnouncer(); } }}>{enabled ? <Mic /> : <MicOff />}</Button>
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" size="icon" title="Kirim emote" aria-label="Kirim emote" disabled={sender === null || cooldown}><Smile /></Button></PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-3"><div className="mb-2 text-xs font-semibold">{sender === null ? 'Emote' : state.players[sender]?.name}</div><div className="grid grid-cols-3 gap-2">{Object.entries(EMOTES).map(([key, emote]) => <Button key={key} variant="ghost" className="h-14 flex-col gap-1 px-1" title={emote.label} aria-label={emote.label} onClick={() => void send(key as EmoteKey)}><span className="text-2xl" aria-hidden>{emote.emoji}</span><span className="text-[10px]">{emote.label}</span></Button>)}</div></PopoverContent>
    </Popover>
  </>;
  return <MoodContext.Provider value={moods}><ControlsContext.Provider value={controls}>{children}</ControlsContext.Provider>
    {(cue || bubbles.length > 0) && typeof document !== 'undefined' && createPortal(<div className="arcade-reactions-layer" aria-live="polite">
      {cue && <div key={cue} className={`arcade-announcement arcade-announcement-${cue}`}>{CUE_LABEL[cue]}</div>}
      {bubbles.map(b => <div key={b.id} className="player-emote" data-player-emote={b.playerId} style={{ left: b.left, top: b.top }}><span className="player-emote-sticker" aria-hidden>{EMOTES[b.key].emoji}</span><strong>{state.players[b.playerId]?.name}</strong><span>{EMOTES[b.key].label}</span></div>)}
    </div>, document.body)}
  </MoodContext.Provider>;
}