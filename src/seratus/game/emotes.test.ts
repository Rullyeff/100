import { describe, expect, it } from 'vitest';
import { appendEmote } from './emotes';
describe('room emotes', () => {
  it('allows a player to react independently of turns', () => { expect(appendEmote([], 3, 'wave', 10000, 'one')).toEqual([{ id: 'one', playerId: 3, key: 'wave', at: 10000 }]); });
  it('rejects arbitrary text and inherited keys', () => { expect(() => appendEmote([], 0, 'hello', 1, 'x')).toThrow(); expect(() => appendEmote([], 0, 'constructor', 1, 'x')).toThrow(); });
  it('rate limits the sender, not opponents', () => { const events = appendEmote([], 0, 'cheer', 10000, 'one'); expect(() => appendEmote(events, 0, 'wave', 11000, 'two')).toThrow(); expect(appendEmote(events, 1, 'wave', 11000, 'two')).toHaveLength(2); });
  it('drops expired stickers', () => { const events = appendEmote([], 0, 'cheer', 10000, 'one'); expect(appendEmote(events, 1, 'wave', 17000, 'two')).toHaveLength(1); });
});