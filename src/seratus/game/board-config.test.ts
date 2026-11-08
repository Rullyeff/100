import { checkedAt } from "@/seratus/lib/checked-at";
import { describe, expect, it } from "vitest";
import { OUTER_TOTAL, OUTER_PER_AREA, GATE_LEN, PENT_TOTAL, outerType, outerArea, isSafeGate, safeGateOf } from "./board-config";
import * as view from "./view";
import { createGame, currentPlayer, reduce, checkInvariants, escrowCount } from "./engine";
import { outerSpace, gateSpace, pentSpace, pawnPos } from "./board";
import { upgradeBoard } from "./board-upgrade";
import { deckSource } from "./cards";
const configs = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, isBot: false }));

describe("Rancangan BPIC 2026", () => {
  it("memiliki 75 petak luar, 15 per area, dan membungkus L75 ke L1", () => {
    expect(OUTER_TOTAL).toBe(75);
    expect(OUTER_PER_AREA).toBe(15);
    for (let area = 0; area < 5; area++) {
      expect(Array.from({length:75},(_,i)=>outerArea(i)).filter(a=>a===area)).toHaveLength(15);
    }
    expect(Array.from({length:75},(_,i)=>outerType(i)).every(Boolean)).toBe(true);
    const s = createGame(configs, 42), p = currentPlayer(s);
    p.outerPos = 74;
    const n = reduce(s, {type:"ROLL",value:1});
    expect(checkedAt(n.players, p.id).outerPos).toBe(0);
    expect(checkInvariants(n)).toEqual([]);
  });
  it("memiliki 25 gerbang, baru keluar setelah petak kelima", () => {
    expect(GATE_LEN * 5).toBe(25);
    const s = createGame(configs, 42), p = currentPlayer(s);
    p.phase="gate"; p.gatePos=3;
    const n=reduce(s,{type:"ROLL",value:1});
    expect(checkedAt(n.players, p.id).phase).toBe("gate");
    expect(checkedAt(n.players, p.id).gatePos).toBe(4);
    checkedAt(s.players, p.id).gatePos=5;
    const home=checkedAt(reduce(s,{type:"ROLL",value:1}).players, p.id);
    expect(home.phase).toBe("pentagon"); expect(home.pentSteps).toBe(0);
  });
  it("memiliki 20 Pentagon: 5 Gerbang Aman dan 15 petak biasa", () => {
    expect(PENT_TOTAL).toBe(20);
    expect(Array.from({length:20},(_,i)=>i).filter(isSafeGate)).toEqual([0,4,8,12,16]);
    expect(Array.from({length:20},(_,i)=>i).filter(i=>!isSafeGate(i))).toHaveLength(15);
    expect(Array.from({length:5},(_,i)=>safeGateOf(i))).toEqual([0,4,8,12,16]);
    expect(view.PENT_TOTAL).toBe(PENT_TOTAL);
  });
  it("putaran Pentagon selesai pada 20 langkah bersih, bukan 10", () => {
    const s=createGame(configs,42), p=currentPlayer(s);
    p.phase="pentagon"; p.pentSteps=9;
    const n=reduce(s,{type:"ROLL",value:1});
    expect(checkedAt(n.players, p.id).pentRound).toBe(1);
    expect(checkedAt(n.players, p.id).pentSteps).toBe(10);
    p.pentSteps=19;
    const done=reduce(s,{type:"ROLL",value:6});
    expect(checkedAt(done.players, p.id).pentRound).toBe(2);
    expect(checkedAt(done.players, p.id).pentSteps).toBe(0);
    expect(checkInvariants(done)).toEqual([]);
  });
  it("memuat 355 kartu resmi: 150/115/40/50", () => {
    const aspirasi=Array.from({length:15},(_,i)=>deckSource(`A${Math.floor(i/5)+1}-${i%5}`).length).reduce((a,b)=>a+b,0);
    const demokrasi=["D","PR","MISI","FDT"].reduce((n,key)=>n+deckSource(key).length,0);
    const counts=[aspirasi,demokrasi,deckSource("K").length,deckSource("P").length];
    expect(counts).toEqual([150,115,40,50]);
    expect(counts.reduce((a,b)=>a+b,0)).toBe(355);
  });
  it("semua 120 koordinat unik, terhingga dan di dalam papan", () => {
    const pts=[...Array.from({length:75},(_,i)=>outerSpace(i)),...Array.from({length:25},(_,i)=>gateSpace(Math.floor(i/5),i%5+1)),...Array.from({length:20},(_,i)=>pentSpace(i))];
    expect(pts).toHaveLength(120);
    expect(new Set(pts.map(p=>`${p.x},${p.y}`)).size).toBe(120);
    expect(pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>20&&p.x<980&&p.y>20&&p.y<980)).toBe(true);
    const s=createGame(configs,42), p=currentPlayer(s);
    p.phase="pentagon"; p.area=4; p.pentSteps=3;
    const a=pawnPos(p), b=pentSpace(19);
    expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeCloseTo(8);
  });
  it("ruang lama mempertahankan 100 suara, klaim, dan progres ketika ditingkatkan", () => {
    const s=createGame(configs,42);
    delete s.ruleset; s.spaces=Array.from({length:10},()=>null); s.spaces[9]=0;
    s.tokens.slice(0,5).forEach(t=>{t.loc=109;});
    checkedAt(s.players, 0).outerPos=49; checkedAt(s.players, 0).gatePos=3; checkedAt(s.players, 0).pentSteps=9;
    s.pending={kind:"claim",space:9};
    const n=upgradeBoard(s);
    expect(n.spaces).toHaveLength(20); expect(checkedAt(n.spaces, 18)).toBe(0);
    expect(escrowCount(n,18)).toBe(4); expect(n.tokens).toHaveLength(100);
    expect(n.tokens.filter(t=>t.loc===0)).toHaveLength(1); expect(n.homeOwner).toEqual([0,1,2,3,4]);
    expect(checkedAt(n.players, 0).outerPos).toBe(73); expect(checkedAt(n.players, 0).gatePos).toBe(5); expect(checkedAt(n.players, 0).pentSteps).toBe(18);
    expect(n.pending).toEqual({kind:"claim",space:18});
    expect(checkInvariants(n)).toEqual([]); expect(upgradeBoard(n)).toBe(n);
    expect(s.spaces).toHaveLength(10);
  });
});