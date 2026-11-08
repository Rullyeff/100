import { describe, expect, it } from 'vitest';
import { freshArcadeEvents, type ArcadeSnapshot } from './arcade-events';
const initial = (): ArcadeSnapshot => ({ version: 1, players: [{ id: 0, phase: 'outer', tokens: 0 }], spaces: [null], winners: [], hands: [10], payments: [] });
describe('public arcade reactions', () => {
  it('smiles for a new winner', () => { const a = initial(); expect(freshArcadeEvents(a, { ...a, version: 2, winners: [0] }).moods).toEqual([{ playerId: 0, mood: 'happy' }]); });
  it('looks shocked for a large loss, not a small loss', () => { const a = initial(); expect(freshArcadeEvents(a, { ...a, version: 2, hands: [7] }).moods).toEqual([{ playerId: 0, mood: 'shocked' }]); expect(freshArcadeEvents(a, { ...a, version: 2, hands: [9] }).moods).toEqual([]); });
  it('cries and announces bankruptcy only on actual elimination', () => { const a = initial(); expect(freshArcadeEvents(a, { ...a, version: 2, players: [{ id: 0, phase: 'out', tokens: 0 }], hands: [0] })).toEqual({ moods: [{ playerId: 0, mood: 'crying' }], cues: ['bankrupt'] }); expect(freshArcadeEvents(a, { ...a, version: 2, hands: [0] }).cues).toEqual([]); });
  it('announces a landmark only for a new claim', () => { const a = initial(); expect(freshArcadeEvents(a, { ...a, version: 2, spaces: [0] }).cues).toEqual(['landmark']); });
  it('announces toll only for visible player-to-player payment', () => { const a = initial(); expect(freshArcadeEvents(a, { ...a, version: 2, payments: ['1:A menyerahkan 3 suara kepada B'] }).cues).toEqual(['toll']); });
  it('does not replay on resume or polling', () => { const a = initial(); expect(freshArcadeEvents(a, { ...a, winners: [0], payments: ['payment'] })).toEqual({ moods: [], cues: [] }); });
});