import { describe, expect, it } from "vitest";
import { freshBotReactions, type ReactionSnapshot } from "./bot-reactions";

const snapshot = (): ReactionSnapshot => ({ version: 1, players: [{ id: 0, isBot: true, votes: 4, phase: "outer", tokens: 0 }, { id: 1, isBot: false, votes: 2, phase: "outer", tokens: 0 }], winners: [], result: null, resultTone: null, currentId: 0 });
describe("fresh bot reactions", () => {
  it("reacts to a bot gain but not a human gain", () => {
    const before = snapshot(); const after = structuredClone(before); after.version++;
    after.players.forEach((p) => p.votes += 2);
    expect(freshBotReactions(before, after)).toEqual([{ playerId: 0, kind: "gain" }]);
  });
  it("reacts to a loss", () => {
    const before = snapshot(); const after = structuredClone(before); after.version++; after.players[0].votes -= 2;
    expect(freshBotReactions(before, after)).toEqual([{ playerId: 0, kind: "loss" }]);
  });
  it("prioritises gate entry over simultaneous rewards", () => {
    const before = snapshot(); const after = structuredClone(before); after.version++; after.players[0].phase = "gate"; after.players[0].votes += 2;
    expect(freshBotReactions(before, after)).toEqual([{ playerId: 0, kind: "gate" }]);
  });
  it("reacts to a new area token", () => {
    const before = snapshot(); const after = structuredClone(before); after.version++; after.players[0].tokens++;
    expect(freshBotReactions(before, after)).toEqual([{ playerId: 0, kind: "token" }]);
  });
  it("does not replay unchanged or older snapshots", () => {
    const before = snapshot(); const after = structuredClone(before); after.players[0].votes++;
    expect(freshBotReactions(before, after)).toEqual([]); after.version = 0;
    expect(freshBotReactions(before, after)).toEqual([]);
  });
  it("prioritises victory over finishing", () => {
    const before = snapshot(); const after = structuredClone(before); after.version++; after.winners = [0]; after.players[0].phase = "done";
    expect(freshBotReactions(before, after)).toEqual([{ playerId: 0, kind: "win" }]);
  });
});