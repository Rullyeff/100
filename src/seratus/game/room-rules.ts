import { currentPlayer, fdtVoters, getActor, votersFor, type Action, type GameState } from './view';

export function viewerActor(s: GameState, viewer: number, isHost: boolean): number | 'host' | null {
  const p = s.pending;
  const cur = currentPlayer(s).id;
  if (p?.kind === 'putusan' || (p?.kind === 'forum' && p.stance !== null)) {
    return votersFor(s, cur).includes(viewer) && p.votes[viewer] === undefined ? viewer : null;
  }
  if (p?.kind === 'duel') return [cur,p.opponent].includes(viewer) && p.answers[viewer] === undefined ? viewer : null;
  if (p?.kind === 'forfeit') return p.payer === viewer ? viewer : null;
  if (s.stage === 'over' && s.final) {
    const f = s.final;
    if (f.stage === 'argue') return isHost ? 'host' : null;
    if (f.stage === 'vote') return fdtVoters(s).includes(viewer) && f.votes[viewer] === undefined ? viewer : null;
    if (f.stage === 'objective') return f.finalists.includes(viewer) && f.objective?.answers[viewer] === undefined ? viewer : null;
  }
  return getActor(s) === viewer ? viewer : null;
}

export function authorizeRoomAction(s: GameState, a: Action, viewer: number, isHost: boolean): Action {
  const actor = viewerActor(s,viewer,isHost);
  if (actor === null) throw new Error('Bukan giliranmu atau pilihan sudah dikunci.');
  if (a.type === 'ROLL' && a.value !== undefined) throw new Error('Dadu ditentukan oleh sistem.');
  if (a.type === 'VOTE' && a.voter !== viewer) throw new Error('Tidak boleh memilih sebagai pemain lain.');
  if ((a.type === 'DUEL_ANSWER' || a.type === 'FDT_ANSWER' || a.type === 'FORFEIT') && a.player !== viewer) throw new Error('Tidak boleh menjawab sebagai pemain lain.');
  if (a.type === 'FDT_START_VOTE' && !isHost) throw new Error('Hanya pembuat ruang dapat menutup debat.');
  if (actor === 'host' && a.type !== 'FDT_START_VOTE') throw new Error('Aksi tidak tersedia.');
  return a;
}

export function redactGame(s: GameState): GameState {
  const v = structuredClone(s);
  v.seed = 0;
  v.seenActions = [];
  // Only counts survive; no remaining card IDs or shuffled deck order.
  v.decks = Object.fromEntries(Object.entries(s.decks).map(([k,d])=>[k,Array.from({length:d.length},()=> '')]));
  const hide = (values: Record<number,number>) => Object.fromEntries(Object.keys(values).map(k=>[k,-1]));
  if (v.pending?.kind === 'putusan' || v.pending?.kind === 'forum') v.pending.votes = hide(v.pending.votes);
  if (v.pending?.kind === 'duel') v.pending.answers = hide(v.pending.answers);
  if (v.final) {
    v.final.votes = hide(v.final.votes);
    if (v.final.objective) v.final.objective.answers = hide(v.final.objective.answers);
  }
  return v;
}