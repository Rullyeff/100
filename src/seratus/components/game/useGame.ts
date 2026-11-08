import { checkedAt } from "@/seratus/lib/checked-at";
import { botThinkMs } from './bot-pace';
import { useCallback, useEffect, useRef, useState } from "react";
import { recordResult } from "@/seratus/game/leaderboard";
import { createGame, tryReduce, checkInvariants, getActor, type Action, type GameState, type PlayerConfig } from "@/seratus/game/engine";
import { nextBotStep } from '@/seratus/game/bot';
import { upgradeBoard } from '@/seratus/game/board-upgrade';
import { redactGame } from '@/seratus/game/room-rules';

const KEY = 'suara-practice-local';

/** Practice / bot mode runs fully in the browser so it works on hosts without game storage. */
export function useGame() {
  const [full, setFull] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(700);
  const [paused, setPaused] = useState(false);
  const ref = useRef(full);
  ref.current = full;

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setFull(upgradeBoard(JSON.parse(raw) as GameState)); } catch { localStorage.removeItem(KEY); }
  }, []);

  const commit = useCallback((next: GameState | null) => {
    ref.current = next; setFull(next);
    try { if (next) localStorage.setItem(KEY, JSON.stringify(next)); else localStorage.removeItem(KEY); } catch { /* storage full */ }
  }, []);

  const apply = useCallback((action: Action) => {
    const s = ref.current; if (!s) return;
    const result = tryReduce(s, action);
    if (result.error) { setError(result.error); return; }
    if (checkInvariants(result.state).length) { setError('Perubahan suara ditolak.'); return; }
    setError(null); commit(result.state);
  }, [commit]);

  const state = full ? redactGame(full) : null;
  useEffect(() => { if (full) recordResult(full); }, [full]);

  useEffect(() => {
    if (!full || paused) return;
    const actor = getActor(full);
    if (actor === null || (typeof actor === 'number' && !checkedAt(full.players, actor).isBot) || (actor === 'host' && !full.players.every(p => p.isBot))) return;
    const t = setTimeout(() => { const current = ref.current; if (!current) return; const a = nextBotStep(current); if (a) apply(a); }, botThinkMs(full, speed));
    return () => clearTimeout(t);
  }, [full, paused, speed, apply]);

  const start = useCallback((configs: PlayerConfig[]) => {
    commit(createGame(configs, crypto.getRandomValues(new Uint32Array(1))[0])); setPaused(false);
  }, [commit]);
  const quit = useCallback(() => commit(null), [commit]);
  const restart = useCallback(() => {
    const cur = ref.current; if (!cur) return;
    commit(createGame(cur.players.map(p => ({ name: p.name, isBot: p.isBot, avatar: p.avatar })), crypto.getRandomValues(new Uint32Array(1))[0])); setPaused(false);
  }, [commit]);
  const dispatch = useCallback((action: Action) => { if (!paused) apply({ ...action, id: action.id ?? crypto.randomUUID() } as Action); }, [apply, paused]);

  return { state, saved: null, error, dispatch, start, resume: () => {}, quit, restart, speed, setSpeed, paused, setPaused, busy: false, actor: full ? getActor(full) : null };
}
