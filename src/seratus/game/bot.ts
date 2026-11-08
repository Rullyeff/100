import { checkedAt } from "@/seratus/lib/checked-at";
import { card, type AspirasiCard, type DemokrasiCard, type McqCard } from "./cards";
import { canClaim, currentPlayer, getActor, handCount, type Action, type GameState } from "./engine";

/** Bot sederhana: menjawab benar dengan peluang tertentu, voting acak berbobot. */
export function botAction(s: GameState, actor: number | "host", rnd: () => number = Math.random): Action | null {
  const skill = 0.68;
  const mcq = (answer: number, n: number) => (rnd() < skill ? answer : Math.floor(rnd() * n));
  const sjt = (weights: number[]) => {
    const r = rnd();
    const target = r < 0.5 ? 5 : r < 0.75 ? 4 : r < 0.9 ? 3 : 1 + Math.floor(rnd() * 2);
    return { type: "ANSWER" as const, choice: Math.max(0, weights.indexOf(target)) };
  };
  if (s.stage === "over") {
    const f = s.final;
    if (!f) return null;
    if (f.stage === "argue") return { type: "FDT_START_VOTE" };
    if (f.stage === "vote" && typeof actor === "number")
      return { type: "VOTE", voter: actor, choice: checkedAt(f.finalists, Math.floor(rnd() * f.finalists.length)) };
    if (f.stage === "objective" && f.objective && typeof actor === "number") {
      const c = card<McqCard>(f.objective.cardId);
      return { type: "FDT_ANSWER", player: actor, choice: mcq(c.answer ?? 0, c.options.length) };
    }
    return null;
  }
  if (s.stage === "roll") return { type: "ROLL" };
  if (s.stage === "end") return { type: "END_TURN" };
  const pend = s.pending;
  if (!pend || typeof actor !== "number") return null;
  const me = currentPlayer(s);
  switch (pend.kind) {
    case "aspirasi": {
      const c = card<AspirasiCard>(pend.cardId);
      if (c.weights) return sjt(c.weights);
      return { type: "ANSWER", choice: mcq(c.answer ?? 0, c.options.length) };
    }
    case "cekfakta":
    case "misi": {
      const c = card<McqCard | DemokrasiCard>(pend.cardId) as McqCard;
      return { type: "ANSWER", choice: mcq(c.answer ?? 0, c.options.length) };
    }
    case "dilema": {
      const c = card<DemokrasiCard>(pend.cardId);
      if (c.weights) return sjt(c.weights);
      return { type: "ANSWER", choice: Math.floor(rnd() * (c.choices?.length ?? 1)) };
    }
    case "refleksi": {
      const c = card<DemokrasiCard>(pend.cardId);
      if (c.options && c.answer !== undefined) return { type: "ANSWER", choice: mcq(c.answer ?? 0, c.options.length) };
      return { type: "ACK" };
    }
    case "kejutan":
      return { type: "ACK" };
    case "forum":
      if (pend.stance === null) return { type: "FORUM_STANCE", choice: rnd() < 0.7 ? 0 : 1 };
      return { type: "VOTE", voter: actor, choice: rnd() < 0.6 ? 0 : 1 };
    case "putusan":
      return { type: "VOTE", voter: actor, choice: rnd() < 0.5 ? 0 : 1 };
    case "claim":
      // Putaran 1 berani menjaminkan semua; putaran berikutnya menyisakan cadangan suara.
      return { type: "CLAIM", accept: canClaim(s, me) && (me.pentRound === 1 || handCount(s, me.id) >= 6) };
    case "duel": {
      const c = card<McqCard>(pend.cardId);
      return { type: "DUEL_ANSWER", player: actor, choice: mcq(c.answer ?? 0, c.options.length) };
    }
    case "forfeit": {
      // Pilih kerugian suara paling kecil: Gerbang Aman (tanpa suara) bila masih punya cadangan, lalu petak, lalu suara.
      const order = (t: string) => (t === "home" ? 0 : t === "space" ? 1 : 2);
      const ranked = pend.options.map((o, i) => ({ o, i })).sort((a, b) => order(a.o.type) - order(b.o.type));
      return { type: "FORFEIT", player: actor, option: checkedAt(ranked, 0).i };
    }
  }
  return null;
}

/** Jalankan satu langkah bot bila aktor saat ini adalah bot. */
export function nextBotStep(s: GameState, rnd?: () => number): Action | null {
  const actor = getActor(s);
  if (actor === null) return null;
  if (actor !== "host" && !checkedAt(s.players, actor).isBot) return null;
  if (actor === "host" && !s.players.every((p) => p.isBot)) return null;
  return botAction(s, actor, rnd);
}
