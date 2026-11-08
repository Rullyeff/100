import { useState } from 'react';
import { Check, Copy, Plus, LogIn, Play, Users, Wifi, WifiOff, GraduationCap, Leaf, BriefcaseBusiness, Landmark, HeartHandshake, ShieldCheck, ArrowRight, DoorOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AREAS } from '@/seratus/game/view';
import { AREA_BG } from './theme';
import { cn } from '@/lib/utils';
import { useRoom } from './useRoom';
import { GameScreen } from './GameScreen';
import { useEffect } from 'react';
import { recordResult } from '@/seratus/game/leaderboard';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AVATARS, AvatarGrid, PlayerAvatar } from './PlayerAvatar';
import { GameLayout, PlayHeading, PlayMenu, type PlayMode } from './PlayMenu';

const AREA_ICONS = [GraduationCap, Leaf, BriefcaseBusiness, Landmark, HeartHandshake];

export function RoomLobby({ mode, setMode }: { mode: PlayMode; setMode: (m: PlayMode) => void }){
 const {room,error,busy,call,dispatch}=useRoom();
 const [name,setName]=useState('');
 const [code,setCode]=useState('');
 const [area,setArea]=useState(0);
 const [avatar,setAvatar]=useState(6);
 const [copied,setCopied]=useState(false);
 useEffect(()=>{if(room?.game) recordResult(room.game);},[room?.game]);
 if(room?.game) return <GameLayout mode={mode} setMode={setMode}><GameScreen state={room.game} dispatch={dispatch} error={error} speed={700} setSpeed={()=>{}} paused={room.paused} setPaused={paused=>{void call({op:'pause',roomId:room.id,paused});}} onQuit={()=>{void call({op:'leave',roomId:room.id});}} testDice={false} online={{viewer:room.viewer,isHost:room.isHost,code:room.code,busy,emotes:room.emotes??[],sendEmote:async emote=>!!(await call({op:'emote',roomId:room.id,emote},true))}}/></GameLayout>;
 const alert = error && <p role="alert" className="play-alert">{error}</p>;

 if(!room) return <PlayMenu mode={mode} setMode={setMode}>
  <PlayHeading icon={Users} title="Main Bersama" subtitle="Satu ruang, lima suara untuk bangsa. Buat ruang baru atau gabung dengan kode undangan."/>
  {alert}
  <div className="play-body play-split play-split-form">
   <div className="play-col">
    <div><label htmlFor="nickname" className="play-step"><span className="room-step">01</span>Avatar &amp; nama panggilan</label><div className="mt-3 flex items-center gap-3"><Popover><PopoverTrigger asChild><button type="button" aria-label={`Ganti avatar (sekarang ${AVATARS[avatar]?.name ?? ''})`} className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><PlayerAvatar area={area} avatar={avatar} size={48}/><span className="absolute -bottom-1 -right-1 rounded-full border bg-card px-1 text-[9px] font-bold shadow group-hover:bg-gold group-hover:text-gold-foreground">Ganti</span></button></PopoverTrigger><PopoverContent className="dark w-[22rem]" align="start"><div className="mb-2 text-sm font-semibold">Pilih avatar</div><AvatarGrid area={area} value={avatar} onPick={setAvatar}/></PopoverContent></Popover><Input id="nickname" value={name} onChange={e=>setName(e.target.value)} maxLength={18} className="play-input h-11" placeholder="Nama pemain"/></div></div>
    <fieldset><legend className="play-step"><span className="room-step">02</span>Area asal</legend><div className="play-areas mt-3 grid grid-cols-5 gap-3">{AREAS.map((a,i)=>{const Icon = AREA_ICONS[i] ?? Landmark;return <Button key={a.name} variant="outline" aria-pressed={area===i} onClick={()=>setArea(i)} className={cn('room-area relative h-24 flex-col gap-3 whitespace-normal bg-card text-xs',area===i&&'room-area-selected')}><span className={cn('room-area-icon flex size-9 items-center justify-center rounded-md text-primary-foreground',AREA_BG[i])}><Icon className="size-5"/></span>{a.name}{area===i&&<Check className="absolute right-2 top-2 size-3 text-home-accent"/>}</Button>;})}</div></fieldset>
   </div>
   <div className="play-col">
    <div className="play-card"><p className="play-label">MULAI RUANG BARU</p><Button className="play-cta h-12 w-full justify-between" size="lg" disabled={busy||!name.trim()} onClick={()=>{void call({op:'create',name,area,avatar});}}><span className="flex items-center gap-2"><Plus/>Buat Ruang</span><ArrowRight/></Button></div>
    <div className="play-card"><p className="play-label">PUNYA KODE UNDANGAN?</p><div className="flex gap-2"><Input aria-label="Kode undangan" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} className="play-input h-11 min-w-0 font-mono" placeholder="Kode undangan" maxLength={8}/><Button className="h-11 shrink-0" size="lg" variant="outline" disabled={busy||!name.trim()||code.length!==8} onClick={()=>{void call({op:'join',code,name,area,avatar});}}><LogIn/>Gabung</Button></div></div>
    <p className="play-note"><ShieldCheck className="size-4 shrink-0 text-home-accent"/>Nama panggilan saja; tanpa NIK, email, atau nomor telepon. Ruang berlaku 24 jam.</p>
   </div>
  </div>
 </PlayMenu>;

 const you = room.seats.find(s=>s.isYou);
 const readyCount = room.seats.filter(s=>s.ready).length;
 return <PlayMenu mode={mode} setMode={setMode}>
  <PlayHeading icon={DoorOpen} title="Ruang Privat" subtitle="Bagikan kode ke empat teman. Permainan dimulai saat lima kursi terisi dan semua siap."/>
  {alert}
  <div className="play-body play-split play-split-seats">
   <div className="play-col">
    <div className="play-card play-code"><div className="min-w-0"><p className="play-label">KODE UNDANGAN</p><div className="play-code-value">{room.code}</div></div><Button variant="outline" onClick={async()=>{await navigator.clipboard.writeText(room.code);setCopied(true);}}>{copied?<Check/>:<Copy/>}{copied?'Tersalin':'Salin kode'}</Button></div>
    <div className="play-progress"><span><b>{room.seats.length}</b>/5 pemain</span><span><b>{readyCount}</b>/5 siap</span></div>
    <div className="play-actions">{room.isHost && <Button className="play-cta h-12 w-full" size="lg" disabled={busy||room.seats.length!==5||!room.seats.every(s=>s.ready)} onClick={()=>{void call({op:'start',roomId:room.id});}}><Play/>Mulai Permainan</Button>}<div className="flex flex-wrap gap-2"><Button variant="outline" className="flex-1" disabled={busy} onClick={()=>{void call({op:'ready',roomId:room.id,ready:!you?.ready});}}><Check/>{you?.ready?'Batalkan kesiapan':'Saya Siap'}</Button><Button variant="ghost" disabled={busy} onClick={()=>{void call({op:'leave',roomId:room.id});}}>Keluar</Button></div></div>
    {!room.isHost && <p className="play-note">Tuan rumah akan memulai permainan setelah semua siap.</p>}
   </div>
   <div className="play-seats">{AREAS.map((a,i)=>{const seat=room.seats.find(s=>s.area===i);return <div key={a.name} className={cn('play-seat', seat?.isYou && 'play-seat-you')}>{seat ? <PlayerAvatar area={i} avatar={seat.avatar} size={36}/> : <span className={cn('size-4 shrink-0 rounded-full',AREA_BG[i])}/>}<div className="min-w-0 flex-1"><div className="truncate font-semibold">{seat?seat.name:'Menunggu pemain'}{seat?.isYou?' · Kamu':''}</div><div className="text-xs text-muted-foreground">{a.name}</div></div>{seat && <><span title={seat.connected?'Tersambung':'Terputus'}>{seat.connected?<Wifi className="size-4 text-success"/>:<WifiOff className="size-4 text-muted-foreground"/>}</span><span className={cn('play-ready', seat.ready && 'play-ready-on')}>{seat.ready?'Siap':'Belum siap'}</span></>}</div>;})}</div>
  </div>
 </PlayMenu>;
}
