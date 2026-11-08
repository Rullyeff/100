import { checkedAt } from "@/seratus/lib/checked-at";
// Mesin aturan 100 SUARA — murni (tanpa React), deterministik berdasarkan seed.
// Mengikuti Buku Panduan Permainan 100 SUARA (draf terbaru).
// Setiap aksi menghasilkan state baru; aksi tidak sah mengembalikan state lama.
import {
  card,
  deckSource,
  DEMOKRASI,
  KEJUTAN,
  type AspirasiCard,
  type DemokrasiCard,
  type Effect,
  type KejutanCard,
  type McqCard,
  type PutusanCard,
} from "./cards";
import {
  AREAS,
  CLAIM_COST,
  CONTEST_PENALTY,
  CORRECT_REWARD,
  EXTRA_ROUNDS_CAP,
  GATE_LEN,
  HOME_PENALTY,
  MAX_CLAIMS,
  OUTER_PER_AREA,
  OUTER_TOTAL,
  PENT_TOTAL,
  QUALIFY_VOTES,
  RULESET,
  STOCK,
  TOKENS_PER_AREA,
  TOKENS_TOTAL,
  WIN_TARGET,
  WIN_TARGET_HIGH,
  canClaim,
  currentPlayer,
  describePosition,
  escrowCount,
  escrowLoc,
  fdtVoters,
  forfeitLabel,
  handCount,
  homeOwnerOf,
  homesOwned,
  isAlive,
  isEligibleForGate,
  isSafeGate,
  legalVotes,
  misiActive,
  outerArea,
  outerDemokrasiSub,
  outerKejutanSub,
  outerType,
  ownedSpaces,
  pentSpaceOf,
  safeGateArea,
  votersFor,
  type Action,
  type ForfeitOption,
  type GameState,
  type LogEntry,
  type Pending,
  type Player,
  type PlayerConfig,
} from "./view";

export * from "./view";
/** Number of selectable avatar portraits (presentation list lives in PlayerAvatar). */
export const AVATAR_COUNT = 18;

class RuleError extends Error {}
const deny = (msg: string): never => {
  throw new RuleError(msg);
};

// ---------- RNG ----------
function rand(s: GameState): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const die = (s: GameState) => 1 + Math.floor(rand(s) * 6);
function shuffle<T>(s: GameState, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [checkedAt(a, i), checkedAt(a, j)] = [checkedAt(a, j), checkedAt(a, i)];
  }
  return a;
}
/** Dek per jenis petak: Demokrasi "D:<jenis>", Kejutan "K:peristiwa" / "K:kesempatan". */
export function engineDeckSource(key: string): string[] {
  if (key.startsWith("D:")) {
    const sub = key.slice(2);
    return DEMOKRASI.filter((c) => c.sub === sub).map((c) => c.id);
  }
  if (key.startsWith("K:")) {
    const sub = key.slice(2);
    return KEJUTAN.filter((c) => c.sub === sub).map((c) => c.id);
  }
  return deckSource(key);
}
function draw(s: GameState, key: string): string {
  if (!s.decks[key] || s.decks[key].length === 0) s.decks[key] = shuffle(s, engineDeckSource(key));
  return s.decks[key].pop();
}

// ---------- Ledger ----------
function moveTokens(s: GameState, from: number, to: number, n: number, origin?: number): number {
  let moved = 0;
  for (const t of s.tokens) {
    if (moved >= n) break;
    if (t.loc === from && (origin === undefined || t.origin === origin)) {
      t.loc = to;
      moved++;
    }
  }
  return moved;
}
const giveFromStock = (s: GameState, pid: number, area: number, n: number) =>
  n > 0 ? moveTokens(s, STOCK, pid, n, area) : 0;
function returnToStock(s: GameState, pid: number, n: number): number {
  return moveTokens(s, pid, STOCK, n); // token kembali ke stok asalnya (origin tetap)
}

/** Daftar pelanggaran invarian; kosong berarti state sah. */
export function checkInvariants(s: GameState): string[] {
  const errs: string[] = [];
  if (s.tokens.length !== TOKENS_TOTAL) errs.push(`Jumlah token ${s.tokens.length} ≠ 100`);
  const ids = new Set(s.tokens.map((t) => t.id));
  if (ids.size !== s.tokens.length) errs.push("Token terduplikasi");
  for (let a = 0; a < 5; a++) {
    const c = s.tokens.filter((t) => t.origin === a).length;
    if (c !== TOKENS_PER_AREA) errs.push(`Asal area ${a}: ${c} token`);
  }
  for (const t of s.tokens) {
    const ok = t.loc === STOCK || (t.loc >= 0 && t.loc < 5) || (t.loc >= 100 && t.loc < 100 + PENT_TOTAL);
    if (!ok) errs.push(`Lokasi token ${t.id} tidak sah`);
  }
  s.spaces.forEach((owner, i) => {
    const e = escrowCount(s, i);
    if (owner === null && e !== 0) errs.push(`Petak ${i} netral tetapi jaminan ${e}`);
    if (owner !== null && e !== CLAIM_COST) errs.push(`Petak ${i} dimiliki tetapi jaminan ${e}`);
    if (owner !== null && isSafeGate(i)) errs.push(`Gerbang Aman ${i} tidak boleh diklaim sebagai petak`);
  });
  if (!s.homeOwner || s.homeOwner.length !== 5 || s.homeOwner.some((o) => !(o >= 0 && o < 5)))
    errs.push("Pemilik Gerbang Aman tidak sah");
  s.players.forEach((p) => {
    if (ownedSpaces(s, p.id).length > MAX_CLAIMS) errs.push(`${p.name} memiliki > ${MAX_CLAIMS} petak`);
    if (p.areaTokens.length !== 5) errs.push(`Token area ${p.name} tidak sah`);
    if (p.phase === "out" && legalVotes(s, p.id) > 0) errs.push(`${p.name} gugur tetapi masih memiliki suara`);
  });
  return errs;
}

// ---------- Helpers ----------
const log = (s: GameState, text: string, tone: LogEntry["tone"] = "info", who?: number) => {
  s.log.unshift({ n: s.turnCount, at: Date.now(), text, tone, who });
  if (s.log.length > 250) s.log.length = 250;
};

// ---------- Create ----------
export function createGame(configs: PlayerConfig[], seed = Date.now()): GameState {
  if (configs.length !== 5) throw new Error("Permainan membutuhkan tepat 5 pemain");
  const s: GameState = {
    version: 0,
    ruleset: RULESET,
    createdAt: Date.now(),
    seed: seed | 0,
    players: configs.map((c, i) => ({
      id: i,
      name: c.name.trim() || `Pemain ${i + 1}`,
      area: i,
      isBot: c.isBot,
      avatar: Number.isInteger(c.avatar) && c.avatar >= 0 && c.avatar < AVATAR_COUNT ? c.avatar : i,
      phase: "outer",
      outerPos: -1,
      gatePos: 0,
      pentRound: 1,
      pentSteps: 0,
      areaTokens: [false, false, false, false, false],
      emergency: 0,
      skipTurns: 0,
    })),
    tokens: Array.from({ length: TOKENS_TOTAL }, (_, id) => ({ id, origin: Math.floor(id / TOKENS_PER_AREA), loc: STOCK })),
    spaces: Array.from({ length: PENT_TOTAL }, () => null),
    homeOwner: [0, 1, 2, 3, 4],
    extended: null,
    order: [],
    turnIdx: 0,
    turnCount: 1,
    stage: "roll",
    pending: null,
    lastDice: null,
    extraRollUsed: false,
    grantExtra: false,
    decks: {},
    log: [],
    lastResult: null,
    final: null,
    seenActions: [],
  };
  // Penentu giliran: lempar dadu, tertinggi duluan; seri dilempar ulang.
  const rolls = s.players.map((p) => ({ id: p.id, r: die(s), tb: rand(s) }));
  rolls.sort((a, b) => b.r - a.r || b.tb - a.tb);
  s.order = rolls.map((r) => r.id);
  log(s, `Penentu giliran: ${rolls.map((r) => `${checkedAt(s.players, r.id).name} (${r.r})`).join(", ")}`, "system");
  log(s, "100 token suara disiapkan: 20 di stok tiap area.", "system");
  log(s, `Giliran pertama: ${currentPlayer(s).name}`, "system");
  return s;
}

// ---------- Reducer ----------
export function reduce(prev: GameState, action: Action): GameState {
  return tryReduce(prev, action).state;
}

/** Sama seperti reduce, tetapi memberi alasan bila aksi ditolak. */
export function tryReduce(prev: GameState, action: Action): { state: GameState; error?: string } {
  if (action.id && prev.seenActions.includes(action.id)) return { state: prev };
  const s = structuredClone(prev);
  if (action.id) s.seenActions = [...s.seenActions.slice(-49), action.id];
  try {
    apply(s, action);
  } catch (e) {
    if (e instanceof RuleError) return { state: prev, error: e.message };
    throw e;
  }
  s.version++;
  return { state: s };
}

function apply(s: GameState, a: Action) {
  if (s.stage === "over") return applyFinal(s, a);
  const p = currentPlayer(s);
  const pend = s.pending;
  switch (a.type) {
    case "ROLL": {
      if (s.stage !== "roll") deny("Belum waktunya melempar dadu");
      const v = a.value && a.value >= 1 && a.value <= 6 ? Math.floor(a.value) : die(s);
      s.lastDice = v;
      s.lastResult = null;
      log(s, `${p.name} melempar dadu (${v})`, "info", p.id);
      const entry = checkedAt(s.log, 0);
      doMove(s, p, v);
      entry.text += ` dan melangkah ke ${describePosition(p)}`;
      return;
    }
    case "ANSWER": {
      if (!pend) return deny("Tidak ada kartu");
      if (pend.kind === "aspirasi") return resolveAspirasi(s, p, pend, a.choice);
      if (pend.kind === "cekfakta") return resolveCekFakta(s, p, pend, a.choice);
      if (pend.kind === "misi") return resolveMisi(s, p, pend, a.choice);
      if (pend.kind === "dilema") return resolveDilema(s, p, pend, a.choice);
      if (pend.kind === "refleksi") return resolveRefleksi(s, p, pend, a.choice);
      return deny("Kartu ini tidak dijawab");
    }
    case "ACK": {
      if (pend?.kind === "kejutan") {
        const c = card<KejutanCard>(pend.cardId);
        const lines = applyEffect(s, p, c.effect, pend.area);
        s.lastResult = { title: c.sub === "kesempatan" ? "Kesempatan" : "Peristiwa", lines, tone: c.sub === "kesempatan" ? "gain" : "loss", cardId: c.id };
        return finishResolution(s);
      }
      if (pend?.kind === "refleksi") {
        const lines = rewardCorrect(s, p, pend.area, "Refleksi");
        s.lastResult = { title: "Refleksi selesai", lines, tone: "gain", cardId: pend.cardId };
        return finishResolution(s);
      }
      return deny("Tidak ada kartu untuk dikonfirmasi");
    }
    case "FORUM_STANCE": {
      if (pend?.kind !== "forum" || pend.stance !== null) return deny("Bukan saatnya memilih sikap");
      pend.stance = a.choice;
      log(s, `${p.name} menyampaikan sikap di Forum Demokrasi`, "info", p.id);
      return;
    }
    case "VOTE": {
      if (!pend || (pend.kind !== "forum" && pend.kind !== "putusan")) return deny("Tidak ada voting");
      if (pend.kind === "forum" && pend.stance === null) return deny("Sikap belum disampaikan");
      const voters = votersFor(s, p.id);
      if (!voters.includes(a.voter)) return deny("Tidak berhak memilih");
      if (pend.votes[a.voter] !== undefined) return deny("Sudah memilih");
      if (a.choice !== 0 && a.choice !== 1) return deny("Pilihan tidak sah");
      pend.votes[a.voter] = a.choice;
      if (Object.keys(pend.votes).length < voters.length) return;
      return pend.kind === "forum" ? resolveForum(s, p, pend) : resolvePutusan(s, p, pend);
    }
    case "CLAIM": {
      if (pend?.kind !== "claim") return deny("Tidak ada klaim");
      if (a.accept) {
        if (!canClaim(s, p)) return deny(`Syarat klaim tidak terpenuhi (maks ${MAX_CLAIMS} petak, butuh ${CLAIM_COST} suara di tangan)`);
        moveTokens(s, p.id, escrowLoc(pend.space), CLAIM_COST);
        s.spaces[pend.space] = p.id;
        log(s, `${p.name} mengklaim petak P${pend.space + 1}: ${CLAIM_COST} suara dijaminkan`, "info", p.id);
        s.lastResult = { title: "Petak diklaim", lines: [`${CLAIM_COST} suara dijaminkan di petak — tetap suara sahmu`, "Token Area milikmu ditaruh di petak"], tone: "info" };
      } else {
        log(s, `${p.name} tidak mengklaim petak`, "info", p.id);
        s.lastResult = null;
      }
      return finishResolution(s);
    }
    case "DUEL_ANSWER": {
      if (pend?.kind !== "duel") return deny("Tidak ada duel");
      if (a.player !== p.id && a.player !== pend.opponent) return deny("Bukan peserta duel");
      if (pend.answers[a.player] !== undefined) return deny("Jawaban sudah dikunci");
      pend.answers[a.player] = a.choice;
      if (Object.keys(pend.answers).length < 2) return;
      return resolveDuel(s, p, pend);
    }
    case "FORFEIT": {
      if (pend?.kind !== "forfeit") return deny("Tidak ada penyerahan");
      if (a.player !== pend.payer) return deny("Bukan pemain yang menyerahkan");
      const opt = checkedAt(pend.options, a.option);
      if (!opt) return deny("Pilihan tidak sah");
      const lines = [pend.reason, ...applyForfeit(s, pend.payer, pend.receiver, opt)];
      s.lastResult = { title: "Hasil Duel", lines, tone: "info" };
      return finishResolution(s);
    }
    case "END_TURN": {
      if (s.stage !== "end") return deny("Giliran belum selesai");
      return advanceTurn(s);
    }
    default:
      return deny("Aksi tidak dikenal pada fase ini");
  }
}

// ---------- Movement ----------
function doMove(s: GameState, p: Player, r: number) {
  if (p.phase === "outer") {
    if (isEligibleForGate(s, p)) {
      p.phase = "gate";
      if (r > GATE_LEN) {
        log(s, `${p.name} memasuki Gerbang Demokrasi — angka melampaui petak ${GATE_LEN}`, "system", p.id);
        return enterHome(s, p);
      }
      p.gatePos = r;
      log(s, `${p.name} memasuki Gerbang Demokrasi (petak ${p.gatePos})`, "system", p.id);
      return landGate(s, p);
    }
    p.outerPos = p.outerPos < 0 ? p.area * OUTER_PER_AREA + r - 1 : (p.outerPos + r) % OUTER_TOTAL;
    return landOuter(s, p);
  }
  if (p.phase === "gate") {
    if (p.gatePos + r > GATE_LEN) return enterHome(s, p);
    p.gatePos += r;
    return landGate(s, p);
  }
  if (p.phase === "pentagon") return movePent(s, p, r);
  deny("Pemain tidak dapat bergerak");
}

/** Pion langsung mengisi Gerbang Aman/Homebase area asal (awal Pentagon putaran 1). */
function placeAtHome(s: GameState, p: Player) {
  p.phase = "pentagon";
  p.gatePos = GATE_LEN;
  p.pentRound = 1;
  p.pentSteps = 0;
  log(s, `${p.name} mengisi Gerbang Aman ${checkedAt(AREAS, p.area).name} — Pentagon Putaran 1`, "system", p.id);
}
function enterHome(s: GameState, p: Player) {
  placeAtHome(s, p);
  s.lastResult = { title: "Gerbang Aman", lines: [`Angka dadu melampaui petak ${GATE_LEN}: langsung ke Gerbang Aman`, "Mulai Pentagon Putaran 1"], tone: "info" };
  finishResolution(s);
}

function landOuter(s: GameState, p: Player) {
  const type = outerType(p.outerPos);
  const area = outerArea(p.outerPos);
  if (type === "E") {
    log(s, `${p.name} berhenti di petak kosong — tidak ada kartu`, "info", p.id);
    s.lastResult = { title: "Petak kosong", lines: ["Tidak ada kartu yang dibuka", "Giliran selesai"], tone: "info" };
    return finishResolution(s);
  }
  s.stage = "pending";
  if (type === "K") {
    s.pending = { kind: "kejutan", cardId: draw(s, `K:${outerKejutanSub(p.outerPos)}`), area };
  } else if (type === "D") {
    if (misiActive(s, p)) s.pending = { kind: "misi", cardId: draw(s, "MISI"), area };
    else {
      const sub = outerDemokrasiSub(p.outerPos);
      s.pending = { kind: sub, cardId: draw(s, `D:${sub}`), area };
    }
  } else {
    const lvl = type.slice(1);
    s.pending = { kind: "aspirasi", cardId: draw(s, `A${lvl}-${area}`), area };
  }
}

function landGate(s: GameState, p: Player) {
  s.stage = "pending";
  s.pending = { kind: "putusan", cardId: draw(s, "PR"), votes: {} };
  log(s, `Putusan Rakyat untuk ${p.name} — pemain lain memilih`, "info", p.id);
}

function movePent(s: GameState, p: Player, r: number) {
  const before = p.pentSteps;
  p.pentSteps = Math.min(PENT_TOTAL, before + r);
  if (before + r > PENT_TOTAL) log(s, "Angka dadu berlebih diabaikan — berhenti di Gerbang Aman asal", "info", p.id);
  if (p.pentSteps === PENT_TOTAL) {
    p.pentSteps = 0;
    const done = p.pentRound;
    if (done === 1) {
      p.pentRound = 2;
      log(s, `${p.name} menuntaskan Putaran 1 Pentagon — lanjut Putaran 2 (duel dimulai)`, "system", p.id);
    } else if (!s.extended) {
      p.phase = "done";
      log(s, `${p.name} menuntaskan dua putaran Pentagon`, "system", p.id);
    } else {
      p.pentRound = done + 1;
      log(s, `${p.name} menuntaskan putaran ${done} — lanjut putaran ${done + 1}`, "system", p.id);
    }
    s.lastResult = { title: "Putaran selesai", lines: ["Kembali ke Gerbang Aman asal"], tone: "info" };
    return finishResolution(s);
  }
  return landPent(s, p);
}

function landPent(s: GameState, p: Player) {
  const sp = pentSpaceOf(p);
  const owner = checkedAt(s.spaces, sp);
  const info = (title: string, line: string) => {
    s.lastResult = { title, lines: [line], tone: "info" };
    finishResolution(s);
  };
  if (isSafeGate(sp)) {
    const area = safeGateArea(sp);
    const home = homeOwnerOf(s, area);
    if (p.pentRound === 1) return info("Gerbang Aman", "Tidak ada duel pada putaran pertama");
    if (home === p.id) return info("Gerbang Aman sendiri", "Aman, tidak membayar");
    return startDuel(s, p, home, sp, true);
  }
  if (owner === p.id) return info("Petak sendiri", "Aman, tidak membayar");
  if (owner === null) {
    if (canClaim(s, p)) {
      s.stage = "pending";
      s.pending = { kind: "claim", space: sp };
      return;
    }
    return info("Petak netral", `Syarat klaim belum terpenuhi (butuh ${CLAIM_COST} suara di tangan, maks ${MAX_CLAIMS} petak)`);
  }
  if (p.pentRound === 1) return info("Petak sudah dimiliki", `Milik ${checkedAt(s.players, owner).name} — tidak ada duel pada putaran pertama`);
  return startDuel(s, p, owner, sp, false);
}

function startDuel(s: GameState, p: Player, opponent: number, space: number, home: boolean) {
  s.stage = "pending";
  s.pending = { kind: "duel", cardId: draw(s, "P"), opponent, space, home, answers: {} };
  log(s, `Duel ${home ? "di Gerbang Aman" : `perebutan P${space + 1}`}! ${p.name} vs ${checkedAt(s.players, opponent).name}`, "system", p.id);
}

// ---------- Resolutions ----------
function applyEffect(s: GameState, p: Player, e: Effect, area: number): string[] {
  const lines: string[] = [];
  if (e.votes && e.votes > 0) {
    const got = giveFromStock(s, p.id, area, e.votes);
    lines.push(got ? `+${got} suara dari stok ${checkedAt(AREAS, area).name}` : "Stok area habis");
    if (got < e.votes && got) lines.push(`Dibatasi sisa stok (${got}/${e.votes})`);
  }
  if (e.votes && e.votes < 0) {
    const lost = returnToStock(s, p.id, -e.votes);
    lines.push(lost ? `−${lost} sanksi (kembali ke stok asal)` : "Tidak ada suara untuk dikembalikan");
  }
  if (e.move) {
    if (p.phase === "outer") {
      p.outerPos = (p.outerPos + e.move + OUTER_TOTAL) % OUTER_TOTAL;
    } else if (p.phase === "gate") {
      if (p.gatePos + e.move > GATE_LEN) placeAtHome(s, p);
      else p.gatePos = Math.max(1, p.gatePos + e.move);
    }
    lines.push(e.move > 0 ? `Maju ${e.move} petak` : `Mundur ${-e.move} petak`);
  }
  if (e.skip) {
    p.skipTurns += e.skip;
    lines.push(`Lewati ${e.skip} giliran`);
  }
  if (e.extraRoll) {
    if (!s.extraRollUsed) {
      s.grantExtra = true;
      lines.push("Lemparan ekstra!");
    } else lines.push("Lemparan ekstra sudah dipakai giliran ini");
  }
  lines.forEach((l) => log(s, `${p.name}: ${l}`, l.startsWith("+") || l.startsWith("Maju") || l.startsWith("Lemparan ekstra!") ? "gain" : l.startsWith("−") || l.startsWith("Mundur") || l.startsWith("Lewati") ? "loss" : "info", p.id));
  return lines;
}

/** Benar = 2 suara dari stok area (dibatasi sisa stok) + Token Area pada keberhasilan pertama. */
function rewardCorrect(s: GameState, p: Player, area: number, source: string): string[] {
  const lines: string[] = [];
  const got = giveFromStock(s, p.id, area, CORRECT_REWARD);
  lines.push(got ? `+${got} suara dari ${source} (stok ${checkedAt(AREAS, area).name})` : "Stok area habis — tidak ada suara");
  if (got > 0 && got < CORRECT_REWARD) lines.push(`Dibatasi sisa stok (${got}/${CORRECT_REWARD})`);
  if (!p.areaTokens[area]) {
    p.areaTokens[area] = true;
    lines.push(`Token Area ${checkedAt(AREAS, area).name} diperoleh!`);
  }
  lines.forEach((l) => log(s, `${p.name}: ${l}`, l.startsWith("+") || l.startsWith("Token") ? "gain" : "info", p.id));
  return lines;
}

/** Kartu berbobot (SJT): jawaban benar = pilihan berbobot tertinggi menurut kunci. */
const sjtCorrect = (weights: number[], choice: number) => checkedAt(weights, choice) === Math.max(...weights);

function resolveAspirasi(s: GameState, p: Player, pend: Extract<Pending, { kind: "aspirasi" }>, choice: number) {
  const c = card<AspirasiCard>(pend.cardId);
  if (choice < 0 || choice >= c.options.length) deny("Pilihan tidak sah");
  const ok = c.weights ? sjtCorrect(c.weights, choice) : choice === c.answer;
  const lines = ok ? rewardCorrect(s, p, pend.area, "Aspirasi") : ["Jawaban belum tepat, +0"];
  const best = c.weights ? c.weights.indexOf(Math.max(...c.weights)) : c.answer;
  s.lastResult = { title: ok ? "Aspirasi berhasil" : "Aspirasi gagal", lines, tone: ok ? "gain" : "loss", cardId: c.id, choice, correct: best };
  finishResolution(s);
}

function resolveCekFakta(s: GameState, p: Player, pend: Extract<Pending, { kind: "cekfakta" }>, choice: number) {
  const c = card<DemokrasiCard>(pend.cardId);
  const ok = choice === c.answer;
  const lines = ok ? rewardCorrect(s, p, pend.area, "Cek Fakta") : ["Belum tepat, +0"];
  s.lastResult = { title: ok ? "Cek Fakta tepat" : "Cek Fakta keliru", lines, tone: ok ? "gain" : "loss", cardId: c.id, choice, correct: c.answer };
  finishResolution(s);
}

function resolveMisi(s: GameState, p: Player, pend: Extract<Pending, { kind: "misi" }>, choice: number) {
  const c = card<McqCard>(pend.cardId);
  const ok = choice === c.answer;
  const need = Math.max(0, QUALIFY_VOTES - handCount(s, p.id) - p.emergency);
  const pts = ok ? Math.min(5, need) : 0;
  p.emergency += pts;
  const line = ok ? `+${pts} Poin Kelayakan (bukan suara asli, tidak dihitung di akhir)` : "Misi gagal, +0 poin";
  log(s, `${p.name}: ${line}`, ok ? "gain" : "info", p.id);
  s.lastResult = { title: "Misi Pemenuhan Syarat", lines: [line], tone: ok ? "gain" : "loss", cardId: c.id, choice, correct: c.answer };
  finishResolution(s);
}

function resolveDilema(s: GameState, p: Player, pend: Extract<Pending, { kind: "dilema" }>, choice: number) {
  const c = card<DemokrasiCard>(pend.cardId);
  if (c.weights) {
    if (choice < 0 || choice >= c.options.length) return deny("Pilihan tidak sah");
    const ok = sjtCorrect(c.weights, choice);
    const lines = ok ? rewardCorrect(s, p, pend.area, "Dilema") : ["Belum pilihan terbaik, +0"];
    s.lastResult = { title: ok ? "Dilema tepat" : "Dilema belum tepat", lines, tone: ok ? "gain" : "loss", cardId: c.id, choice, correct: c.weights.indexOf(Math.max(...c.weights)) };
    return finishResolution(s);
  }
  const ch = c.choices?.[choice];
  if (!ch) return deny("Pilihan tidak sah");
  const lines = applyEffect(s, p, ch.effect, pend.area);
  s.lastResult = { title: "Dilema diputuskan", lines: [ch.label, ...lines], tone: "info", cardId: c.id };
  finishResolution(s);
}

function resolveRefleksi(s: GameState, p: Player, pend: Extract<Pending, { kind: "refleksi" }>, choice: number) {
  const c = card<DemokrasiCard>(pend.cardId);
  if (c.answer === undefined || !c.options) return deny("Kartu ini tidak dijawab");
  if (choice < 0 || choice >= c.options.length) return deny("Pilihan tidak sah");
  const ok = choice === c.answer;
  const lines = ok ? rewardCorrect(s, p, pend.area, "Refleksi") : ["Belum tepat, +0"];
  s.lastResult = { title: ok ? "Refleksi tepat" : "Refleksi keliru", lines, tone: ok ? "gain" : "loss", cardId: c.id, choice, correct: c.answer };
  finishResolution(s);
}

function resolveForum(s: GameState, p: Player, pend: Extract<Pending, { kind: "forum" }>) {
  const n = Object.keys(pend.votes).length;
  const support = Object.values(pend.votes).filter((v) => v === 0).length;
  const reward = support * 4 >= n * 3 ? 2 : support * 2 >= n ? 1 : 0;
  const lines = [`Dukungan forum ${support}–${n - support}`];
  lines.push(...(reward ? applyEffect(s, p, { votes: reward }, pend.area) : ["Argumen kurang meyakinkan, +0"]));
  s.lastResult = { title: "Forum Demokrasi", lines, tone: reward ? "gain" : "info", cardId: pend.cardId };
  finishResolution(s);
}

function resolvePutusan(s: GameState, p: Player, pend: Extract<Pending, { kind: "putusan" }>) {
  const c = card<PutusanCard>(pend.cardId);
  const a = Object.values(pend.votes).filter((v) => v === 0).length;
  const b = Object.keys(pend.votes).length - a;
  const pick: "a" | "b" = a === b ? c.lighter : a > b ? "a" : "b";
  const opt = c[pick];
  const lines = [`Voting ${a}–${b}${a === b ? " (seri: konsekuensi lebih ringan)" : ""}`, `Putusan: ${opt.label}`];
  log(s, `Putusan Rakyat ${p.name}: ${a}–${b} → ${opt.label}`, "system", p.id);
  lines.push(...applyEffect(s, p, opt.effect, p.area));
  s.lastResult = { title: "Putusan Rakyat", lines, tone: (opt.effect.votes ?? 0) < 0 || (opt.effect.move ?? 0) < 0 || opt.effect.skip ? "loss" : "gain", cardId: c.id, choice: pick === "a" ? 0 : 1 };
  finishResolution(s);
}

/** Pindahkan kepemilikan petak beserta 4 suara jaminannya. Bila penerima sudah 5 petak, suara masuk tangan dan petak netral. */
function transferSpace(s: GameState, sp: number, to: number): string {
  const from = checkedAt(s.spaces, sp);
  if (ownedSpaces(s, to).length < MAX_CLAIMS) {
    s.spaces[sp] = to;
    return `P${sp + 1} dan ${escrowCount(s, sp)} suara jaminan berpindah dari ${checkedAt(s.players, from).name} ke ${checkedAt(s.players, to).name}`;
  }
  const n = moveTokens(s, escrowLoc(sp), to, CLAIM_COST);
  s.spaces[sp] = null;
  return `${checkedAt(s.players, to).name} sudah memiliki ${MAX_CLAIMS} petak: ${n} suara jaminan P${sp + 1} masuk tangan, petak kembali netral`;
}

function applyForfeit(s: GameState, payer: number, receiver: number, o: ForfeitOption): string[] {
  const P = checkedAt(s.players, payer);
  const R = checkedAt(s.players, receiver);
  let line: string;
  if (o.type === "votes") {
    const n = moveTokens(s, payer, receiver, o.n);
    line = `${P.name} menyerahkan ${n} suara kepada ${R.name}`;
  } else if (o.type === "space") {
    line = transferSpace(s, o.space, receiver);
  } else {
    s.homeOwner[o.area] = receiver;
    line = `${P.name} menyerahkan Gerbang Aman ${checkedAt(AREAS, o.area).name} kepada ${R.name}`;
  }
  log(s, line, "system", payer);
  return [line];
}

/** Buat penyerahan: satu pilihan langsung dijalankan, lebih dari satu menunggu pilihan pemain. */
function settle(s: GameState, payer: number, receiver: number, space: number, reason: string, options: ForfeitOption[], lines: string[]): boolean {
  if (options.length === 0) {
    lines.push(`${checkedAt(s.players, payer).name} tidak memiliki suara atau petak untuk diserahkan`);
    return false;
  }
  if (options.length === 1) {
    lines.push(...applyForfeit(s, payer, receiver, checkedAt(options, 0)));
    return false;
  }
  s.stage = "pending";
  s.pending = { kind: "forfeit", payer, receiver, space, reason, options };
  log(s, `${checkedAt(s.players, payer).name} memilih apa yang diserahkan`, "system", payer);
  return true;
}

function resolveDuel(s: GameState, p: Player, pend: Extract<Pending, { kind: "duel" }>) {
  const c = card<McqCard>(pend.cardId);
  const opp = checkedAt(s.players, pend.opponent);
  const okP = pend.answers[p.id] === c.answer;
  const okO = pend.answers[opp.id] === c.answer;
  // Perebutan berhasil hanya bila penantang menang duel; selain itu dianggap gagal.
  const win = okP && !okO;
  const lines = [`${p.name} ${okP ? "benar" : "keliru"} · ${opp.name} ${okO ? "benar" : "keliru"}`];
  const sp = pend.space;
  let waiting = false;
  if (pend.home) {
    const area = safeGateArea(sp);
    if (win) {
      const reason = `${opp.name} kalah duel di Gerbang Aman ${checkedAt(AREAS, area).name}`;
      lines.push(reason);
      const options: ForfeitOption[] = [{ type: "home", area }, ...ownedSpaces(s, opp.id).map((space) => ({ type: "space" as const, space }))];
      waiting = settle(s, opp.id, p.id, sp, reason, options, lines);
    } else {
      const reason = `${p.name} gagal menantang Gerbang Aman ${checkedAt(AREAS, area).name}`;
      lines.push(reason);
      const hand = handCount(s, p.id);
      const spaces = ownedSpaces(s, p.id);
      const options: ForfeitOption[] = [];
      if (hand > 0 && (hand >= HOME_PENALTY || spaces.length === 0)) options.push({ type: "votes", n: Math.min(HOME_PENALTY, hand) });
      spaces.forEach((space) => options.push({ type: "space", space }));
      waiting = settle(s, p.id, opp.id, sp, reason, options, lines);
    }
  } else if (win) {
    lines.push("Perebutan berhasil", transferSpace(s, sp, p.id));
    log(s, checkedAt(lines, lines.length - 1), "system", p.id);
  } else {
    lines.push("Perebutan gagal");
    const hand = handCount(s, p.id);
    if (hand > 0) {
      const n = moveTokens(s, p.id, opp.id, Math.min(CONTEST_PENALTY, hand));
      const line = `${p.name} menyerahkan ${n} suara kepada ${opp.name}`;
      lines.push(line);
      log(s, line, "loss", p.id);
    } else {
      const reason = `${p.name} hanya punya suara jaminan: wajib merelakan 1 petak`;
      lines.push(reason);
      const options = ownedSpaces(s, p.id).map((space) => ({ type: "space" as const, space }));
      waiting = settle(s, p.id, opp.id, sp, reason, options, lines);
    }
  }
  log(s, `Hasil duel: ${checkedAt(lines, 0)}`, "system", p.id);
  s.lastResult = { title: "Hasil Duel", lines, tone: "info", cardId: c.id, correct: c.answer };
  if (!waiting) finishResolution(s);
}

/** Pemain gugur bila suara di tangan, jaminan, petak, dan Gerbang Aman semuanya habis. */
function checkElimination(s: GameState) {
  for (const p of s.players) {
    if (!isAlive(p)) continue;
    if (handCount(s, p.id) === 0 && ownedSpaces(s, p.id).length === 0 && homesOwned(s, p.id).length === 0) {
      p.phase = "out";
      log(s, `${p.name} GUGUR — kehabisan suara, petak, dan Gerbang Aman`, "loss", p.id);
    }
  }
}

function finishResolution(s: GameState) {
  s.pending = null;
  checkElimination(s);
  const p = currentPlayer(s);
  if (s.grantExtra && (p.phase === "outer" || p.phase === "gate" || p.phase === "pentagon")) {
    s.grantExtra = false;
    s.extraRollUsed = true;
    s.stage = "roll";
    log(s, `${p.name} mendapat lemparan ekstra`, "gain", p.id);
  } else {
    s.grantExtra = false;
    s.stage = "end";
  }
}

function advanceTurn(s: GameState) {
  s.extraRollUsed = false;
  s.grantExtra = false;
  s.lastResult = null;
  s.pending = null;
  if (checkEnd(s)) return;
  for (let guard = 0; guard < 200; guard++) {
    s.turnIdx = (s.turnIdx + 1) % 5;
    if (s.turnIdx === 0) s.turnCount++;
    const p = currentPlayer(s);
    if (p.phase === "done" || p.phase === "out") continue;
    if (p.skipTurns > 0) {
      p.skipTurns--;
      log(s, `${p.name} melewatkan giliran`, "loss", p.id);
      continue;
    }
    s.stage = "roll";
    return;
  }
  finalize(s, "Suara sah terbanyak");
}

// ---------- Akhir permainan ----------
const scoresOf = (s: GameState) => s.players.map((p) => (isAlive(p) ? legalVotes(s, p.id) : 0));

/** Pemain tunggal yang mencapai target; null bila belum ada atau seri. */
function soleReaching(scores: number[], target: number): number | null {
  const reach = scores.map((v, id) => ({ v, id })).filter((x) => x.v >= target);
  if (reach.length === 0) return null;
  const top = Math.max(...reach.map((x) => x.v));
  const best = reach.filter((x) => x.v === top);
  return best.length === 1 ? checkedAt(best, 0).id : null;
}

/** true bila permainan berakhir. */
function checkEnd(s: GameState): boolean {
  const alive = s.players.filter(isAlive);
  if (alive.length <= 1) {
    finalize(s, "Satu-satunya pemain yang bertahan");
    return true;
  }
  const scores = scoresOf(s);
  const reaching50 = scores.filter((v) => v >= WIN_TARGET).length;
  if (!s.extended) {
    if (!alive.every((p) => p.phase === "done")) return false;
    const target = reaching50 >= 2 ? WIN_TARGET_HIGH : WIN_TARGET;
    const winner = soleReaching(scores, target);
    if (winner !== null) {
      finalize(s, `Suara sah terbanyak (≥ ${target} suara)`);
      return true;
    }
    if (scores.reduce((a, b) => a + b, 0) < target) {
      finalize(s, `Suara sah terbanyak — total suara tidak cukup untuk mencapai ${target}`);
      return true;
    }
    s.extended = { target };
    for (const p of alive) {
      p.phase = "pentagon";
      p.pentRound = 3;
      p.pentSteps = 0;
    }
    log(s, `Belum ada pemain dengan ${target} suara — pemain bertahan melanjutkan putaran Pentagon`, "system");
    return false;
  }
  if (reaching50 >= 2 && s.extended.target < WIN_TARGET_HIGH) {
    s.extended.target = WIN_TARGET_HIGH;
    log(s, `Dua pemain mencapai ${WIN_TARGET} suara — permainan berlanjut hingga ${WIN_TARGET_HIGH} suara`, "system");
  }
  const target = s.extended.target;
  if (soleReaching(scores, target) !== null) {
    finalize(s, `Mencapai ${target} suara sah`);
    return true;
  }
  if (scores.reduce((a, b) => a + b, 0) < target) {
    finalize(s, `Suara sah terbanyak — total suara tidak cukup untuk mencapai ${target}`);
    return true;
  }
  if (alive.every((p) => p.pentRound > 2 + EXTRA_ROUNDS_CAP)) {
    finalize(s, `Suara sah terbanyak setelah ${EXTRA_ROUNDS_CAP} putaran tambahan`);
    return true;
  }
  return false;
}

function finalize(s: GameState, note: string) {
  const scores = scoresOf(s);
  const max = Math.max(...scores);
  const leaders = s.players.filter((p) => isAlive(p) && checkedAt(scores, p.id) === max).map((p) => p.id);
  s.stage = "over";
  s.pending = null;
  log(s, `Penghitungan suara sah: ${s.players.map((p) => `${p.name} ${checkedAt(scores, p.id)}`).join(", ")}`, "system");
  if (leaders.length === 1) {
    s.final = { scores, finalists: leaders, stage: "done", caseId: null, votes: {}, objective: null, winners: leaders, note };
    log(s, `Pemenang: ${checkedAt(s.players, checkedAt(leaders, 0)).name}`, "system");
  } else {
    s.final = { scores, finalists: leaders, stage: "argue", caseId: draw(s, "FDT"), votes: {}, objective: null, winners: [], note: "" };
    log(s, `Seri di puncak (${max}) — Final Democracy Test dimulai`, "system");
  }
}

function startObjective(s: GameState, f: NonNullable<GameState["final"]>, round: number) {
  f.stage = "objective";
  f.objective = { cardId: draw(s, "P"), answers: {}, round };
}

function applyFinal(s: GameState, a: Action) {
  const f = s.final;
  if (!f || f.stage === "done") return deny("Permainan sudah selesai");
  if (a.type === "FDT_START_VOTE") {
    if (f.stage !== "argue") return deny("Bukan tahap argumentasi");
    if (fdtVoters(s).length === 0) {
      log(s, "Tidak ada pemilih nonfinalis — penentu objektif", "system");
      return startObjective(s, f, 1);
    }
    f.stage = "vote";
    return;
  }
  if (a.type === "VOTE") {
    if (f.stage !== "vote") return deny("Bukan tahap voting");
    if (!fdtVoters(s).includes(a.voter)) return deny("Finalis tidak boleh memilih");
    if (f.votes[a.voter] !== undefined) return deny("Sudah memilih");
    if (!f.finalists.includes(a.choice)) return deny("Pilihan harus finalis");
    f.votes[a.voter] = a.choice;
    if (Object.keys(f.votes).length < fdtVoters(s).length) return;
    const tally = f.finalists.map((id) => ({ id, n: Object.values(f.votes).filter((v) => v === id).length }));
    const top = Math.max(...tally.map((t) => t.n));
    const best = tally.filter((t) => t.n === top).map((t) => t.id);
    log(s, `Voting Final: ${tally.map((t) => `${checkedAt(s.players, t.id).name} ${t.n}`).join(", ")}`, "system");
    if (best.length === 1) {
      f.stage = "done";
      f.winners = best;
      f.note = "Menang melalui voting Final Democracy Test";
      log(s, `Pemenang: ${checkedAt(s.players, checkedAt(best, 0)).name}`, "system");
      return;
    }
    f.finalists = best;
    log(s, "Voting seri — penentu objektif lanjutan", "system");
    return startObjective(s, f, 1);
  }
  if (a.type === "FDT_ANSWER") {
    if (f.stage !== "objective" || !f.objective) return deny("Bukan tahap penentu objektif");
    if (!f.finalists.includes(a.player)) return deny("Bukan finalis");
    if (f.objective.answers[a.player] !== undefined) return deny("Jawaban sudah dikunci");
    f.objective.answers[a.player] = a.choice;
    if (Object.keys(f.objective.answers).length < f.finalists.length) return;
    const c = card<McqCard>(f.objective.cardId);
    const correct = f.finalists.filter((id) => f.objective.answers[id] === c.answer);
    log(s, `Penentu objektif ronde ${f.objective.round}: benar — ${correct.map((id) => checkedAt(s.players, id).name).join(", ") || "tidak ada"}`, "system");
    if (correct.length === 1) {
      f.stage = "done";
      f.winners = correct;
      f.note = "Menang melalui penentu objektif";
      log(s, `Pemenang: ${checkedAt(s.players, checkedAt(correct, 0)).name}`, "system");
      return;
    }
    const remain = correct.length > 0 ? correct : f.finalists;
    f.finalists = remain;
    if (f.objective.round >= 3) {
      f.stage = "done";
      f.winners = remain;
      f.note = "Menang bersama setelah 3 ronde penentu objektif";
      log(s, `Menang bersama: ${remain.map((id) => checkedAt(s.players, id).name).join(", ")}`, "system");
      return;
    }
    return startObjective(s, f, f.objective.round + 1);
  }
  deny("Aksi tidak sah pada tahap akhir");
}
