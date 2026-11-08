import { handCount, type GameState } from '@/seratus/game/view';
import { celebrationSnapshot, type CelebrationSnapshot } from './celebration-events';

export type ArcadeMood = 'happy' | 'shocked' | 'crying';
export type Cue = 'start' | 'toll' | 'landmark' | 'bankrupt';
export type ArcadeSnapshot = CelebrationSnapshot & { hands: number[]; payments: string[] };
export function arcadeSnapshot(state: GameState): ArcadeSnapshot {
  return { ...celebrationSnapshot(state), hands: state.players.map(p => handCount(state, p.id)),
    payments: state.log.filter(l => /menyerahkan \d+ suara kepada/.test(l.text)).map(l => `${l.at}:${l.text}`) };
}
/** Cosmetic thresholds only; never changes payment or elimination rules. */
export function freshArcadeEvents(before: ArcadeSnapshot, after: ArcadeSnapshot) {
  const moods: { playerId: number; mood: ArcadeMood }[] = [];
  const cues: Cue[] = [];
  if (after.version <= before.version) return { moods, cues };
  for (const p of after.players) {
    const old = before.players.find(o => o.id === p.id);
    if (!old) continue;
    if (p.phase === 'out' && old.phase !== 'out') { moods.push({ playerId: p.id, mood: 'crying' }); cues.push('bankrupt'); }
    else if (after.winners.includes(p.id) && !before.winners.includes(p.id)) moods.push({ playerId: p.id, mood: 'happy' });
    else if ((before.hands[p.id] ?? 0) - (after.hands[p.id] ?? 0) >= 3) moods.push({ playerId: p.id, mood: 'shocked' });
    else if ((after.hands[p.id] ?? 0) > (before.hands[p.id] ?? 0)) moods.push({ playerId: p.id, mood: 'happy' });
  }
  if (after.spaces.some((owner, i) => owner !== null && before.spaces[i] === null)) cues.push('landmark');
  if (after.payments.some(p => !before.payments.includes(p))) cues.push('toll');
  return { moods, cues: [...new Set(cues)] };
}