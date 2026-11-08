import { DEMOKRASI, KEJUTAN, deckSource as publicDeckSource } from "@/seratus/game/public-cards";
import type { GameState, Pending } from "@/seratus/game/engine";

export type DeckCat = "A" | "D" | "R" | "K" | "P";
/** Display order of the five card categories (Panduan: A, D, Putusan Rakyat, K, P). */
export const DECK_ORDER: DeckCat[] = ["A", "D", "K", "P", "R"];

/** Per-space draws ("D:cekfakta", "K:peristiwa" …), matching the engine's deck keys. */
const deckSource = (key: string) =>
  key.startsWith("D:") ? DEMOKRASI.filter((c) => c.sub === key.slice(2)).map((c) => c.id)
  : key.startsWith("K:") ? KEJUTAN.filter((c) => c.sub === key.slice(2)).map((c) => c.id)
  : publicDeckSource(key);

const KEYS: Record<DeckCat, string[]> = {
  A: [1, 2, 3].flatMap((l) => [0, 1, 2, 3, 4].map((a) => `A${l}-${a}`)),
  D: ["D:cekfakta", "D:dilema", "D:refleksi", "MISI", "FDT"],
  R: ["PR"],
  K: ["K:peristiwa", "K:kesempatan"],
  P: ["P"],
};

export const DECK_INFO: Record<DeckCat, { name: string; bg: string; border: string; text: string; letter: string }> = {
  A: { name: "Aspirasi", bg: "bg-deck-a", border: "border-deck-a", text: "text-deck-a", letter: "A" },
  D: { name: "Demokrasi", bg: "bg-deck-d", border: "border-deck-d", text: "text-deck-d", letter: "D" },
  R: { name: "Putusan Rakyat", bg: "bg-deck-r", border: "border-deck-r", text: "text-deck-r", letter: "R" },
  K: { name: "Kejutan", bg: "bg-deck-k", border: "border-deck-k", text: "text-deck-k", letter: "K" },
  P: { name: "Pentagon", bg: "bg-deck-p", border: "border-deck-p", text: "text-deck-p", letter: "P" },
};

/** CSS colour token per deck, for inline `--deck` styling. */
export const DECK_VAR: Record<DeckCat, string> = { A: "var(--deck-a)", D: "var(--deck-d)", R: "var(--deck-r)", K: "var(--deck-k)", P: "var(--deck-p)" };

/** Which deck sits on each of the four card pictures on the board art (same order as the board's card spots). */
export const SPOT_DECKS: DeckCat[] = ["A", "D", "K", "P"];

export function deckCounts(s: GameState, cat: DeckCat) {
  let left = 0;
  let total = 0;
  for (const k of KEYS[cat]) {
    const full = deckSource(k).length;
    total += full;
    left += s.decks[k]?.length ?? full;
  }
  return { left, total };
}

export function cardCat(id: string): DeckCat {
  if (id.startsWith("A")) return "A";
  if (id.startsWith("PR-")) return "R";
  if (id.startsWith("K-")) return "K";
  if (id.startsWith("P-")) return "P";
  return "D";
}

export function pendingCardId(p: Pending | null): string | null {
  return p && "cardId" in p ? p.cardId : null;
}
