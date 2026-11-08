import { handCount, type GameState } from "@/seratus/game/view";

export function voteTotals(state: GameState): Record<number, number> {
  return Object.fromEntries(state.players.map((p) => [p.id, handCount(state, p.id)]));
}

export function voteChanges(before: Record<number, number>, after: Record<number, number>) {
  return Object.entries(after).flatMap(([id, total]) => {
    const previous = before[Number(id)];
    return previous === undefined || previous === total ? [] : [{ playerId: Number(id), delta: total - previous }];
  });
}