import { describe, expect, it } from "vitest";
import { pawnPos } from "@/seratus/game/board";
import type { Player } from "@/seratus/game/view";
import { pawnRoute } from "./pawn-motion";

const player: Player = { id: 3, name: "Pemain", area: 3, isBot: false, phase: "outer", outerPos: -1, gatePos: 0, pentRound: 1, pentSteps: 0, areaTokens: [], emergency: 0, skipTurns: 0 };
const at = (patch: Partial<Player>) => ({ ...player, ...patch });

describe("projected per-space pawn journeys", () => {
  it("visits every space on first departure from its own START", () => {
    expect(pawnRoute(player, at({ outerPos: 47 }))).toEqual([
      pawnPos(player), pawnPos(at({ outerPos: 45 })), pawnPos(at({ outerPos: 46 })), pawnPos(at({ outerPos: 47 })),
    ]);
  });
  it("keeps each landed space when the outer track wraps", () => {
    expect(pawnRoute(at({ outerPos: 74 }), at({ outerPos: 1 }))).toEqual([pawnPos(at({ outerPos: 74 })), pawnPos(at({ outerPos: 0 })), pawnPos(at({ outerPos: 1 }))]);
  });
  it("visits gates before entering home", () => {
    expect(pawnRoute(at({ phase: "gate", gatePos: 3 }), at({ phase: "pentagon" }))).toEqual([
      pawnPos(at({ phase: "gate", gatePos: 3 })), pawnPos(at({ phase: "gate", gatePos: 4 })), pawnPos(at({ phase: "gate", gatePos: 5 })), pawnPos(at({ phase: "pentagon" })),
    ]);
  });
  it("visits the remaining pentagon space on a round rollover", () => {
    expect(pawnRoute(at({ phase: "pentagon", pentSteps: 18 }), at({ phase: "pentagon", pentRound: 2 }))).toEqual([
      pawnPos(at({ phase: "pentagon", pentSteps: 18 })), pawnPos(at({ phase: "pentagon", pentSteps: 19 })), pawnPos(at({ phase: "pentagon", pentRound: 2 })),
    ]);
  });
  it("travels backward rather than around the whole board for a short retreat", () => {
    expect(pawnRoute(at({ outerPos: 5 }), at({ outerPos: 3 }))).toEqual([pawnPos(at({ outerPos: 5 })), pawnPos(at({ outerPos: 4 })), pawnPos(at({ outerPos: 3 }))]);
  });
  it("does not replay a journey for an unchanged polling snapshot", () => {
    expect(pawnRoute(player, { ...player })).toEqual([]);
  });
});