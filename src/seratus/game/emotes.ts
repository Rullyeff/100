export const EMOTES = {
  cheer: { emoji: '🎉', label: 'Mantap!' }, wave: { emoji: '👋', label: 'Halo!' },
  wow: { emoji: '😮', label: 'Wah!' }, laugh: { emoji: '😆', label: 'Hehe!' },
  cry: { emoji: '😭', label: 'Aduh!' }, respect: { emoji: '🤝', label: 'Salam sportif!' },
} as const;
export type EmoteKey = keyof typeof EMOTES;
export type RoomEmote = { id: string; playerId: number; key: EmoteKey; at: number };
export const EMOTE_LIFE_MS = 7000;
export const EMOTE_COOLDOWN_MS = 2000;
export function isEmoteKey(key: unknown): key is EmoteKey { return typeof key === 'string' && Object.hasOwn(EMOTES, key); }
export function appendEmote(events: RoomEmote[], playerId: number, key: unknown, now: number, id: string): RoomEmote[] {
  if (!isEmoteKey(key)) throw new Error('Emote tidak tersedia.');
  const fresh = events.filter(e => now - e.at < EMOTE_LIFE_MS);
  if (fresh.some(e => e.playerId === playerId && now - e.at < EMOTE_COOLDOWN_MS)) throw new Error('Tunggu sebentar sebelum mengirim emote lagi.');
  return [...fresh, { id, playerId, key, at: now }].slice(-20);
}