import { useCallback, useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { roomRequest } from '@/seratus/lib/rooms.functions';
import type { RoomView } from '@/seratus/game/room-types';
import { roomContextKey } from '@/seratus/game/room-context';
import type { Action } from '@/seratus/game/view';

export function useRoom(key='suara-online-room') {
 const request=useServerFn(roomRequest);
 const [room,setRoom]=useState<RoomView|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const ref=useRef(room);
 ref.current=room;
 const call=useCallback(async(data:Parameters<typeof request>[0]['data'],silent=false)=>{
  if(!silent) {setBusy(true);setError(null);}
  try {
   const result=await request({data});
   if(result) {
    const old=ref.current;
    if(!old || old.id!==result.id || result.revision>=old.revision) {ref.current=result;setRoom(result);}
    localStorage.setItem(key,result.id);
   } else if(data.op==='leave'){ref.current=null;setRoom(null);localStorage.removeItem(key);}
   if(silent) setError(null);
   return result;
  } catch(e){setError(e instanceof Error?e.message:'Tidak dapat tersambung. Coba kembali.');return null;}
  finally {if(!silent) setBusy(false);}
 },[request,key]);
 useEffect(()=>{const id=localStorage.getItem(key);if(id) void call({op:'restore',roomId:id});},[call,key]);
 useEffect(()=>{
  if(!room) return;
  let active=true;
  const poll=async()=>{if(active && !document.hidden) await call({op:'read',roomId:room.id},true);};
  const timer=setInterval(poll,2500);
  window.addEventListener('online',poll);
  document.addEventListener('visibilitychange',poll);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('online',poll);document.removeEventListener('visibilitychange',poll);};
 },[room?.id,call]);
 const dispatch=useCallback((action:Action)=>{
  const r=ref.current;
  if(!r?.game) return;
  void call({op:'action',roomId:r.id,action,contextKey:roomContextKey(r.game)});
 },[call]);
 return {room,error,busy,call,dispatch};
}