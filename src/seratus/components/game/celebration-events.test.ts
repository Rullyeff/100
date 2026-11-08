import { describe, expect, it } from "vitest";
import { freshCelebrations, type CelebrationSnapshot } from "./celebration-events";

const initial: CelebrationSnapshot = { version: 1, players: [{ id: 0, phase: "outer", tokens: 0 }], spaces: [null], winners: [] };
describe("public achievement celebrations", () => {
  it("does not replay the same or older snapshot", () => {
    expect(freshCelebrations(initial, { ...initial, winners: [0] })).toEqual([]);
    expect(freshCelebrations(initial, { ...initial, version: 0, winners: [0] })).toEqual([]);
  });
  it("celebrates a newly gained area token", () => {
    expect(freshCelebrations(initial, { ...initial, version: 2, players: [{ id: 0, phase: "outer", tokens: 1 }] })).toEqual([{ playerId: 0, kind: "token" }]);
  });
  it("celebrates a new claim but not an ownership transfer", () => {
    expect(freshCelebrations(initial, { ...initial, version: 2, spaces: [0] })).toEqual([{ playerId: 0, kind: "claim" }]);
    expect(freshCelebrations({ ...initial, spaces: [1] }, { ...initial, version: 2, spaces: [0] })).toEqual([]);
  });
  it("prioritises a new winner over other achievements", () => {
    expect(freshCelebrations(initial, { ...initial, version: 2, winners: [0], spaces: [0] })).toEqual([{ playerId: 0, kind: "win" }]);
  });
  it("celebrates entering Pentagon and finishing, not elimination", () => {
    for (const phase of ["pentagon", "done"] as const) {
      expect(freshCelebrations(initial, { ...initial, version: 2, players: [{ id: 0, phase, tokens: 0 }] })).toEqual([{ playerId: 0, kind: phase }]);
    }
    expect(freshCelebrations(initial, { ...initial, version: 2, players: [{ id: 0, phase: "out", tokens: 0 }] })).toEqual([]);
  });
});