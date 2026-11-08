import {describe,it,expect} from 'vitest';
import { canJoinRoom,canStartRoom } from './room-seats';
const seats=Array.from({length:5},(_,area)=>({sessionId:String(area),name:`P${area}`,area,ready:true,lastSeen:1}));
describe('Persyaratan lobby lima pemain',()=>{
 it('menolak pemain keenam',()=>expect(()=>canJoinRoom(seats,0,false)).toThrow());
 it('menolak area duplikat',()=>expect(()=>canJoinRoom(seats.slice(0,2),1,false)).toThrow());
 it('tidak mulai sebelum tepat lima pemain',()=>expect(()=>canStartRoom(seats.slice(0,4),true)).toThrow());
 it('tidak mulai jika satu pemain belum siap',()=>expect(()=>canStartRoom(seats.map((s,i)=>({...s,ready:i!==4})),true)).toThrow());
 it('lima pemain siap dapat mulai oleh pembuat ruang',()=>{expect(()=>canStartRoom(seats,true)).not.toThrow();expect(()=>canStartRoom(seats,false)).toThrow();});
 it('tidak menerima pemain setelah mulai',()=>expect(()=>canJoinRoom([],0,true)).toThrow());
});