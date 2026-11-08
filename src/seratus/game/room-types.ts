import type { GameState } from './engine';
import type { RoomEmote } from './emotes';

export interface RoomSeat { sessionId: string; name: string; area: number; avatar?: number | undefined; ready: boolean; lastSeen: number }
export interface RoomPayload { seats: RoomSeat[]; game: GameState | null; paused: boolean; receipts: string[]; emotes?: RoomEmote[] }
export interface RoomView {
  id: string; code: string; revision: number; isHost: boolean; viewer: number; paused: boolean; actor: number | 'host' | null;
  seats: { name: string; area: number; avatar?: number | undefined; ready: boolean; connected: boolean; isYou: boolean }[];
  game: GameState | null;
  emotes?: RoomEmote[];
}