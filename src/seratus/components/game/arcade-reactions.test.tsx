import { checkedAt } from "@/seratus/lib/checked-at";
import { render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '@/seratus/game/engine';
import { PlayerAvatar } from './PlayerAvatar';
import { ArcadeReactions } from './ArcadeReactions';
vi.mock('@/seratus/lib/announcer', () => ({ createAnnouncer: () => ({ say: vi.fn(), dispose: vi.fn() }), CUE_LABEL: { start: 'Game Start!', toll: 'Toll payment!', landmark: 'Landmark!', bankrupt: 'Bankrupt!' } }));
afterEach(() => vi.useRealTimers());
describe('chibi presentation lifecycle', () => {
  it('shows the winning reaction and clears a temporary reaction', () => {
    vi.useFakeTimers();
    const initial = createGame(Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, isBot: false })), 1);
    const content = (state: typeof initial) => <ArcadeReactions state={state} sender={0}><PlayerAvatar area={0} playerId={0} /></ArcadeReactions>;
    const view = render(content(initial));
    const after = structuredClone(initial); after.version++; checkedAt(after.players, 0).phase = 'out';
    view.rerender(content(after));
    expect(screen.getByRole('img', { name: /menangis/ })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3300));
    expect(screen.queryByRole('img', { name: /menangis/ })).not.toBeInTheDocument();
  });
  it('keeps a resumed untouched game silent', () => {
    const state = createGame(Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, isBot: false })), 1);
    state.log.forEach(entry => { entry.at = Date.now() - 60000; });
    render(<ArcadeReactions state={state} sender={0}><PlayerAvatar area={0} /></ArcadeReactions>);
    expect(screen.queryByText('Game Start!')).not.toBeInTheDocument();
  });
});