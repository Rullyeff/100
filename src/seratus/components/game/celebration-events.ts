import { checkedAt } from "@/seratus/lib/checked-at";
import type { GameState, Phase } from "@/seratus/game/view";

export type CelebrationSnapshot = {
  version: number;
  players: { id: number; phase: Phase; tokens: number }[];
  spaces: (number | null)[];
  winners: number[];
};
export type CelebrationEvent = { playerId: number; kind: "win" | "done" | "pentagon" | "claim" | "token" };

/** Read only visible achievements, never pending answers, decks or random seeds. */
export function celebrationSnapshot(state: GameState): CelebrationSnapshot {
  return {
    version: state.version,
    players: state.players.map((p) => ({ id: p.id, phase: p.phase, tokens: p.areaTokens.filter(Boolean).length })),
    spaces: [...state.spaces],
    winners: state.stage === "over" ? [...(state.final?.winners ?? [])] : [],
  };
}

export function freshCelebrations(before: CelebrationSnapshot, after: CelebrationSnapshot): CelebrationEvent[] {
  if (after.version <= before.version) return [];
  return after.players.flatMap((p) => {
    const old = before.players.find((other) => other.id === p.id);
    if (!old) return [];
    let kind: CelebrationEvent["kind"] | null = null;
    if (after.winners.includes(p.id) && !before.winners.includes(p.id)) kind = "win";
    else if (p.phase !== old.phase && p.phase === "done") kind = "done";
    else if (p.phase !== old.phase && p.phase === "pentagon") kind = "pentagon";
    else if (after.spaces.some((owner, i) => owner === p.id && checkedAt(before.spaces, i) === null)) kind = "claim";
    else if (p.tokens > old.tokens) kind = "token";
    return kind ? [{ playerId: p.id, kind }] : [];
  });
}