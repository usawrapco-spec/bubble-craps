import { buildAnim, d6, initialRest } from "./dice";
import type { Bets, Face, HeatKind, Ledger, Pattern, Phase, RollTicket, Seat, Table, ThrowKind } from "./types";

export const MIN = 10;
export const MAX_ODDS_X = 2;
export const NUMS = [4, 5, 6, 8, 9, 10];
export const NAME: Record<number, string> = {
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
};

export const MINE = "#FFD400";
export const WIN_C = "#4ea8ff";
export const LOSE_C = "#ff9f1c";
export const GOLD = "#ffd75e";

export function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function money(n: number): string {
  const a = r2(Math.abs(n));
  const body = Number.isInteger(a) ? String(a) : a.toFixed(2);
  return (n < 0 ? "-$" : "$") + body;
}

export function signed(n: number): string {
  const v = r2(n);
  return v > 0 ? "✓ +" + money(v) : v < 0 ? "✗ −" + money(-v) : "— $0";
}

/** Visible per-roll line. Net is winnings minus forfeits minus new wagers taken from credits. */
export function formatLedger(l: Ledger): string {
  const won = r2(l.won);
  const drain = r2(l.lost + l.placed);
  const net = r2(l.won - l.lost - l.placed);
  const wonTxt = won > 0 ? "✓ Won +" + money(won) : "Won " + money(won);
  const drainTxt = "✗ Lost/placed −" + money(drain);
  const netTxt = "Net " + (net > 0 ? "+" + money(net) : net < 0 ? "−" + money(-net) : money(0));
  const back = r2(l.returned);
  const backTxt = back > 0 ? " · Stake back +" + money(back) : "";
  return `${wonTxt} · ${drainTxt} · ${netTxt}${backTxt}`;
}

export function trueProfit(n: number, stake: number): number {
  if (n === 4 || n === 10) return r2(stake * 2);
  if (n === 5 || n === 9) return r2((stake * 3) / 2);
  return r2((stake * 6) / 5);
}

/** Lay odds profit: the inverse of the right-way price. Stake is the amount at risk. */
export function layProfit(n: number, stake: number): number {
  if (n === 4 || n === 10) return r2(stake / 2);
  if (n === 5 || n === 9) return r2((stake * 2) / 3);
  return r2((stake * 5) / 6);
}

/** 5% buy commission, taken once from the winning payout. Never charged on a miss or a repeat roll. */
export function buyProfit(n: number, stake: number): number {
  return r2(trueProfit(n, stake) - r2(stake * 0.05));
}

export function placeProfit(n: number, stake: number): number {
  if (n === 4 || n === 10) return r2((stake * 9) / 5);
  if (n === 5 || n === 9) return r2((stake * 7) / 5);
  return r2((stake * 7) / 6);
}

export function defaultPattern(): Pattern {
  return {
    on: true,
    line: true,
    lineAmt: 10,
    odds: true,
    oddsX: 2,
    buy: true,
    buyAmt: 10,
    place: true,
    placeAmt: 12,
    hard: true,
    hardAmt: 1,
  };
}

export function emptyLedger(): Ledger {
  return { won: 0, lost: 0, placed: 0, returned: 0, net: 0 };
}

export function blankFace(): Face {
  return { skin: "#d9a47c", hair: "#3a2416", shirt: "#2b6cb0", style: "short" };
}

export function createSeat(partial: Pick<Seat, "id" | "name" | "color" | "letter" | "face"> & Partial<Seat>): Seat {
  const bank = partial.bank ?? 100;
  return {
    id: partial.id,
    name: partial.name,
    color: partial.color,
    letter: partial.letter,
    bank,
    bets: partial.bets ?? {},
    come: partial.come ?? {},
    comeOdds: partial.comeOdds ?? {},
    dontCome: partial.dontCome ?? {},
    dontComeOdds: partial.dontComeOdds ?? {},
    face: partial.face,
    rebuy: partial.rebuy ?? 0,
    last: 0,
    lastWin: 0,
    lastBets: {},
    placedSince: 0,
    ledger: emptyLedger(),
    pays: {},
    banner: "",
    note: "",
    hi: bank,
    lo: bank,
    combo: 0,
    isBot: partial.isBot ?? false,
    pattern: partial.pattern ?? defaultPattern(),
    oddsOnComeout: partial.oddsOnComeout ?? false,
    betsOff: partial.betsOff ?? false,
    ticket: null,
  };
}

export function createTable(room: string, seats: Seat[]): Table {
  return {
    room,
    seats,
    shooter: 0,
    point: null,
    pointsMade: 0,
    hand: 0,
    handLog: [],
    hist: [],
    phase: "idle",
    running: true,
    betLen: 15,
    cdEnd: 0,
    cdDur: 0,
    dice: [3, 4],
    call: "Place your bets.",
    flash: "",
    flashId: 0,
    rest: initialRest(),
    roll: null,
    pending: null,
    walk: { phase: "seated", seat: 0, startedAt: 0 },
    bubbles: {},
    chat: [],
    nextRoll: 1,
    passShooter: false,
    heat: 0,
    streak: 0,
    celebration: null,
    noRollId: 0,
    serverNow: 0,
    rev: 0,
    resultUntil: 0,
    lockUntil: 0,
    awaitUntil: 0,
    returnUntil: 0,
  };
}

export function onTable(s: Seat): number {
  let t = 0;
  for (const v of Object.values(s.bets)) t += v || 0;
  for (const v of Object.values(s.come)) t += v || 0;
  for (const v of Object.values(s.comeOdds)) t += v || 0;
  for (const v of Object.values(s.dontCome)) t += v || 0;
  for (const v of Object.values(s.dontComeOdds)) t += v || 0;
  return r2(t);
}

export function equity(s: Seat): number {
  return r2(s.bank + onTable(s));
}

export function canBet(phase: Phase): boolean {
  return phase === "betting" || phase === "paused" || phase === "awaiting";
}

export function canThrow(phase: Phase): boolean {
  return phase === "betting" || phase === "paused" || phase === "awaiting";
}

function trackHiLo(s: Seat): void {
  const eq = equity(s);
  s.hi = Math.max(s.hi, eq);
  s.lo = Math.min(s.lo, eq);
}

/** Move credits onto the layout. Returns false when the player cannot cover it. Does not touch an existing wager. */
export function addBet(s: Seat, key: string, amt: number): boolean {
  const a = r2(amt);
  if (a <= 0 || s.bank + 1e-6 < a) return false;
  s.bank = r2(s.bank - a);
  s.bets[key] = r2((s.bets[key] || 0) + a);
  s.placedSince = r2(s.placedSince + a);
  trackHiLo(s);
  return true;
}

function giveBack(s: Seat, amt: number): void {
  const a = r2(amt);
  if (a <= 0) return;
  s.bank = r2(s.bank + a);
  s.placedSince = r2(Math.max(0, s.placedSince - a));
  trackHiLo(s);
}

type Res = { won: number; lost: number; returned: number; pays: Record<string, number> };

function payProfit(s: Seat, profit: number, key: string, res: Res): void {
  const a = r2(profit);
  if (a === 0) return;
  s.bank = r2(s.bank + a);
  res.won = r2(res.won + a);
  res.pays[key] = r2((res.pays[key] || 0) + a);
}

function returnStake(s: Seat, amt: number, res: Res): void {
  const a = r2(amt);
  if (a <= 0) return;
  s.bank = r2(s.bank + a);
  res.returned = r2(res.returned + a);
}

function forfeit(amt: number, res: Res): void {
  res.lost = r2(res.lost + r2(amt));
}

/** Place, buy, hardways, and odds are not working. Pass / come flats are never in this set. */
export function wagerIsOff(s: Seat, key: string, point: number | null): boolean {
  const oddsKey = key === "odds" || key === "dontOdds" || key.startsWith("comeOdds") || key.startsWith("dontComeOdds");
  const placeKey = key.startsWith("place") || key.startsWith("buy") || key.startsWith("hard");
  if (!oddsKey && !placeKey) return false;
  if (s.betsOff) return true;
  if (point !== null) return false;
  if (placeKey) return true;
  return !s.oddsOnComeout;
}

/** Text painted on a chip that is sitting out. Empty when the bet is working. */
export function offMarker(s: Seat, key: string, point: number | null): string {
  return wagerIsOff(s, key, point) ? "OFF" : "";
}

/**
 * Settle one seat from an explicit dice pair and the point that was on when those dice were thrown.
 * Place, buy, and hardway winners stay up and are not removed.
 * Odds are paid once at true odds and come down. A wager already on the layout is never re-charged here.
 * Bets Off: place, buy, hardways, and odds neither win nor lose. Flats still do.
 */
export function settleSeat(s: Seat, d1: number, d2: number, point: number | null): Res {
  const sum = d1 + d2;
  const pair = d1 === d2;
  const comeOut = point === null;
  const oddsOn = !s.betsOff && (!comeOut || s.oddsOnComeout);
  const b = s.bets;
  const res: Res = { won: 0, lost: 0, returned: 0, pays: {} };

  const releaseOdds = (book: Record<number, number>, n: number, key: string, profitOf: (stake: number) => number): void => {
    const odds = book[n] || 0;
    if (!odds) return;
    delete book[n];
    if (oddsOn) payProfit(s, profitOf(odds), key, res);
    returnStake(s, odds, res);
  };

  for (const ks of Object.keys(s.come)) {
    const n = Number(ks);
    const amt = s.come[n] || 0;
    if (sum === n) {
      delete s.come[n];
      payProfit(s, amt, "come" + n, res);
      returnStake(s, amt, res);
      releaseOdds(s.comeOdds, n, "comeOdds" + n, (stake) => trueProfit(n, stake));
    } else if (sum === 7) {
      delete s.come[n];
      forfeit(amt, res);
      const odds = s.comeOdds[n] || 0;
      if (odds) {
        delete s.comeOdds[n];
        if (oddsOn) forfeit(odds, res);
        else returnStake(s, odds, res);
      }
    }
  }

  for (const ks of Object.keys(s.dontCome)) {
    const n = Number(ks);
    const amt = s.dontCome[n] || 0;
    if (sum === n) {
      delete s.dontCome[n];
      forfeit(amt, res);
      const odds = s.dontComeOdds[n] || 0;
      if (odds) {
        delete s.dontComeOdds[n];
        if (oddsOn) forfeit(odds, res);
        else returnStake(s, odds, res);
      }
    } else if (sum === 7) {
      delete s.dontCome[n];
      payProfit(s, amt, "dontCome" + n, res);
      returnStake(s, amt, res);
      releaseOdds(s.dontComeOdds, n, "dontComeOdds" + n, (stake) => layProfit(n, stake));
    }
  }

  if (b.come) {
    if (sum === 7 || sum === 11) {
      payProfit(s, b.come, "come", res);
      returnStake(s, b.come, res);
      delete b.come;
    } else if (sum === 2 || sum === 3 || sum === 12) {
      forfeit(b.come, res);
      delete b.come;
    } else if (NUMS.includes(sum)) {
      s.come[sum] = r2((s.come[sum] || 0) + b.come);
      delete b.come;
    }
  }

  if (b.dontCome) {
    if (sum === 2 || sum === 3) {
      payProfit(s, b.dontCome, "dontCome", res);
      returnStake(s, b.dontCome, res);
      delete b.dontCome;
    } else if (sum === 7 || sum === 11) {
      forfeit(b.dontCome, res);
      delete b.dontCome;
    } else if (sum !== 12 && NUMS.includes(sum)) {
      s.dontCome[sum] = r2((s.dontCome[sum] || 0) + b.dontCome);
      delete b.dontCome;
    }
  }

  if (b.field) {
    if ([2, 3, 4, 9, 10, 11, 12].includes(sum)) {
      const mult = sum === 2 ? 2 : sum === 12 ? 3 : 1;
      payProfit(s, r2(b.field * mult), "field", res);
    } else {
      forfeit(b.field, res);
      delete b.field;
    }
  }

  const one = (k: string, hit: boolean, mult: number): void => {
    const v = b[k];
    if (!v) return;
    if (hit) payProfit(s, r2(v * mult), k, res);
    else {
      forfeit(v, res);
      delete b[k];
    }
  };
  one("any7", sum === 7, 4);
  one("anyc", sum === 2 || sum === 3 || sum === 12, 7);
  one("yo", sum === 11, 15);
  one("aces", sum === 2, 30);
  one("twelve", sum === 12, 30);

  if (point !== null && !s.betsOff) {
    for (const n of [4, 6, 8, 10]) {
      const k = "hard" + n;
      const v = b[k];
      if (!v) continue;
      if (sum === n && pair) payProfit(s, r2(v * (n === 4 || n === 10 ? 7 : 9)), k, res);
      else if (sum === 7 || sum === n) {
        forfeit(v, res);
        delete b[k];
      }
    }
    for (const n of NUMS) {
      const pk = "place" + n;
      const bk = "buy" + n;
      if (b[pk]) {
        if (sum === n) payProfit(s, placeProfit(n, b[pk]), pk, res);
        else if (sum === 7) {
          forfeit(b[pk], res);
          delete b[pk];
        }
      }
      if (b[bk]) {
        if (sum === n) payProfit(s, buyProfit(n, b[bk]), bk, res);
        else if (sum === 7) {
          forfeit(b[bk], res);
          delete b[bk];
        }
      }
    }
  }

  if (point === null) {
    if (b.pass) {
      if (sum === 7 || sum === 11) payProfit(s, b.pass, "pass", res);
      else if (sum === 2 || sum === 3 || sum === 12) {
        forfeit(b.pass, res);
        delete b.pass;
      }
    }
    if (b.dont) {
      if (sum === 2 || sum === 3) payProfit(s, b.dont, "dont", res);
      else if (sum === 7 || sum === 11) {
        forfeit(b.dont, res);
        delete b.dont;
      }
    }
    const decided = sum === 7 || sum === 11 || sum === 2 || sum === 3 || sum === 12;
    if (b.odds && decided) {
      returnStake(s, b.odds, res);
      delete b.odds;
    }
    if (b.dontOdds && decided) {
      returnStake(s, b.dontOdds, res);
      delete b.dontOdds;
    }
  } else if (sum === point) {
    if (b.pass) payProfit(s, b.pass, "pass", res);
    if (b.odds) {
      if (s.betsOff) {
        // Flat is still up, so the odds stay on the layout and are not paid.
      } else {
        const o = b.odds;
        delete b.odds;
        payProfit(s, trueProfit(point, o), "odds", res);
        returnStake(s, o, res);
      }
    }
    if (b.dont) {
      forfeit(b.dont, res);
      delete b.dont;
    }
    if (b.dontOdds) {
      const o = b.dontOdds;
      delete b.dontOdds;
      if (s.betsOff) returnStake(s, o, res);
      else forfeit(o, res);
    }
  } else if (sum === 7) {
    if (b.pass) {
      forfeit(b.pass, res);
      delete b.pass;
    }
    if (b.odds) {
      const o = b.odds;
      delete b.odds;
      if (s.betsOff) returnStake(s, o, res);
      else forfeit(o, res);
    }
    if (b.dont) payProfit(s, b.dont, "dont", res);
    if (b.dontOdds) {
      if (s.betsOff) {
        // Don't Pass is still up, so the lay stays and is not paid.
      } else {
        const o = b.dontOdds;
        delete b.dontOdds;
        payProfit(s, layProfit(point, o), "dontOdds", res);
        returnStake(s, o, res);
      }
    }
  }

  return res;
}

export function machineCall(d1: number, d2: number, point: number | null): string {
  const sum = d1 + d2;
  const nm = NAME[sum] || String(sum);
  const cap = nm.charAt(0).toUpperCase() + nm.slice(1);
  const pair = d1 === d2;
  if (point === null) {
    if (sum === 7) return "Seven, winner!";
    if (sum === 11) return "Yo eleven, winner!";
    if (sum === 2) return "Aces, craps.";
    if (sum === 3) return "Three, craps.";
    if (sum === 12) return "Twelve, craps.";
    if (pair) return `Hard ${nm}. Point is ${nm}.`;
    return `Point is ${nm}.`;
  }
  if (sum === 7) return "Seven out.";
  if (sum === point) return pair ? `Hard ${nm}, winner!` : `${cap}, winner!`;
  if (sum === 11) return "Yo eleven.";
  if (sum === 2) return "Aces.";
  if (sum === 12) return "Twelve.";
  if (pair && sum >= 4 && sum <= 10) return `Hard ${nm}.`;
  return `${cap}.`;
}

function isMain(k: string): boolean {
  return k === "pass" || k === "dont" || k === "come" || k === "dontCome" || k === "field" || k.startsWith("place") || k.startsWith("buy");
}

function numOf(k: string): number {
  return Number(k.replace(/\D/g, ""));
}

export function labelOf(k: string): string {
  const fixed: Record<string, string> = {
    pass: "Pass Line",
    dont: "Don't Pass",
    odds: "Pass odds",
    dontOdds: "Lay odds",
    come: "Come",
    dontCome: "Don't Come",
    field: "Field",
    any7: "Any Seven",
    anyc: "Any Craps",
    yo: "Yo-leven",
    aces: "Aces",
    twelve: "Twelve",
  };
  if (fixed[k]) return fixed[k];
  const n = numOf(k);
  if (k.startsWith("hard")) return "hard " + n;
  if (k.startsWith("buy")) return "buy " + n;
  if (k.startsWith("comeOdds")) return "come odds " + n;
  if (k.startsWith("dontComeOdds")) return "lay odds " + n;
  return "place " + n;
}

/**
 * Put a chip on a spot, or take that spot down.
 * Existing place/buy/hardway wagers are only increased when the player asks for another unit.
 */
export function placeChip(s: Seat, key: string, amt: number, point: number | null, takeDown = false): string {
  let k = key;
  if (k === "odds" && point !== null && !s.bets.pass && s.bets.dont) k = "dontOdds";

  if (takeDown) {
    if ((k === "pass" || k === "dont") && point !== null) return "That line bet is a contract while the point is on.";
    const cur = s.bets[k] || 0;
    if (!cur) return "Nothing of yours on that spot.";
    giveBack(s, cur);
    delete s.bets[k];
    return "Took down " + money(cur) + " from " + labelOf(k) + ".";
  }

  if ((k === "pass" || k === "dont") && point !== null) return "Line bets go down on the come-out. Use Come or Don't Come while the point is on.";
  if ((k === "come" || k === "dontCome") && point === null) return "Come and Don't Come start once a point is on.";
  if ((k === "odds" || k === "dontOdds") && point === null) return "Odds go down once a point is on. They stay off on the come-out unless you toggle them on.";

  const n = numOf(k);
  if (k.startsWith("place") && s.bets["buy" + n]) return "You're already buying the " + n + ". It stays up until a 7.";
  if (k.startsWith("buy") && s.bets["place" + n]) return "You already have the " + n + " placed. It stays up until a 7.";

  let put = r2(amt);
  if (k === "odds") {
    if (!s.bets.pass) return "Odds go behind your Pass Line once a point is on.";
    const room = r2(MAX_ODDS_X * s.bets.pass - (s.bets.odds || 0));
    if (room <= 0) return "That's max odds (2×).";
    put = Math.min(put, room);
  } else if (k === "dontOdds") {
    if (!s.bets.dont) return "Lay odds go behind Don't Pass once a point is on.";
    const room = r2(MAX_ODDS_X * s.bets.dont - (s.bets.dontOdds || 0));
    if (room <= 0) return "That's max lay odds (2×).";
    put = Math.min(put, room);
  }

  const cur = s.bets[k] || 0;
  if (isMain(k) && cur === 0 && put < MIN) put = MIN;
  if (!addBet(s, k, put)) return "Not enough credits. Insert a bill.";
  const now = s.bets[k];
  return money(put) + " on " + labelOf(k) + (cur ? " (now " + money(now) + ")" : "") + ".";
}

/** Keyboard buy: each press adds one chip. The first chip on an empty number still respects the $10 minimum. */
export function addBuyUnit(s: Seat, n: number, chip: number, point: number | null): string {
  if (!NUMS.includes(n)) return "Buy 4, 5, 6, 8, 9, or 10.";
  return placeChip(s, "buy" + n, chip, point, false);
}

/** Top every odds stack to 2× its flat. A second tap does not charge anything already at the cap. */
export function maxOdds2x(s: Seat, point: number | null): string {
  let placed = 0;
  let short = false;
  const top = (have: number, flat: number, commit: (diff: number) => void): void => {
    if (flat <= 0) return;
    const diff = r2(MAX_ODDS_X * flat - have);
    if (diff <= 0.001) return;
    const put = r2(Math.min(diff, s.bank));
    if (put <= 0) {
      short = true;
      return;
    }
    if (put + 1e-6 < diff) short = true;
    s.bank = r2(s.bank - put);
    s.placedSince = r2(s.placedSince + put);
    commit(put);
    placed = r2(placed + put);
  };

  if (point !== null && s.bets.pass) {
    top(s.bets.odds || 0, s.bets.pass, (d) => {
      s.bets.odds = r2((s.bets.odds || 0) + d);
    });
  }
  if (point !== null && s.bets.dont) {
    top(s.bets.dontOdds || 0, s.bets.dont, (d) => {
      s.bets.dontOdds = r2((s.bets.dontOdds || 0) + d);
    });
  }
  for (const n of NUMS) {
    const flat = s.come[n] || 0;
    if (flat) {
      top(s.comeOdds[n] || 0, flat, (d) => {
        s.comeOdds[n] = r2((s.comeOdds[n] || 0) + d);
      });
    }
    const df = s.dontCome[n] || 0;
    if (df) {
      top(s.dontComeOdds[n] || 0, df, (d) => {
        s.dontComeOdds[n] = r2((s.dontComeOdds[n] || 0) + d);
      });
    }
  }
  trackHiLo(s);
  if (placed <= 0 && !short) return "Odds are already at 2×.";
  if (placed <= 0 && short) return "Not enough credits for odds.";
  return "Max odds 2×: " + money(placed) + " down." + (short ? " That's all the credits would cover." : "");
}

/**
 * Auto-bet empty spots only. A place, buy, hardway, or odds stack that is already up is left alone
 * so a win can never be charged a second time.
 */
export function applyPattern(s: Seat, point: number | null): string[] {
  const P = s.pattern;
  const skipped: string[] = [];
  if (!P.on) return skipped;
  const has = (k: string) => (s.bets[k] || 0) > 0;
  const put = (k: string, a: number, lbl: string): void => {
    if (has(k)) return;
    if (!addBet(s, k, a)) skipped.push(lbl);
  };
  if (point === null && P.line && !has("dont")) put("pass", P.lineAmt, "Pass");
  if (point !== null && P.odds && (s.bets.pass || 0) > 0) {
    const cap = Math.min(MAX_ODDS_X, Math.max(1, P.oddsX));
    const diff = r2(cap * s.bets.pass - (s.bets.odds || 0));
    if (diff > 0.001 && !addBet(s, "odds", diff)) skipped.push("odds");
  }
  if (point !== null) {
    if (P.buy) {
      for (const n of [4, 5, 9, 10]) {
        if (n !== point && !has("place" + n)) put("buy" + n, P.buyAmt, "buy " + n);
      }
    }
    if (P.place) {
      for (const n of [6, 8]) {
        if (n !== point && !has("buy" + n)) put("place" + n, P.placeAmt, "place " + n);
      }
    }
    if (P.hard) {
      for (const n of [4, 6, 8, 10]) put("hard" + n, P.hardAmt, "hard " + n);
    }
  }
  s.note = skipped.length ? "Pattern skipped " + skipped.join(", ") + ": not enough credits." : "";
  return skipped;
}

/** Drop every wager, including contract bets, and put the seat back on the starting bankroll. */
export function restartBankroll(s: Seat, bank = 100): void {
  s.bets = {};
  s.come = {};
  s.comeOdds = {};
  s.dontCome = {};
  s.dontComeOdds = {};
  s.placedSince = 0;
  s.pays = {};
  s.lastBets = {};
  s.bank = bank;
  s.hi = bank;
  s.lo = bank;
  s.last = 0;
  s.lastWin = 0;
  s.combo = 0;
  s.ticket = null;
  s.ledger = emptyLedger();
  s.banner = "";
  s.note = "Restarted at " + money(bank) + ". Roll history stays.";
}

/** Clear the puck and every bet. Roll history is left in place. */
export function restartTable(table: Table): void {
  table.point = null;
  table.pointsMade = 0;
  table.hand = 0;
  table.passShooter = false;
  table.celebration = null;
  table.flash = "";
  for (const s of table.seats) restartBankroll(s, 100);
  table.call = "Table reset. Point off. History kept.";
}

export function clearBets(s: Seat, point: number | null): string {
  let back = 0;
  for (const k of Object.keys(s.bets)) {
    if ((k === "pass" || k === "dont") && point !== null) continue;
    back = r2(back + (s.bets[k] || 0));
    giveBack(s, s.bets[k] || 0);
    delete s.bets[k];
  }
  for (const ks of Object.keys(s.comeOdds)) {
    const n = Number(ks);
    back = r2(back + (s.comeOdds[n] || 0));
    giveBack(s, s.comeOdds[n] || 0);
    delete s.comeOdds[n];
  }
  for (const ks of Object.keys(s.dontComeOdds)) {
    const n = Number(ks);
    back = r2(back + (s.dontComeOdds[n] || 0));
    giveBack(s, s.dontComeOdds[n] || 0);
    delete s.dontComeOdds[n];
  }
  if (s.pattern.on) s.note = "Your pattern is on, so empty spots refill next betting window.";
  return back ? "Cleared " + money(back) + " back to credits." : "Nothing to clear. Contract bets stay up.";
}

export function repeatBets(s: Seat, point: number | null): string {
  let added = 0;
  const last: Bets = s.lastBets || {};
  for (const k of Object.keys(last)) {
    let diff = r2(last[k] - (s.bets[k] || 0));
    if (diff <= 0) continue;
    if ((k === "pass" || k === "dont") && point !== null) continue;
    if ((k === "come" || k === "dontCome") && point === null) continue;
    if (k === "odds") {
      if (point === null || !s.bets.pass) continue;
      diff = Math.min(diff, r2(MAX_ODDS_X * s.bets.pass - (s.bets.odds || 0)));
      if (diff <= 0) continue;
    }
    if (k === "dontOdds") {
      if (point === null || !s.bets.dont) continue;
      diff = Math.min(diff, r2(MAX_ODDS_X * s.bets.dont - (s.bets.dontOdds || 0)));
      if (diff <= 0) continue;
    }
    if (addBet(s, k, diff)) added = r2(added + diff);
  }
  return added ? "Repeated bets: " + money(added) + "." : "Nothing to repeat. Bets that are still up were not charged again.";
}

export function insertBill(s: Seat, amt: number): void {
  s.bank = r2(s.bank + amt);
  trackHiLo(s);
}

/** Releases under this are a no-roll. The dice are not generated and nothing settles. */
export const SHORT_THROW = 0.2;
export const METER_PERIOD_MS = 1300;

/** Triangle wave, 0 → 1 → 0, while Shift or Space is held. */
export function oscillatingPower(startMs: number, nowMs: number): number {
  const tri = (((nowMs - startMs) % METER_PERIOD_MS) + METER_PERIOD_MS) % METER_PERIOD_MS;
  const u = tri / METER_PERIOD_MS;
  const up = u < 0.5 ? u * 2 : 2 - u * 2;
  return Math.round(up * 1000) / 1000;
}

export function classifyRelease(power: number): "short" | "live" {
  if (!Number.isFinite(power) || power < SHORT_THROW) return "short";
  return "live";
}

/**
 * A short release. Point, dice, and every bank stay exactly as they were.
 * The shooter has to throw again.
 */
export function noteShortThrow(state: Table): Table {
  const next = structuredClone(state);
  next.call = "NO ROLL, SHORT THROW";
  next.noRollId = (state.noRollId || 0) + 1;
  next.pending = null;
  return next;
}

export function makeTicket(state: Table, kind: ThrowKind, power: number, angle: number, rng: () => number, seed = 1): RollTicket {
  const d1 = rng();
  const d2 = rng();
  if (!Number.isInteger(d1) || d1 < 1 || d1 > 6 || !Number.isInteger(d2) || d2 < 1 || d2 > 6) {
    throw new Error("Dice must be integers from 1 to 6");
  }
  const p = Math.min(1, Math.max(0.15, power));
  return {
    id: state.nextRoll,
    kind,
    d1,
    d2,
    point: state.point,
    power: p,
    angle: Number.isFinite(angle) ? angle : 0,
    seed: seed >>> 0,
    startedAt: 0,
    dur: Math.round(1600 + p * 900),
    from: state.rest.map((r) => ({ ...r })),
  };
}

export function rollDice(): [number, number] {
  return [d6(), d6()];
}

function clampHeat(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Guitar-Hero style hand heat. Box numbers and point-mades climb the meter.
 * A seven-out is the miss: heat and the streak both drop to zero.
 */
export function scoreHand(heat: number, streak: number, d1: number, d2: number, point: number | null): { heat: number; streak: number; kind: HeatKind } {
  const sum = d1 + d2;
  const hard = d1 === d2 && sum >= 4 && sum <= 10;
  if (point !== null && sum === 7) return { heat: 0, streak: 0, kind: "seven" };
  if (point !== null && sum === point) return { heat: clampHeat(heat + 24 + (hard ? 12 : 0)), streak: streak + 1, kind: "point" };
  if (point === null && (sum === 7 || sum === 11)) return { heat: clampHeat(heat + 16), streak: streak + 1, kind: "natural" };
  if (point === null && (sum === 2 || sum === 3 || sum === 12)) return { heat: clampHeat(heat * 0.6), streak: 0, kind: "craps" };
  if (NUMS.includes(sum)) return { heat: clampHeat(heat + 9 + (hard ? 10 : 0)), streak: streak + 1, kind: "hit" };
  return { heat: clampHeat(heat - 6), streak, kind: "cool" };
}

export function heatLabel(heat: number): string {
  if (heat >= 75) return "ON FIRE";
  if (heat >= 45) return "HOT";
  if (heat >= 18) return "WARM";
  return "COLD";
}

/**
 * Pay the table from the ticket alone.
 * `state.point`, `state.dice`, and `state.call` are ignored so a stale puck or a second random roll cannot change the result.
 */
export function finishRoll(state: Table, ticket: RollTicket): Table {
  const next = structuredClone(state);
  const point = ticket.point;
  const d1 = ticket.d1;
  const d2 = ticket.d2;
  const sum = d1 + d2;

  for (const seat of next.seats) {
    seat.lastBets = { ...seat.bets };
    const res = settleSeat(seat, d1, d2, point);
    const placed = r2(seat.placedSince);
    seat.ledger = {
      won: res.won,
      lost: res.lost,
      placed,
      returned: res.returned,
      net: r2(res.won - res.lost - placed),
    };
    seat.placedSince = 0;
    seat.last = r2(res.won - res.lost);
    seat.lastWin = res.won;
    seat.pays = res.pays;
    seat.combo = res.won > 0 ? seat.combo + 1 : res.lost > 0 ? 0 : seat.combo;
    seat.banner = formatLedger(seat.ledger);
    trackHiLo(seat);
  }

  const tableWon = r2(next.seats.reduce((sumWon, seat) => sumWon + seat.ledger.won, 0));
  const scored = scoreHand(state.heat || 0, state.streak || 0, d1, d2, point);
  next.heat = scored.heat;
  next.streak = scored.streak;

  const made = point !== null && sum === point;
  const sevenOut = point !== null && sum === 7;
  let nextPoint = point;
  if (point === null) {
    if (NUMS.includes(sum)) nextPoint = sum;
  } else if (made || sevenOut) {
    nextPoint = null;
  }

  next.hand += 1;
  if (sevenOut) {
    next.handLog = [next.hand, ...next.handLog].slice(0, 8);
    next.hand = 0;
    next.pointsMade = 0;
  } else if (made) {
    next.pointsMade += 1;
  }

  const hardHit = d1 === d2 && sum >= 4 && sum <= 10;
  next.point = nextPoint;
  next.dice = [d1, d2];
  next.call = machineCall(d1, d2, point);
  next.hist = [[d1, d2] as [number, number], ...next.hist].slice(0, 20);
  next.passShooter = sevenOut;
  next.phase = "result";
  next.roll = { ...ticket, d1, d2, point };
  const celebrate = scored.kind === "point" || scored.kind === "natural" || (scored.kind === "hit" && tableWon > 0);
  next.celebration = celebrate
    ? { id: (state.celebration?.id ?? 0) + 1, headline: "WINNER!", amount: tableWon, detail: machineCall(d1, d2, point) }
    : null;
  next.flash = sevenOut ? "seven" : hardHit && celebrate ? "hard" : celebrate ? "win" : "";
  if (next.flash) next.flashId += 1;
  next.pending = null;

  const anim = buildAnim(ticket.from, d1, d2, ticket.power, ticket.angle, ticket.seed || 1);
  next.rest = anim.map((p) => ({
    x: p.pts[p.pts.length - 1][0],
    y: p.pts[p.pts.length - 1][1],
    fx: p.fx,
    fy: p.fy,
    fz: p.fz,
  }));
  next.nextRoll = state.nextRoll + 1;
  return next;
}

export { d6 };
