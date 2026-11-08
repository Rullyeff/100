import type { GameState } from './engine';
export function roomContextKey(s: GameState) {
 const p=s.pending;
 return [s.turnCount,s.turnIdx,s.stage,s.extraRollUsed,p?.kind,p&&'cardId' in p?p.cardId:'',s.final?.stage,s.final?.objective?.cardId,s.final?.objective?.round].join(':');
}