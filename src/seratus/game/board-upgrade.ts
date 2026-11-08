import type { GameState } from "./engine";
import { CLAIM_COST, PENT_TOTAL, RULESET, escrowLoc } from "./view";

/** Preserve progress, ownership, and all token locations in pre-expansion rooms. */
function upgradeTopology(state: GameState): GameState {
  if (state.spaces.length !== 10) return state;
  const next = structuredClone(state);
  next.spaces = Array.from({ length: PENT_TOTAL }, () => null);
  state.spaces.forEach((owner, oldSpace) => { next.spaces[oldSpace * 2] = owner; });
  next.tokens.forEach(token => {
    if (token.loc >= 100 && token.loc < 110) token.loc = 100 + (token.loc - 100) * 2;
  });
  next.players.forEach(player => {
    if (player.outerPos >= 0) player.outerPos = Math.floor(player.outerPos / 10) * 15 + Math.floor((player.outerPos % 10) * 1.5);
    player.gatePos = Math.ceil(player.gatePos * 5 / 3);
    player.pentSteps *= 2;
  });
  if (next.pending && "space" in next.pending) next.pending.space *= 2;
  next.version += 1;
  return next;
}

/**
 * Move saved games to the current guide's rules without changing the 100-vote total:
 * surplus claim escrow returns to the owner's hand, homebases start with their area owner,
 * and decisions that no longer exist (Mati Suri, contribution) are closed.
 */
function upgradeRules(state: GameState): GameState {
  if (state.ruleset === RULESET) return state;
  const next = structuredClone(state);
  next.ruleset = RULESET;
  next.homeOwner = Array.from({ length: 5 }, (_, area) => next.players.find(p => p.area === area)?.id ?? area);
  next.extended = next.extended ?? null;
  next.spaces.forEach((owner, sp) => {
    if (owner === null) return;
    let extra = next.tokens.filter(t => t.loc === escrowLoc(sp)).length - CLAIM_COST;
    for (const t of next.tokens) {
      if (extra <= 0) break;
      if (t.loc === escrowLoc(sp)) { t.loc = owner; extra--; }
    }
  });
  next.players.forEach(p => {
    const legacy = p as unknown as Record<string, unknown>;
    for (const key of ["dormant", "recoveryDue", "everHadVotes"]) delete legacy[key];
  });
  const kind = (next.pending as { kind?: string } | null)?.kind;
  if (kind === "contest" || kind === "pquiz") {
    next.pending = null;
    next.stage = "end";
  }
  if (next.pending?.kind === "duel" && next.pending.home === undefined) next.pending.home = false;
  next.version += 1;
  return next;
}

export function upgradeBoard(state: GameState): GameState {
  return upgradeRules(upgradeTopology(state));
}
