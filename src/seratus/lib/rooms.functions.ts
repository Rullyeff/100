import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireGameBackend } from './game-backend-config';
import { isEmoteKey } from '@/seratus/game/emotes';

const nickname = z.string().trim().min(1).max(18);
export const roomRequest = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    op: z.enum(['restore','create','join','read','ready','start','pause','leave','action','bot','emote']),
    emote: z.string().refine(isEmoteKey, 'Emote tidak tersedia.').optional(),
    roomId: z.string().uuid().optional(), code: z.string().trim().max(12).optional(),
    name: nickname.optional(), area: z.number().int().min(0).max(4).optional(),
    ready: z.boolean().optional(), paused: z.boolean().optional(),
    action: z.unknown().optional(), contextKey: z.string().max(200).optional(),
    mode: z.enum(['online','local']).optional(), avatar: z.number().int().min(0).max(17).optional(),
    configs: z.array(z.object({name:nickname,isBot:z.boolean(),avatar:z.number().int().min(0).max(17).optional()})).length(5).optional(),
  }))
  .handler(async ({data}) => {
    requireGameBackend(process.env['SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY']);
    const { handleRoomRequest } = await import('./rooms.server');
    return handleRoomRequest(data);
  });