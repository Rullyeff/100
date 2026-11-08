import { describe, expect, it } from "vitest";
import { voteChanges } from "./vote-changes";

describe("fresh projected vote changes", () => {
  it("reports a gain of five votes", () => {
    expect(voteChanges({ 0: 2 }, { 0: 7 })).toEqual([{ playerId: 0, delta: 5 }]);
  });
  it("reports both ends of a transfer", () => {
    expect(voteChanges({ 0: 7, 1: 3 }, { 0: 5, 1: 5 })).toEqual([{ playerId: 0, delta: -2 }, { playerId: 1, delta: 2 }]);
  });
  it("does not replay unchanged totals or initial totals", () => {
    expect(voteChanges({ 0: 7 }, { 0: 7, 1: 3 })).toEqual([]);
  });
});