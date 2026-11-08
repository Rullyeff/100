import { checkedAt } from "@/seratus/lib/checked-at";
import { describe,it,expect } from 'vitest';
import { createGame, currentPlayer, reduce, votersFor, checkInvariants } from './engine';
import { authorizeRoomAction,redactGame,viewerActor } from './room-rules';
import { roomContextKey } from './room-context';
import * as display from './public-cards';
const cfg=Array.from({length:5},(_,i)=>({name:`P${i}`,isBot:false}));

describe('Ruang privat BPIC',()=>{
 it('lima area unik dan tepat 100 token asli',()=>{const s=createGame(cfg,10);expect(s.players).toHaveLength(5);expect(new Set(s.players.map(p=>p.area)).size).toBe(5);expect(s.tokens).toHaveLength(100);});
 it('pemain lain tidak dapat melempar dadu aktif',()=>{const s=createGame(cfg,10);expect(()=>authorizeRoomAction(s,{type:'ROLL'},(currentPlayer(s).id+1)%5,false)).toThrow();});
 it('nilai dadu tidak boleh dikirim pemain',()=>{const s=createGame(cfg,10);expect(()=>authorizeRoomAction(s,{type:'ROLL',value:6},currentPlayer(s).id,true)).toThrow();});
 it('empat pemilih dapat memilih tanpa menunggu urutan',()=>{
  const s=createGame(cfg,10);s.stage='pending';s.pending={kind:'putusan',cardId:'PR-1',votes:{}};
  const voters=votersFor(s,currentPlayer(s).id);
  expect(viewerActor(s,checkedAt(voters, 3),false)).toBe(checkedAt(voters, 3));
  const a=authorizeRoomAction(s,{type:'VOTE',voter:checkedAt(voters, 3),choice:1},checkedAt(voters, 3),false);
  const n=reduce(s,a);expect(n.pending?.kind).toBe('putusan');expect(checkInvariants(n)).toEqual([]);
  expect(roomContextKey(n)).toBe(roomContextKey(s));
 });
 it('pemilih tidak dapat menyamar sebagai pemain lain',()=>{const s=createGame(cfg,10);s.stage='pending';s.pending={kind:'putusan',cardId:'PR-1',votes:{}};const voters=votersFor(s,currentPlayer(s).id);const a=checkedAt(voters,0),b=checkedAt(voters,1);expect(()=>authorizeRoomAction(s,{type:'VOTE',voter:b,choice:1},a,false)).toThrow();});
 it('pilihan voting dan seed/dek tidak bocor',()=>{const s=createGame(cfg,10);s.stage='pending';s.pending={kind:'putusan',cardId:'PR-1',votes:{1:0,2:1}};s.decks={P:['P-1','P-2']};const v=redactGame(s);expect(v.seed).toBe(0);expect(v.decks['P']).toEqual(['','']);expect(v.pending).toEqual({kind:'putusan',cardId:'PR-1',votes:{1:-1,2:-1}});expect(s.seed).not.toBe(0);});
 it('jawaban duel disembunyikan sampai dua peserta terkunci',()=>{const s=createGame(cfg,10);s.stage='pending';const duel={kind:'duel' as const,cardId:'P-1',opponent:1,space:2,home:false,answers:{1:3}};s.pending=duel;const v=redactGame(s);expect(v.pending?.kind==='duel'&&v.pending.answers[1]).toBe(-1);expect(duel.answers[1]).toBe(3);});
 it('kartu publik tidak mengandung kunci jawaban atau bobot SJT',()=>{for(const cards of [display.ASPIRASI,display.DEMOKRASI,display.MISI,display.PENTAGON])for(const c of cards){expect(Object.hasOwn(c,'answer')).toBe(false);expect(Object.hasOwn(c,'weights')).toBe(false);}});
 it('hanya pembuat ruang dapat menutup debat',()=>{const s=createGame(cfg,10);s.stage='over';s.final={scores:[0,0,0,0,0],finalists:[0,1],stage:'argue',caseId:'FDT-1',votes:{},objective:null,winners:[],note:''};expect(()=>authorizeRoomAction(s,{type:'FDT_START_VOTE'},0,false)).toThrow();expect(authorizeRoomAction(s,{type:'FDT_START_VOTE'},0,true).type).toBe('FDT_START_VOTE');});
});