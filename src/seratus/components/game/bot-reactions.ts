import { currentPlayer, legalVotes, type GameState, type Phase } from "@/seratus/game/view";

export type ReactionKind = "gain" | "loss" | "token" | "gate" | "pentagon" | "done" | "out" | "win" | "retry";
export type BotReaction = { playerId: number; kind: ReactionKind };
export type ReactionSnapshot = {
  version: number;
  players: { id: number; isBot: boolean; votes: number; phase: Phase; tokens: number }[];
  winners: number[];
  result: string | null;
  resultTone: string | null;
  currentId: number;
};

/** Public facts only: no answer keys, hidden votes or pending answers. */
export function reactionSnapshot(state: GameState): ReactionSnapshot {
  return {
    version: state.version,
    players: state.players.map((p) => ({ id: p.id, isBot: p.isBot, votes: legalVotes(state, p.id), phase: p.phase, tokens: p.areaTokens.filter(Boolean).length })),
    winners: state.stage === "over" ? state.final?.winners ?? [] : [],
    result: state.lastResult ? `${state.turnCount}-${state.turnIdx}-${state.lastResult.title}-${state.lastResult.tone}` : null,
    resultTone: state.lastResult?.tone ?? null,
    currentId: currentPlayer(state).id,
  };
}

/** One reaction per bot per fresh update, prioritising milestones over score changes. */
export function freshBotReactions(before: ReactionSnapshot, after: ReactionSnapshot): BotReaction[] {
  if (after.version <= before.version) return [];
  return after.players.flatMap((p) => {
    const old = before.players.find((other) => other.id === p.id);
    if (!p.isBot || !old) return [];
    let kind: ReactionKind | null = null;
    if (after.winners.includes(p.id) && !before.winners.includes(p.id)) kind = "win";
    else if (p.phase !== old.phase && p.phase !== "outer") kind = p.phase;
    else if (p.votes < old.votes) kind = "loss";
    else if (p.tokens > old.tokens) kind = "token";
    else if (p.votes > old.votes) kind = "gain";
    else if (p.id === after.currentId && after.result !== before.result && after.resultTone === "loss") kind = "retry";
    return kind ? [{ playerId: p.id, kind }] : [];
  });
}

export const REACTION_COPY: Record<ReactionKind, { emoji: string; lines: string[] }> = {
  gain: { emoji: "🤩", lines: ["Asyik, tambah suara!", "Mantap!", "Sedikit demi sedikit!"] },
  loss: { emoji: "😅", lines: ["Wah, berkurang…", "Masih bisa mengejar!", "Tetap semangat!"] },
  token: { emoji: "🙌", lines: ["Token baru!", "Satu area lagi!", "Makin lengkap!"] },
  gate: { emoji: "🗳️", lines: ["Menuju gerbang!", "Siap bermusyawarah!"] },
  pentagon: { emoji: "🚩", lines: ["Pentagon, aku datang!", "Saatnya bangun wilayah!"] },
  done: { emoji: "🎉", lines: ["Sampai di pusat!", "Tuntas, teman-teman!"] },
  out: { emoji: "👋", lines: ["Sampai ronde berikutnya!", "Semangat, teman-teman!"] },
  win: { emoji: "🏆", lines: ["Hore! Terima kasih semua!"] },
  retry: { emoji: "🤔", lines: ["Coba lagi nanti!", "Belajar lagi, yuk!"] },
};