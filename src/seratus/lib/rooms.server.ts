import { getCookie, getRequest, setCookie, setResponseHeader } from '@tanstack/react-start/server';
import { z } from 'zod';
import { createGame, tryReduce, checkInvariants, getActor, type Action, type GameState } from '@/seratus/game/engine';
import { authorizeRoomAction, redactGame } from '@/seratus/game/room-rules';
import type { RoomPayload, RoomView } from '@/seratus/game/room-types';
import { roomContextKey } from '@/seratus/game/room-context';
import { nextBotStep } from '@/seratus/game/bot';
import { canJoinRoom, canStartRoom } from '@/seratus/game/room-seats';
import { upgradeBoard } from '@/seratus/game/board-upgrade';
import { storageErrorMessage } from './game-backend-config';
import { appendEmote, EMOTE_LIFE_MS } from '@/seratus/game/emotes';

type Input = { op: string; emote?: string|undefined; roomId?: string|undefined; code?: string|undefined; name?: string|undefined; area?: number|undefined; ready?: boolean|undefined; paused?: boolean|undefined; action?: unknown; contextKey?: string|undefined; mode?:'online'|'local'|undefined; avatar?:number|undefined; configs?:{name:string;isBot:boolean;avatar?:number|undefined}[]|undefined };
const choice = z.number().int().min(0).max(4);
const actionSchema = z.discriminatedUnion('type',[
 z.object({type:z.literal('ROLL')}),z.object({type:z.literal('ANSWER'),choice}),
 z.object({type:z.literal('ACK')}),z.object({type:z.literal('FORUM_STANCE'),choice:z.number().int().min(0).max(1)}),
 z.object({type:z.literal('VOTE'),voter:z.number().int().min(0).max(4),choice}),
 z.object({type:z.literal('CLAIM'),accept:z.boolean()}),
 z.object({type:z.literal('FORFEIT'),player:z.number().int().min(0).max(4),option:z.number().int().min(0).max(10)}),
 z.object({type:z.literal('DUEL_ANSWER'),player:z.number().int().min(0).max(4),choice}),
 z.object({type:z.literal('END_TURN')}),z.object({type:z.literal('FDT_START_VOTE')}),
 z.object({type:z.literal('FDT_ANSWER'),player:z.number().int().min(0).max(4),choice}),
]);
const DAY = 86400000;
async function hash(token: string) {
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('');
}

export async function handleRoomRequest(input: Input): Promise<RoomView | null> {
 setResponseHeader('Cache-Control','no-store');
 const req = getRequest();
 const origin = req.headers.get('origin');
 if (origin && origin !== new URL(req.url).origin) throw new Error('Permintaan ruang tidak sah.');
 const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
 let token = getCookie('suara-guest');
 let sessionId: string | undefined;
 if (token) {
  const {data} = await db.from('game_guest_sessions').select('id').eq('token_hash',await hash(token)).gt('expires_at',new Date().toISOString()).maybeSingle();
  sessionId = data?.id;
 }
 if (!sessionId) {
  if (!['create','join'].includes(input.op)) return null;
  token = crypto.randomUUID()+crypto.randomUUID();
  const {data,error} = await db.from('game_guest_sessions').insert({token_hash:await hash(token),expires_at:new Date(Date.now()+7*DAY).toISOString()}).select('id').single();
  if (error || !data) { console.error('guest session insert failed', error?.code, error?.message); throw new Error(storageErrorMessage(error,'Tidak dapat membuka sesi. Coba kembali.')); }
  sessionId = data.id;
  const secure = new URL(req.url).protocol==='https:' || req.headers.get('x-forwarded-proto')==='https';
  setCookie('suara-guest',token,{httpOnly:true,secure,sameSite:secure?'none':'lax',path:'/',maxAge:7*86400});
 }
 const sid = sessionId;
 if (input.op === 'create') {
  if (input.mode!=='local' && (!input.name || input.area === undefined)) throw new Error('Isi nama dan pilih area.');
  const {count} = await db.from('game_rooms').select('id',{count:'exact',head:true}).eq('host_session_id',sid).gt('expires_at',new Date().toISOString());
  if ((count??0)>=10) throw new Error('Batas ruang aktif tercapai.');
  const payload: RoomPayload = {seats:[{sessionId:sid,name:input.name??'Latihan',area:input.area??0,avatar:input.avatar,ready:false,lastSeen:Date.now()}],game:null,paused:false,receipts:[]};
  if(input.mode==='local') {
   if(!input.configs || input.configs.length!==5) throw new Error('Butuh lima pemain.');
   payload.game=createGame(input.configs,crypto.getRandomValues(new Uint32Array(1))[0]);
  }
  const bytes=crypto.getRandomValues(new Uint8Array(8));
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code=Array.from(bytes,n=>alphabet[n%alphabet.length]).join('');
  const {data,error} = await db.from('game_rooms').insert({code,host_session_id:sid,mode:input.mode??'online',payload:JSON.parse(JSON.stringify(payload)),expires_at:new Date(Date.now()+DAY).toISOString()}).select('*').single();
  if (error || !data) throw new Error(storageErrorMessage(error,'Ruang belum dapat dibuat. Coba kembali.'));
  return project(data,payload,sid);
 }
 if (input.op === 'restore' && !input.roomId) return null;
 for (let retry=0;retry<6;retry++) {
  let q = db.from('game_rooms').select('*').gt('expires_at',new Date().toISOString());
  q = input.op==='join' ? q.eq('code',(input.code??'').toUpperCase()) : q.eq('id',input.roomId??'00000000-0000-0000-0000-000000000000');
  const {data:room,error} = await q.maybeSingle();
  if (error || !room) throw new Error('Ruang tidak ditemukan atau sudah kedaluwarsa.');
  const payload = room.payload as unknown as RoomPayload;
  const me = payload.seats.find(s=>s.sessionId===sid);
  const host=room.host_session_id===sid;
  if (input.op==='join' && room.mode!=='online') throw new Error('Ruang latihan tidak menerima undangan.');
  if (input.op==='join' && !me) {
   if (!input.name || input.area===undefined) throw new Error('Isi nama dan area.');
   canJoinRoom(payload.seats,input.area,!!payload.game);
   payload.seats.push({sessionId:sid,name:input.name,area:input.area,avatar:input.avatar,ready:false,lastSeen:Date.now()});
  } else if (!me) throw new Error('Kamu bukan anggota ruang ini.');
  const upgraded = payload.game ? upgradeBoard(payload.game) : null;
  const boardChanged = upgraded !== payload.game;
  if (boardChanged) payload.game = upgraded;
  if (input.op==='read' || input.op==='restore' || (input.op==='join' && me)) {
   if (boardChanged || (me && Date.now()-me.lastSeen>10000)) {
    if (me) me.lastSeen=Date.now();
    const {data:committed,error:commitError}=await db.rpc('commit_game_room',{p_id:room.id,p_revision:room.revision,p_payload:JSON.parse(JSON.stringify(payload))});
    if(commitError) throw new Error('Perubahan belum tersimpan. Coba kembali.');
    if(!committed) continue;
    return project({...room,revision:room.revision+1},payload,sid);
   }
   return project(room,payload,sid);
  }
  if (me) me.lastSeen=Date.now();
  if (input.op === 'emote') {
   if (!me || !payload.game || room.mode !== 'online') throw new Error('Emote hanya tersedia untuk pemain di ruang aktif.');
   payload.emotes = appendEmote(payload.emotes ?? [], me.area, input.emote, Date.now(), crypto.randomUUID());
  }
  else if (payload.emotes) payload.emotes = payload.emotes.filter(e => Date.now() - e.at < EMOTE_LIFE_MS);
  if (input.op==='ready') {
   if (payload.game || !me) throw new Error('Ruang sudah dimulai.');
   me.ready=input.ready??false;
  }
  if (input.op==='start') {
   if (!host) throw new Error('Hanya pembuat ruang dapat memulai.');
   if (payload.game) return project(room,payload,sid);
   canStartRoom(payload.seats,host);
   payload.seats.sort((a,b)=>a.area-b.area);
   payload.game=createGame(payload.seats.map(s=>({name:s.name,isBot:false,avatar:s.avatar})),crypto.getRandomValues(new Uint32Array(1))[0]);
  }
  if (input.op==='pause') {
   if (!host) throw new Error('Hanya pembuat ruang dapat menjeda.');
   payload.paused=input.paused??false;
  }
  if (input.op==='leave') {
   if (payload.game) { if(me) me.lastSeen=0; }
   else { if(host && payload.seats.length>1) throw new Error('Pembuat ruang tidak dapat keluar sebelum pemain lain.'); payload.seats=payload.seats.filter(s=>s.sessionId!==sid); }
  }
  if (input.op==='bot') {
   if(room.mode!=='local' || !host || !payload.game || payload.paused) throw new Error('Aksi bot tidak tersedia.');
   if(input.contextKey!==roomContextKey(payload.game)) return project(room,payload,sid);
   const botReceipt=`bot:${input.contextKey}:${getActor(payload.game)}`;
   if(payload.receipts.includes(botReceipt)) return project(room,payload,sid);
   const action=nextBotStep(payload.game);
   if(!action) return project(room,payload,sid);
   const result=tryReduce(payload.game,action);
   if(result.error || checkInvariants(result.state).length) throw new Error('Aksi bot ditolak.');
   payload.game=result.state;
   payload.receipts=[...payload.receipts,botReceipt].slice(-1000);
  }
  if (input.op==='action') {
   const raw=input.action as {id?:unknown;value?:unknown};
   if (typeof raw?.id!=='string' || raw.id.length>150) throw new Error('Identitas aksi tidak sah.');
   const receipt=`${sid}:${raw.id}`;
   if (payload.receipts.includes(receipt)) return project(room,payload,sid);
   if (!payload.game || !me || payload.paused) throw new Error('Permainan belum aktif atau sedang dijeda.');
   if (input.contextKey!==roomContextKey(payload.game)) throw new Error('Giliran telah berubah. Coba kembali.');
   if (raw.value!==undefined) throw new Error('Dadu ditentukan oleh sistem.');
   const action=actionSchema.parse(input.action) as Action;
   if(room.mode==='online') authorizeRoomAction(payload.game,action,me.area,host);
   else if(!host) throw new Error('Bukan ruang latihanmu.');
   const result=tryReduce(payload.game,{...action,id:receipt});
   if(result.error) throw new Error(result.error);
   if(checkInvariants(result.state).length) throw new Error('Perubahan suara ditolak.');
   payload.game=result.state;
   payload.receipts=[...payload.receipts,receipt].slice(-1000);
  }
  const {data:committed,error:commitError}=await db.rpc('commit_game_room',{p_id:room.id,p_revision:room.revision,p_payload:JSON.parse(JSON.stringify(payload))});
  if(commitError) throw new Error('Perubahan belum tersimpan. Coba kembali.');
  if(committed) return input.op==='leave'?null:project({...room,revision:room.revision+1},payload,sid);
 }
 throw new Error('Ruang sedang sibuk. Coba kembali.');
}

function project(room:{id:string;code:string;revision:number;host_session_id:string},p:RoomPayload,sid:string):RoomView {
 return {id:room.id,code:room.code,revision:room.revision,isHost:room.host_session_id===sid,viewer:p.seats.find(s=>s.sessionId===sid)?.area??-1,paused:p.paused,actor:p.game?getActor(p.game):null,
 seats:p.seats.map(s=>({name:s.name,area:s.area,avatar:s.avatar,ready:s.ready,connected:Date.now()-s.lastSeen<30000,isYou:s.sessionId===sid})),game:p.game?redactGame(p.game):null,emotes:(p.emotes??[]).filter(e=>Date.now()-e.at<EMOTE_LIFE_MS)};
}