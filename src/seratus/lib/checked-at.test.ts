import { describe, expect, it } from 'vitest';
import { checkedAt } from './checked-at';

describe('indexed game data', () => {
  it('returns an existing value without changing null values', () => {
    expect(checkedAt([null, 4], 0)).toBeNull();
    expect(checkedAt([null, 4], 1)).toBe(4);
  });
  it('rejects missing data', () => { expect(() => checkedAt([4], 1)).toThrow(); });
});