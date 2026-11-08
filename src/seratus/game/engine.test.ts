import { checkedAt } from "@/seratus/lib/checked-at";
import { describe, expect, it } from "vitest";
import { nextBotStep } from "./bot";
import { card, type AspirasiCard, type DemokrasiCard, type KejutanCard, type McqCard, type PutusanCard } from "./cards";
import {
  checkInvariants,
  createGame,
  currentPlayer,
  escrowCount,
  escrowLoc,
  getActor,
  handCount,
  legalVotes,
  OUTER_PATTERN,
  outerDemokrasiSub,
  reduce,
  stockCount,
  STOCK,
  safeGateOf,
  PENT_TOTAL,
  votersFor,
  type GameState,
} from "./engine";

const cfg = (bots = true) => Array.from({ length: 5 }, (_, i) => ({ name: `P${i + 1}`, isBot: bots }));

function giveHand(s: GameState, pid: number, n: number, origin?: number) {
  let k = 0;
  for (const t of s.tokens) {
    if (k >= n) break;
    if (t.loc === STOCK && (origin === undefined || t.origin === origin)) {
      t.loc = pid;
      k++;
    }
  }
}
/** Pemain `pid` memiliki petak `sp` dengan 4 suara jaminan dari stok. */
function ownSpace(s: GameState, pid: number, sp: number) {
  let k = 0;
  for (const t of s.tokens) if (k < 4 && t.loc === STOCK) { t.loc = escrowLoc(sp); k++; }
  s.spaces[sp] = pid;
}

describe("Inventaris & invarian", () => {
  it("dimulai dengan 100 token, 20 per area di stok, Gerbang Aman milik area masing-masing", () => {
    const s = createGame(cfg(), 1);
    expect(s.tokens).toHaveLength(100);
    for (let a = 0; a < 5; a++) expect(stockCount(s, a)).toBe(20);
    expect(s.spaces).toHaveLength(20);
    expect(s.homeOwner).toEqual([0, 1, 2, 3, 4]);
    expect(s.players.every((p) => handCount(s, p.id) === 0 && p.areaTokens.every((t) => !t))).toBe(true);
    expect(checkInvariants(s)).toEqual([]);
  });

  it("simulasi penuh 5 bot selalu menjaga 100 suara dan selesai", () => {
    for (const seed of [1, 7, 42, 99, 2026]) {
      let s = createGame(cfg(), seed);
      let rs = seed;
      const rnd = () => {
        rs = (rs * 1103515245 + 12345) % 2147483648;
        return rs / 2147483648;
      };
      let steps = 0;
      while (steps < 60000) {
        const a = nextBotStep(s, rnd);
        if (!a) break;
        const next = reduce(s, a);
        expect(next).not.toBe(s);
        s = next;
        const errs = checkInvariants(s);
        if (errs.length) throw new Error(`seed ${seed} langkah ${steps}: ${errs.join("; ")}`);
        steps++;
      }
      expect(s.stage).toBe("over");
      expect(s.final?.stage).toBe("done");
      expect(s.final?.winners.length).toBeGreaterThan(0);
    }
  });
});

function land(s: GameState, kind: "aspirasi" | "cekfakta" | "refleksi" | "dilema", cardId: string, area: number): GameState {
  s.stage = "pending";
  s.pending = { kind, cardId, area };
  return s;
}

describe("Fase I — Jalur Luar", () => {
  it("tiap area 15 petak: 5 Aspirasi (2 Mudah, 2 Sedang, 1 Sulit), 3 Demokrasi, 2 Kejutan, 5 kosong", () => {
    const count = (t: string) => OUTER_PATTERN.filter((x) => x === t).length;
    expect(OUTER_PATTERN).toHaveLength(15);
    expect(count("D")).toBe(3);
    expect(count("K")).toBe(2);
    expect([count("A1"), count("A2"), count("A3")]).toEqual([2, 2, 1]);
    expect(count("E")).toBe(5);
    const subs = OUTER_PATTERN.map((t, i) => (t === "D" ? outerDemokrasiSub(i) : null)).filter(Boolean);
    expect(subs.sort()).toEqual(["cekfakta", "dilema", "refleksi"]);
  });

  it("petak Kejutan pertama tiap area = Peristiwa, petak kedua = Kesempatan", () => {
    const s = createGame(cfg(), 4);
    const p = currentPlayer(s);
    const first = reduce(s, { type: "ROLL", value: 5 }); // START → petak ke-5 area asal
    expect(first.pending?.kind).toBe("kejutan");
    expect(card<KejutanCard>((first.pending as { cardId: string }).cardId).sub).toBe("peristiwa");
    const s2 = createGame(cfg(), 4);
    checkedAt(s2.players, p.id).outerPos = p.area * 15 + 5;
    const second = reduce(s2, { type: "ROLL", value: 5 }); // → petak ke-11 area asal
    expect(second.pending?.kind).toBe("kejutan");
    expect(card<KejutanCard>((second.pending as { cardId: string }).cardId).sub).toBe("kesempatan");
  });

  it("petak kosong tidak membuka kartu dan langsung mengakhiri giliran", () => {
    const s = createGame(cfg(), 4);
    const p = currentPlayer(s);
    const n = reduce(s, { type: "ROLL", value: 1 }); // START → petak ke-1 (polos)
    expect(checkedAt(n.players, p.id).outerPos).toBe(p.area * 15);
    expect(n.pending).toBeNull();
    expect(n.stage).toBe("end");
    expect(checkInvariants(n)).toEqual([]);
  });

  it("Aspirasi Mudah dan Sedang benar = 2 suara + Token Area", () => {
    for (const level of [1, 2] as const) {
      const s = createGame(cfg(), 3);
      const p = currentPlayer(s);
      const c = card<AspirasiCard>(`A${level}-2-1`);
      const next = reduce(land(s, "aspirasi", c.id, 2), { type: "ANSWER", choice: c.answer ?? -1 });
      expect(handCount(next, p.id)).toBe(2);
      expect(checkedAt(checkedAt(next.players, p.id).areaTokens, 2)).toBe(true);
    }
  });

  it("Aspirasi Sulit (SJT): hanya pilihan terbaik = 2 suara; pilihan lain +0", () => {
    for (const [w, gain] of [[5, 2], [4, 0], [3, 0]] as const) {
      const s = createGame(cfg(), 5);
      const p = currentPlayer(s);
      const c = card<AspirasiCard>("A3-0-1");
      const next = reduce(land(s, "aspirasi", c.id, 0), { type: "ANSWER", choice: (c.weights ?? []).indexOf(w) });
      expect(handCount(next, p.id)).toBe(gain);
    }
  });

  it("hadiah dibatasi stok area yang tersisa", () => {
    const s = createGame(cfg(), 3);
    const p = currentPlayer(s);
    giveHand(s, (p.id + 1) % 5, 19, 2); // stok Ekonomi tinggal 1
    const c = card<AspirasiCard>("A1-2-1");
    const next = reduce(land(s, "aspirasi", c.id, 2), { type: "ANSWER", choice: c.answer ?? -1 });
    expect(handCount(next, p.id)).toBe(1);
    expect(stockCount(next, 2)).toBe(0);
    expect(checkInvariants(next)).toEqual([]);
  });

  it("Demokrasi Cek Fakta dan Refleksi benar = 2 suara", () => {
    for (const [kind, id] of [["cekfakta", "D-CF-1"], ["refleksi", "D-RF-1"]] as const) {
      const s = createGame(cfg(), 4);
      const p = currentPlayer(s);
      const c = card<DemokrasiCard>(id);
      const next = reduce(land(s, kind, id, 1), { type: "ANSWER", choice: c.answer ?? -1 });
      expect(handCount(next, p.id)).toBe(2);
    }
  });

  it("syarat Gerbang hanya 16 suara di tangan, tanpa wajib Token Area", () => {
    const s = createGame(cfg(), 6);
    const p = currentPlayer(s);
    checkedAt(s.players, p.id).outerPos = 0;
    giveHand(s, p.id, 15);
    expect(checkedAt(reduce(s, { type: "ROLL", value: 2 }).players, p.id).phase).toBe("outer");
    giveHand(s, p.id, 1);
    const n = reduce(s, { type: "ROLL", value: 2 });
    expect(checkedAt(n.players, p.id).areaTokens.some(Boolean)).toBe(false);
    expect(checkedAt(n.players, p.id).phase).toBe("gate");
    expect(checkedAt(n.players, p.id).gatePos).toBe(2);
  });
});

describe("Fase II — Gerbang Demokrasi", () => {
  it("voting seri menerapkan konsekuensi yang lebih ringan", () => {
    const s = createGame(cfg(), 8);
    const p = currentPlayer(s);
    giveHand(s, p.id, 6, p.area);
    checkedAt(s.players, p.id).phase = "gate";
    checkedAt(s.players, p.id).gatePos = 2;
    s.stage = "pending";
    s.pending = { kind: "putusan", cardId: "PR-1", votes: {} };
    expect(card<PutusanCard>("PR-1").lighter).toBe("a");
    const voters = votersFor(s, p.id);
    let n = s;
    [0, 0, 1, 1].forEach((choice, i) => (n = reduce(n, { type: "VOTE", voter: checkedAt(voters, i), choice })));
    expect(checkedAt(n.players, p.id).gatePos).toBe(3);
  });

  it("pemain target tidak boleh memilih dirinya sendiri", () => {
    const s = createGame(cfg(), 9);
    const p = currentPlayer(s);
    s.stage = "pending";
    s.pending = { kind: "putusan", cardId: "PR-2", votes: {} };
    expect(reduce(s, { type: "VOTE", voter: p.id, choice: 0 })).toBe(s);
  });

  it("dadu melampaui petak ke-5 langsung mengisi Gerbang Aman", () => {
    const s = createGame(cfg(), 10);
    const p = currentPlayer(s);
    checkedAt(s.players, p.id).phase = "gate";
    checkedAt(s.players, p.id).gatePos = 3;
    const n = reduce(s, { type: "ROLL", value: 3 });
    expect(checkedAt(n.players, p.id).phase).toBe("pentagon");
    expect(checkedAt(n.players, p.id).pentRound).toBe(1);
    expect(checkedAt(n.players, p.id).pentSteps).toBe(0);
    expect(n.pending).toBeNull();
    const exact = reduce(s, { type: "ROLL", value: 2 });
    expect(checkedAt(exact.players, p.id).gatePos).toBe(5);
    expect(exact.pending?.kind).toBe("putusan");
  });
});

describe("Fase III — Pentagon Putaran 1", () => {
  function inPentagon(seed: number, hand: number, round = 1) {
    const s = createGame(cfg(), seed);
    const p = checkedAt(s.players, currentPlayer(s).id);
    p.phase = "pentagon";
    p.pentRound = round;
    p.pentSteps = 0;
    giveHand(s, p.id, hand);
    return { s, p };
  }

  it("klaim menjaminkan 4 suara dan suara jaminan tetap suara sah", () => {
    const { s, p } = inPentagon(11, 20);
    let n = reduce(s, { type: "ROLL", value: 1 });
    expect(n.pending?.kind).toBe("claim");
    n = reduce(n, { type: "CLAIM", accept: true });
    n = { ...n, stage: "roll" };
    n = reduce(n, { type: "ROLL", value: 1 });
    n = reduce(n, { type: "CLAIM", accept: true });
    expect(handCount(n, p.id)).toBe(12);
    expect(escrowCount(n, (safeGateOf(p.area) + 1) % PENT_TOTAL)).toBe(4);
    expect(legalVotes(n, p.id)).toBe(20);
  });

  it("boleh menjaminkan seluruh suara (4 di tangan → 0)", () => {
    const { s, p } = inPentagon(12, 4);
    let n = reduce(s, { type: "ROLL", value: 1 });
    n = reduce(n, { type: "CLAIM", accept: true });
    expect(handCount(n, p.id)).toBe(0);
    expect(legalVotes(n, p.id)).toBe(4);
    expect(checkedAt(n.players, p.id).phase).toBe("pentagon");
  });

  it("maksimal 5 petak per pemain", () => {
    const { s, p } = inPentagon(13, 8);
    [1, 2, 3, 5, 6].forEach((k) => ownSpace(s, p.id, (safeGateOf(p.area) + k) % PENT_TOTAL));
    p.pentSteps = 6;
    const n = reduce(s, { type: "ROLL", value: 1 }); // petak netral P+7
    expect(checkedAt(n.spaces, (safeGateOf(p.area) + 7) % PENT_TOTAL)).toBeNull();
    expect(n.pending?.kind).not.toBe("claim");
  });

  it("tidak ada duel pada putaran pertama", () => {
    const { s, p } = inPentagon(14, 6);
    ownSpace(s, (p.id + 1) % 5, (safeGateOf(p.area) + 2) % PENT_TOTAL);
    expect(reduce(s, { type: "ROLL", value: 2 }).pending).toBeNull();
    expect(reduce(s, { type: "ROLL", value: 4 }).pending).toBeNull(); // Gerbang Aman lawan
  });
});

describe("Fase Kompetisi — Pentagon Putaran 2", () => {
  function duelSetup(seed: number, hand: number) {
    const s = createGame(cfg(), seed);
    const p = checkedAt(s.players, currentPlayer(s).id);
    p.phase = "pentagon";
    p.pentRound = 2;
    giveHand(s, p.id, hand);
    return { s, p, owner: (p.id + 1) % 5 };
  }
  function answerDuel(s: GameState, challengerRight: boolean, ownerRight: boolean) {
    const pend = s.pending;
    if (pend?.kind !== "duel") throw new Error("bukan duel");
    const c = card<McqCard>(pend.cardId);
    const wrong = (c.answer + 1) % c.options.length;
    let n = reduce(s, { type: "DUEL_ANSWER", player: currentPlayer(s).id, choice: challengerRight ? c.answer : wrong });
    n = reduce(n, { type: "DUEL_ANSWER", player: pend.opponent, choice: ownerRight ? c.answer : wrong });
    return n;
  }

  it("petak sendiri aman; petak netral boleh ditandai (klaim)", () => {
    const { s, p } = duelSetup(20, 8);
    ownSpace(s, p.id, (safeGateOf(p.area) + 1) % PENT_TOTAL);
    expect(reduce(s, { type: "ROLL", value: 1 }).pending).toBeNull();
    expect(reduce(s, { type: "ROLL", value: 2 }).pending?.kind).toBe("claim");
  });

  it("petak lawan dan Gerbang Aman lawan memicu duel", () => {
    const { s, p, owner } = duelSetup(21, 8);
    const sp = (safeGateOf(p.area) + 2) % PENT_TOTAL;
    ownSpace(s, owner, sp);
    const d = reduce(s, { type: "ROLL", value: 2 });
    expect(d.pending).toMatchObject({ kind: "duel", opponent: owner, home: false });
    const h = reduce(s, { type: "ROLL", value: 4 });
    expect(h.pending).toMatchObject({ kind: "duel", home: true, opponent: (p.area + 1) % 5 });
  });

  it("perebutan berhasil: ambil alih petak dan 4 suara jaminan", () => {
    const { s, p, owner } = duelSetup(22, 3);
    const sp = (safeGateOf(p.area) + 2) % PENT_TOTAL;
    ownSpace(s, owner, sp);
    const n = answerDuel(reduce(s, { type: "ROLL", value: 2 }), true, false);
    expect(checkedAt(n.spaces, sp)).toBe(p.id);
    expect(escrowCount(n, sp)).toBe(4);
    expect(legalVotes(n, p.id)).toBe(7);
    expect(legalVotes(n, owner)).toBe(0);
    expect(checkInvariants(n)).toEqual([]);
  });

  it("perebutan gagal: serahkan 2 suara kepada pemilik petak", () => {
    const { s, p, owner } = duelSetup(23, 3);
    const sp = (safeGateOf(p.area) + 2) % PENT_TOTAL;
    ownSpace(s, owner, sp);
    const n = answerDuel(reduce(s, { type: "ROLL", value: 2 }), true, true);
    expect(handCount(n, p.id)).toBe(1);
    expect(handCount(n, owner)).toBe(2);
    expect(checkedAt(n.spaces, sp)).toBe(owner);
  });

  it("perebutan gagal tanpa suara di tangan: wajib merelakan 1 petak", () => {
    const { s, p, owner } = duelSetup(24, 0);
    const sp = (safeGateOf(p.area) + 2) % PENT_TOTAL;
    const mine = (safeGateOf(p.area) + 1) % PENT_TOTAL;
    ownSpace(s, owner, sp);
    ownSpace(s, p.id, mine);
    const n = answerDuel(reduce(s, { type: "ROLL", value: 2 }), false, true);
    expect(checkedAt(n.spaces, mine)).toBe(owner);
    expect(legalVotes(n, owner)).toBe(8);
    expect(legalVotes(n, p.id)).toBe(0);
  });

  it("pemilik Gerbang Aman kalah duel: memilih menyerahkan Gerbang Aman atau 1 petak", () => {
    const { s, p } = duelSetup(25, 3);
    const home = (p.area + 1) % 5;
    const hsp = (safeGateOf(p.area) + 4) % PENT_TOTAL;
    ownSpace(s, home, (hsp + 1) % PENT_TOTAL);
    let n = answerDuel(reduce(s, { type: "ROLL", value: 4 }), true, false);
    expect(n.pending?.kind).toBe("forfeit");
    expect(getActor(n)).toBe(home);
    const pend = n.pending as Extract<GameState["pending"], { kind: "forfeit" }>;
    const homeIdx = pend.options.findIndex((o) => o.type === "home");
    n = reduce(n, { type: "FORFEIT", player: home, option: homeIdx });
    expect(checkedAt(n.homeOwner, home)).toBe(p.id);
    expect(legalVotes(n, home)).toBe(4); // tanpa memberi suara
    expect(checkInvariants(n)).toEqual([]);
  });

  it("penantang kalah duel di Gerbang Aman: serahkan 5 suara di tangan", () => {
    const { s, p } = duelSetup(26, 7);
    const home = (p.area + 1) % 5;
    const n = answerDuel(reduce(s, { type: "ROLL", value: 4 }), false, true);
    expect(handCount(n, p.id)).toBe(2);
    expect(handCount(n, home)).toBe(5);
  });

  it("pemain gugur bila suara, petak, dan Gerbang Aman habis", () => {
    const { s, p, owner } = duelSetup(27, 0);
    s.homeOwner[p.area] = owner;
    const mine = (safeGateOf(p.area) + 1) % PENT_TOTAL;
    const sp = (safeGateOf(p.area) + 2) % PENT_TOTAL;
    ownSpace(s, p.id, mine);
    ownSpace(s, owner, sp);
    const n = answerDuel(reduce(s, { type: "ROLL", value: 2 }), false, true);
    expect(checkedAt(n.players, p.id).phase).toBe("out");
    expect(votersFor(n, owner)).not.toContain(p.id);
  });
});

describe("Hasil akhir", () => {
  function allDone(seed: number) {
    const s = createGame(cfg(), seed);
    s.players.forEach((p) => (p.phase = "done"));
    const cur = currentPlayer(s);
    cur.phase = "pentagon";
    cur.pentRound = 2;
    cur.pentSteps = 19;
    return { s, cur };
  }

  it("suara sah terbanyak ≥ 50 menang setelah dua putaran", () => {
    const { s } = allDone(16);
    giveHand(s, 0, 52);
    giveHand(s, 1, 20);
    let n = reduce(s, { type: "ROLL", value: 4 });
    n = reduce(n, { type: "END_TURN" });
    expect(n.stage).toBe("over");
    expect(n.final?.winners).toEqual([0]);
  });

  it("belum ada yang mencapai 50: pemain bertahan lanjut putaran", () => {
    const { s } = allDone(17);
    giveHand(s, 0, 30);
    giveHand(s, 1, 25);
    let n = reduce(s, { type: "ROLL", value: 4 });
    n = reduce(n, { type: "END_TURN" });
    expect(n.stage).toBe("roll");
    expect(n.extended).toEqual({ target: 50 });
    expect(n.players.every((p) => p.phase === "pentagon" && p.pentRound === 3)).toBe(true);
  });

  it("dua pemain mencapai 50: lanjut hingga salah satu mencapai 70", () => {
    const { s } = allDone(18);
    giveHand(s, 0, 50);
    giveHand(s, 1, 50);
    let n = reduce(s, { type: "ROLL", value: 4 });
    n = reduce(n, { type: "END_TURN" });
    expect(n.stage).toBe("roll");
    expect(n.extended).toEqual({ target: 70 });
  });

  it("aksi yang sama diklik dua kali hanya diproses sekali", () => {
    const s = createGame(cfg(), 15);
    const p = currentPlayer(s);
    const c = card<AspirasiCard>("A1-0-1");
    land(s, "aspirasi", c.id, 0);
    const a = { type: "ANSWER" as const, choice: c.answer ?? -1, id: "klik-1" };
    const n1 = reduce(s, a);
    const n2 = reduce(n1, a);
    expect(n2).toBe(n1);
    expect(handCount(n2, p.id)).toBe(2);
  });
});
