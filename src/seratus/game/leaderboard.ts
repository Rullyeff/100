import { checkedAt } from "@/seratus/lib/checked-at";
import type { GameState } from "./engine";

export interface LeaderboardEntry {
  id: number;
  finishedAt: number;
  winners: string[];
  note: string;
  players: { name: string; area: number; score: number; isBot: boolean }[];
}

const KEY = "suara100-leaderboard-v1";

export function readLeaderboard(): LeaderboardEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Simpan hasil sekali per permainan (berdasarkan waktu mulai). */
export function recordResult(s: GameState) {
  const f = s.final;
  if (!f || f.stage !== "done") return;
  const list = readLeaderboard();
  if (list.some((e) => e.id === s.createdAt)) return;
  list.unshift({
    id: s.createdAt,
    finishedAt: Date.now(),
    winners: f.winners.map((id) => checkedAt(s.players, id).name),
    note: f.note,
    players: s.players.map((p) => ({ name: p.name, area: p.area, score: checkedAt(f.scores, p.id), isBot: p.isBot })),
  });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
}
