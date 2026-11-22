import { describe, expect, it } from "vitest";
import { buildAnim, buildTableAnim, FACE_ROT } from "./dice";
import {
  addBuyUnit,
  applyPattern,
  blankFace,
  buyProfit,
  createSeat,
  createTable,
  defaultPattern,
  equity,
  classifyRelease,
  finishRoll,
  formatLedger,
  heatLabel,
  noteShortThrow,
  oscillatingPower,
  layProfit,
  offMarker,
  machineCall,
  makeTicket,
  maxOdds2x,
  MAX_ODDS_X,
  placeChip,
  r2,
  trueProfit,
} from "./engine";
import type { RollTicket, Seat, Table, ThrowKind } from "./types";

function makeSeat(bank = 100): Seat {
  return createSeat({
    id: "p0",
    name: "You",
    color: "#FFD400",
    letter: "A",
    face: blankFace(),
    bank,
    pattern: { ...defaultPattern(), on: false },
  });
}

function makeTable(point: number | null = null, s: Seat = makeSeat()): Table {
  const t = createTable("test", [s]);
  t.point = point;
  return t;
}

function queue(...ns: number[]): () => number {
  const left = [...ns];
  return () => {
    const v = left.shift();
    if (v === undefined) throw new Error("rng exhausted");
    return v;
  };
}

function arm(table: Table, kind: ThrowKind, d1: number, d2: number): RollTicket {
  return makeTicket(table, kind, 0.55, 0.2, queue(d1, d2), 7);
}

describe("buy commission and true odds", () => {
  it("charges 5% once on a winning buy and nothing on a miss", () => {
    expect(buyProfit(4, 20)).toBe(39);
    expect(buyProfit(10, 20)).toBe(39);
    expect(buyProfit(5, 20)).toBe(29);
    expect(buyProfit(6, 30)).toBe(r2(36 - 1.5));
    expect(trueProfit(6, 50)).toBe(60);
    expect(trueProfit(5, 20)).toBe(30);
    expect(layProfit(4, 20)).toBe(10);
    expect(layProfit(5, 30)).toBe(20);
    expect(layProfit(6, 30)).toBe(25);
    expect(MAX_ODDS_X).toBe(2);
  });
});

describe("credits on a scripted hit", () => {
  it("pays pass, 2x odds, and buy when the point is made, and does not charge them again", () => {
    const s = makeSeat(100);
    const t = makeTable(null, s);
    placeChip(s, "pass", 10, null);
    expect(s.bank).toBe(90);
    expect(equity(s)).toBe(100);

    const comeOut = finishRoll(t, arm(t, "button", 1, 3));
    expect(comeOut.dice).toEqual([1, 3]);
    expect(comeOut.point).toBe(4);
    expect(comeOut.call).toBe("Point is four.");
    expect(comeOut.seats[0].bets.pass).toBe(10);
    expect(comeOut.seats[0].bank).toBe(90);
    expect(comeOut.seats[0].ledger.won).toBe(0);
    expect(comeOut.seats[0].ledger.placed).toBe(10);
    expect(comeOut.seats[0].ledger.net).toBe(-10);

    const seated = comeOut.seats[0];
    placeChip(seated, "odds", 100, 4);
    placeChip(seated, "buy4", 20, 4);
    expect(seated.bets.odds).toBe(20);
    expect(seated.bets.buy4).toBe(20);
    expect(seated.bank).toBe(50);
    const placedBeforeHit = seated.placedSince;
    expect(placedBeforeHit).toBe(40);

    seated.pattern = { ...defaultPattern(), on: true };
    const snapshot = seated.bank;
    applyPattern(seated, 4);
    expect(seated.bets.buy4).toBe(20);
    expect(seated.bets.odds).toBe(20);
    expect(seated.bets.pass).toBe(10);
    const filled = seated.bank;
    expect(filled).toBeLessThan(snapshot);
    applyPattern(seated, 4);
    expect(seated.bank).toBe(filled);
    expect(seated.bets.buy4).toBe(20);
    expect(seated.bets.odds).toBe(20);

    const missed = finishRoll(comeOut, arm(comeOut, "flick", 2, 3));
    expect(missed.point).toBe(4);
    expect(missed.dice).toEqual([2, 3]);
    expect(missed.call).toBe("Five.");
    expect(missed.seats[0].bets.buy4).toBe(20);
    expect(missed.seats[0].bets.odds).toBe(20);
    expect(missed.seats[0].bets.buy5).toBe(10);
    expect(missed.seats[0].ledger.won).toBe(buyProfit(5, 10));
    expect(missed.seats[0].ledger.lost).toBe(0);
    expect(missed.seats[0].bank).toBe(r2(filled + buyProfit(5, 10)));

    const live = missed.seats[0];
    live.placedSince = 0;
    delete live.bets.buy5;
    delete live.bets.buy9;
    delete live.bets.buy10;
    delete live.bets.place6;
    delete live.bets.place8;
    delete live.bets.hard4;
    delete live.bets.hard6;
    delete live.bets.hard8;
    delete live.bets.hard10;
    live.bank = 50;
    const before = live.bank;
    const beforeEq = equity(live);
    const hit = finishRoll(missed, arm(missed, "button", 1, 3));
    const me = hit.seats[0];

    expect(hit.dice).toEqual([1, 3]);
    expect(hit.point).toBeNull();
    expect(hit.call).toBe("Four, winner!");
    expect(hit.passShooter).toBe(false);
    expect(me.bets.pass).toBe(10);
    expect(me.bets.buy4).toBe(20);
    expect(me.bets.odds).toBeUndefined();
    expect(me.ledger.won).toBe(10 + 40 + 39);
    expect(me.ledger.lost).toBe(0);
    expect(me.ledger.placed).toBe(0);
    expect(me.ledger.returned).toBe(20);
    expect(me.ledger.net).toBe(89);
    expect(me.bank).toBe(r2(before + 89 + 20));
    expect(equity(me)).toBe(r2(beforeEq + 89));
    expect(me.banner).toBe(formatLedger(me.ledger));
    expect(me.banner).toContain("✓ Won +$89");
    expect(me.banner).toContain("✗ Lost/placed −$0");
    expect(me.banner).toContain("Net +$89");

    const bankAfterWin = me.bank;
    me.pattern = { ...defaultPattern(), on: true, place: false, hard: false, buy: true, odds: true, line: true };
    applyPattern(me, null);
    expect(me.bank).toBe(bankAfterWin);
    expect(me.bets.pass).toBe(10);
    expect(me.bets.buy4).toBe(20);
    expect(me.placedSince).toBe(0);
  });

  it("keeps a winning place and hardway up and does not re-deduct on the next pattern or the next hit", () => {
    const s = makeSeat(100);
    placeChip(s, "place6", 12, 8);
    placeChip(s, "hard6", 1, 8);
    expect(s.bank).toBe(87);
    s.placedSince = 0;
    s.pattern = { ...defaultPattern(), on: true, line: false, odds: false, buy: false, place: true, placeAmt: 12, hard: true, hardAmt: 1 };
    const t = makeTable(8, s);

    applyPattern(s, 8);
    expect(s.bets.place6).toBe(12);
    expect(s.bets.hard6).toBe(1);
    expect(s.bank).toBe(84);
    const filled = s.bank;
    applyPattern(s, 8);
    expect(s.bank).toBe(filled);
    expect(s.bets.place6).toBe(12);
    expect(s.bets.hard6).toBe(1);

    const hit = finishRoll(t, arm(t, "bot", 3, 3));
    const me = hit.seats[0];
    expect(hit.call).toBe("Hard six.");
    expect(hit.point).toBe(8);
    expect(me.bets.place6).toBe(12);
    expect(me.bets.hard6).toBe(1);
    expect(me.ledger.won).toBe(r2(14 + 9));
    expect(me.ledger.placed).toBe(3);
    expect(me.ledger.lost).toBe(0);
    expect(me.ledger.net).toBe(20);
    expect(me.bank).toBe(r2(84 + 23));

    const bank = me.bank;
    applyPattern(me, 8);
    expect(me.bank).toBe(bank);
    expect(me.bets.place6).toBe(12);
    expect(me.bets.hard6).toBe(1);

    me.placedSince = 0;
    const again = finishRoll(hit, arm(hit, "timeout", 3, 3));
    expect(again.seats[0].bank).toBe(r2(bank + 23));
    expect(again.seats[0].bets.place6).toBe(12);
    expect(again.seats[0].bets.hard6).toBe(1);
    expect(again.seats[0].ledger.placed).toBe(0);
    expect(again.seats[0].ledger.net).toBe(23);
  });

  it("drops place, buy, and hardways on a seven and does not take the stake out of credits a second time", () => {
    const s = makeSeat(40);
    s.bets = { pass: 10, odds: 20, buy4: 20, place6: 12, hard6: 1 };
    s.placedSince = 0;
    const before = s.bank;
    const t = makeTable(4, s);
    const out = finishRoll(t, arm(t, "button", 3, 4));
    const me = out.seats[0];
    expect(out.call).toBe("Seven out.");
    expect(out.point).toBeNull();
    expect(out.passShooter).toBe(true);
    expect(me.bets.pass).toBeUndefined();
    expect(me.bets.odds).toBeUndefined();
    expect(me.bets.buy4).toBeUndefined();
    expect(me.bets.place6).toBeUndefined();
    expect(me.bets.hard6).toBeUndefined();
    expect(me.bank).toBe(before);
    expect(me.ledger.won).toBe(0);
    expect(me.ledger.lost).toBe(63);
    expect(me.ledger.placed).toBe(0);
    expect(me.ledger.net).toBe(-63);
    expect(equity(me)).toBe(r2(before));
  });
});

describe("2× odds", () => {
  it("caps a one-tap max at 2× and a second tap is free", () => {
    const s = makeSeat(200);
    s.bets.pass = 10;
    s.bets.dont = 15;
    s.come[6] = 10;
    s.dontCome[4] = 15;
    s.bank = 200;
    expect(maxOdds2x(s, 4)).toContain("Max odds");
    expect(s.bets.odds).toBe(20);
    expect(s.bets.dontOdds).toBe(30);
    expect(s.comeOdds[6]).toBe(20);
    expect(s.dontComeOdds[4]).toBe(30);
    expect(s.bank).toBe(200 - 20 - 30 - 20 - 30);
    const bank = s.bank;
    expect(maxOdds2x(s, 4)).toBe("Odds are already at 2×.");
    expect(s.bank).toBe(bank);
    expect(placeChip(s, "odds", 10, 4)).toBe("That's max odds (2×).");
    expect(s.bank).toBe(bank);
  });

  it("pays pass odds at true odds for 4, 5, and 6 and come-down the odds stake once", () => {
    const cases: Array<{ point: number; d1: number; d2: number; flat: number; odds: number; profit: number }> = [
      { point: 4, d1: 1, d2: 3, flat: 10, odds: 20, profit: 40 },
      { point: 5, d1: 2, d2: 3, flat: 10, odds: 20, profit: 30 },
      { point: 6, d1: 1, d2: 5, flat: 25, odds: 50, profit: 60 },
    ];
    for (const c of cases) {
      const s = makeSeat(0);
      s.bank = 0;
      s.bets = { pass: c.flat, odds: c.odds };
      const out = finishRoll(makeTable(c.point, s), arm(makeTable(c.point, s), "flick", c.d1, c.d2));
      const me = out.seats[0];
      expect(me.ledger.won).toBe(c.flat + c.profit);
      expect(me.ledger.returned).toBe(c.odds);
      expect(me.bank).toBe(c.flat + c.profit + c.odds);
      expect(me.bets.pass).toBe(c.flat);
      expect(me.bets.odds).toBeUndefined();
      expect(out.point).toBeNull();
    }
  });

  it("pays lay odds on don't pass and don't come, and come odds, at the inverse price", () => {
    const s = makeSeat(0);
    s.bets = { dont: 10, dontOdds: 20 };
    const seven = finishRoll(makeTable(4, s), arm(makeTable(4, s), "button", 3, 4));
    expect(seven.seats[0].ledger.won).toBe(10 + 10);
    expect(seven.seats[0].ledger.returned).toBe(20);
    expect(seven.seats[0].bets.dont).toBe(10);
    expect(seven.seats[0].bets.dontOdds).toBeUndefined();
    expect(seven.seats[0].bank).toBe(40);

    const layLose = makeSeat(70);
    layLose.bets = { dont: 10, dontOdds: 20 };
    const made = finishRoll(makeTable(4, layLose), arm(makeTable(4, layLose), "bot", 1, 3));
    expect(made.seats[0].bank).toBe(70);
    expect(made.seats[0].ledger.lost).toBe(30);
    expect(made.seats[0].bets.dont).toBeUndefined();

    const come = makeSeat(70);
    come.come = { 6: 10 };
    come.comeOdds = { 6: 20 };
    const paid = finishRoll(makeTable(9, come), arm(makeTable(9, come), "timeout", 1, 5));
    expect(paid.point).toBe(9);
    expect(paid.seats[0].ledger.won).toBe(10 + 24);
    expect(paid.seats[0].ledger.returned).toBe(30);
    expect(paid.seats[0].bank).toBe(70 + 10 + 24 + 30);
    expect(paid.seats[0].come[6]).toBeUndefined();
    expect(paid.seats[0].comeOdds[6]).toBeUndefined();

    const dc = makeSeat(55);
    dc.dontCome = { 4: 15 };
    dc.dontComeOdds = { 4: 30 };
    const lay = finishRoll(makeTable(9, dc), arm(makeTable(9, dc), "flick", 2, 5));
    expect(lay.seats[0].ledger.won).toBe(15 + 15);
    expect(lay.seats[0].ledger.returned).toBe(15 + 30);
    expect(lay.seats[0].bank).toBe(55 + 15 + 15 + 45);
    expect(lay.seats[0].dontCome[4]).toBeUndefined();
  });

  it("leaves odds off on the come-out unless the player toggled them on", () => {
    const off = makeSeat(70);
    off.come = { 4: 10 };
    off.comeOdds = { 4: 20 };
    off.oddsOnComeout = false;
    const returned = finishRoll(makeTable(null, off), arm(makeTable(null, off), "button", 1, 3));
    expect(returned.call).toBe("Point is four.");
    expect(returned.seats[0].ledger.won).toBe(10);
    expect(returned.seats[0].ledger.returned).toBe(30);
    expect(returned.seats[0].bank).toBe(110);
    expect(returned.seats[0].comeOdds[4]).toBeUndefined();

    const lost = makeSeat(70);
    lost.come = { 4: 10 };
    lost.comeOdds = { 4: 20 };
    lost.oddsOnComeout = false;
    const seven = finishRoll(makeTable(null, lost), arm(makeTable(null, lost), "button", 3, 4));
    expect(seven.call).toBe("Seven, winner!");
    expect(seven.seats[0].ledger.lost).toBe(10);
    expect(seven.seats[0].ledger.returned).toBe(20);
    expect(seven.seats[0].bank).toBe(90);

    const on = makeSeat(70);
    on.come = { 4: 10 };
    on.comeOdds = { 4: 20 };
    on.oddsOnComeout = true;
    const paid = finishRoll(makeTable(null, on), arm(makeTable(null, on), "flick", 1, 3));
    expect(paid.seats[0].ledger.won).toBe(50);
    expect(paid.seats[0].bank).toBe(150);

    const workingSeven = makeSeat(70);
    workingSeven.come = { 4: 10 };
    workingSeven.comeOdds = { 4: 20 };
    workingSeven.oddsOnComeout = true;
    const burned = finishRoll(makeTable(null, workingSeven), arm(makeTable(null, workingSeven), "bot", 3, 4));
    expect(burned.seats[0].ledger.lost).toBe(30);
    expect(burned.seats[0].ledger.returned).toBe(0);
    expect(burned.seats[0].bank).toBe(70);
  });
});

describe("the ticket is the only roll", () => {
  it("pays the ticket's dice and point even if the table puck and dice were overwritten", () => {
    const s = makeSeat(50);
    s.bets = { pass: 10, odds: 20, buy4: 20 };
    const t = makeTable(4, s);
    const ticket = arm(t, "flick", 1, 3);
    expect(ticket.point).toBe(4);
    expect(ticket.d1).toBe(1);
    expect(ticket.d2).toBe(3);

    const poisoned = structuredClone(t);
    poisoned.point = 6;
    poisoned.dice = [3, 3];
    poisoned.call = "Six, winner!";
    const out = finishRoll(poisoned, ticket);
    expect(out.call).toBe("Four, winner!");
    expect(out.call.toLowerCase()).not.toContain("six");
    expect(out.dice).toEqual([1, 3]);
    expect(out.point).toBeNull();
    expect(out.seats[0].ledger.won).toBe(89);
    expect(out.seats[0].bets.buy4).toBe(20);
    expect(out.seats[0].bank).toBe(50 + 89 + 20);
  });

  it("settles every throw path from the same dice", () => {
    const kinds: ThrowKind[] = ["flick", "button", "bot", "timeout"];
    const banks: number[] = [];
    const calls: string[] = [];
    for (const kind of kinds) {
      let callsToRng = 0;
      const s = makeSeat(50);
      s.bets = { pass: 10, odds: 20, buy4: 20 };
      const t = makeTable(4, s);
      const ticket = makeTicket(
        t,
        kind,
        kind === "flick" ? 0.95 : 0.4,
        1.1,
        () => {
          callsToRng += 1;
          return callsToRng;
        },
        3,
      );
      expect(callsToRng).toBe(2);
      expect(ticket.kind).toBe(kind);
      expect(ticket.d1).toBe(1);
      expect(ticket.d2).toBe(2);
      expect(ticket.point).toBe(4);
      const out = finishRoll(t, ticket);
      expect(out.call).toBe(machineCall(1, 2, 4));
      expect(out.call).toBe("Three.");
      expect(out.point).toBe(4);
      expect(out.dice).toEqual([1, 2]);
      expect(out.seats[0].bets.pass).toBe(10);
      expect(out.seats[0].bets.odds).toBe(20);
      expect(out.seats[0].bets.buy4).toBe(20);
      expect(out.seats[0].ledger.won).toBe(0);
      banks.push(out.seats[0].bank);
      calls.push(out.call);
    }
    expect(new Set(banks).size).toBe(1);
    expect(new Set(calls).size).toBe(1);
  });

  it("callouts name the dice that were thrown, for every face and every point", () => {
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        const sum = d1 + d2;
        for (const point of [null, 4, 5, 6, 8, 9, 10] as Array<number | null>) {
          const call = machineCall(d1, d2, point);
          expect(call.toLowerCase()).toContain(
            sum === 2 ? "aces" : sum === 12 && point === null ? "twelve" : sum === 3 && point !== null ? "three" : requireName(sum),
          );
          if (point === null && sum === 7) expect(call).toBe("Seven, winner!");
          if (point === null && sum === 11) expect(call).toBe("Yo eleven, winner!");
          if (point === null && [4, 5, 6, 8, 9, 10].includes(sum)) expect(call.toLowerCase()).toContain(`point is ${nameOf(sum)}`);
          if (point !== null && sum === point) expect(call.toLowerCase()).toContain("winner");
          if (point !== null && sum === 7) expect(call).toBe("Seven out.");

          const s = makeSeat();
          const t = makeTable(point, s);
          const out = finishRoll(t, arm(t, "button", d1, d2));
          expect(out.call).toBe(call);
          expect(out.dice).toEqual([d1, d2]);
          if (point === null && [4, 5, 6, 8, 9, 10].includes(sum)) expect(out.point).toBe(sum);
          else if (point === null) expect(out.point).toBeNull();
          else if (sum === point || sum === 7) expect(out.point).toBeNull();
          else expect(out.point).toBe(point);
          expect(out.passShooter).toBe(point !== null && sum === 7);
        }
      }
    }
  });

  it("draws the die faces from the ticket, not from another random roll", () => {
    const anim = buildAnim(
      [
        { x: 132, y: 238, fx: 0, fy: 0, fz: 0 },
        { x: 180, y: 238, fx: 0, fy: 0, fz: 0 },
      ],
      1,
      3,
      0.8,
      -0.4,
      99,
    );
    expect(anim[0].fx).toBe(FACE_ROT[1][0]);
    expect(anim[0].fy).toBe(FACE_ROT[1][1]);
    expect(anim[1].fx).toBe(FACE_ROT[3][0]);
    expect(anim[1].fy).toBe(FACE_ROT[3][1]);
    const again = buildAnim(
      [
        { x: 132, y: 238, fx: 0, fy: 0, fz: 0 },
        { x: 180, y: 238, fx: 0, fy: 0, fz: 0 },
      ],
      1,
      3,
      0.8,
      -0.4,
      99,
    );
    expect(again[0].pts).toEqual(anim[0].pts);
    expect(again[1].pts).toEqual(anim[1].pts);
  });
});

describe("oscillating release", () => {
  it("waves the power meter up and down and rejects a short release with no settlement", () => {
    expect(oscillatingPower(0, 0)).toBe(0);
    expect(oscillatingPower(0, 325)).toBeGreaterThan(0.45);
    expect(oscillatingPower(0, 650)).toBe(1);
    expect(oscillatingPower(0, 975)).toBeLessThan(0.55);
    expect(oscillatingPower(0, 1300)).toBe(0);
    expect(classifyRelease(0.19)).toBe("short");
    expect(classifyRelease(0.2)).toBe("live");
    expect(classifyRelease(1)).toBe("live");

    const s = makeSeat(50);
    s.bets = { pass: 10, odds: 20, buy4: 20 };
    const t = makeTable(4, s);
    const bank = s.bank;
    const after = noteShortThrow(t);
    expect(after.call).toBe("NO ROLL, SHORT THROW");
    expect(after.noRollId).toBe(1);
    expect(after.phase).toBe(t.phase);
    expect(after.point).toBe(4);
    expect(after.dice).toEqual(t.dice);
    expect(after.seats[0].bank).toBe(bank);
    expect(after.seats[0].bets.odds).toBe(20);
    expect(after.seats[0].bets.buy4).toBe(20);
    expect(after.heat).toBe(t.heat);
    expect(after.streak).toBe(t.streak);
  });

  it("lets power change the felt path and not the dice or the payout", () => {
    const s = makeSeat(50);
    s.bets = { pass: 10, odds: 20, buy4: 20 };
    const t = makeTable(4, s);
    const soft = makeTicket(t, "button", 0.22, 0, queue(1, 3), 9);
    const hard = makeTicket(structuredClone(t), "button", 0.95, 0, queue(1, 3), 9);
    expect(soft.d1).toBe(1);
    expect(hard.d1).toBe(1);
    expect(soft.d2).toBe(hard.d2);
    expect(soft.power).toBeLessThan(hard.power);
    const a = finishRoll(t, soft);
    const b = finishRoll(structuredClone(t), hard);
    expect(a.call).toBe(b.call);
    expect(a.point).toBe(b.point);
    expect(a.seats[0].bank).toBe(b.seats[0].bank);
    expect(a.celebration?.amount).toBe(b.celebration?.amount);

    const feltHard = buildTableAnim(hard.power, hard.seed, hard.d1, hard.d2);
    const feltSoft = buildTableAnim(soft.power, soft.seed, soft.d1, soft.d2);
    expect(feltHard.dice[0].face).toBe(1);
    expect(feltHard.dice[1].face).toBe(3);
    expect(feltSoft.dice[0].face).toBe(1);
    expect(Math.min(...feltHard.dice[0].frames.map((f) => f.y))).toBeLessThan(0.08);
    expect(feltHard.dice[0].frames.some((f) => f.bounce)).toBe(true);
    expect(feltHard.dice[0].frames.map((f) => f.y)).not.toEqual(feltSoft.dice[0].frames.map((f) => f.y));
    const again = buildTableAnim(hard.power, hard.seed, hard.d1, hard.d2);
    expect(again.dice[0].frames).toEqual(feltHard.dice[0].frames);
  });
});

describe("heat and the shared winner celebration", () => {
  it("climbs on consecutive hits, pays a synced WINNER amount, and resets on seven-out", () => {
    const a = makeSeat(80);
    const b = makeSeat(80);
    b.id = "p1";
    a.bets = { pass: 10, place6: 12 };
    b.bets = { pass: 10, place6: 12 };
    let t = createTable("heat", [a, b]);
    t.point = 8;

    t = finishRoll(t, arm(t, "button", 1, 5));
    expect(t.streak).toBe(1);
    expect(t.heat).toBeGreaterThan(0);
    expect(t.celebration?.headline).toBe("WINNER!");
    expect(t.celebration?.amount).toBe(r2(14 + 14));
    expect(t.celebration?.detail).toBe("Six.");
    expect(t.seats[0].bets.place6).toBe(12);
    expect(t.seats[1].bets.place6).toBe(12);
    const heatAfterHit = t.heat;
    const id = t.celebration?.id ?? 0;

    t = finishRoll(t, arm(t, "flick", 4, 4));
    expect(t.call).toBe("Hard eight, winner!");
    expect(t.streak).toBe(2);
    expect(t.heat).toBeGreaterThan(heatAfterHit);
    expect(t.celebration?.id).toBe(id + 1);
    expect(t.celebration?.headline).toBe("WINNER!");
    expect(t.celebration?.amount).toBe(r2(10 + 10));
    expect(t.point).toBeNull();
    expect(heatLabel(t.heat)).not.toBe("");

    t = finishRoll(t, arm(t, "bot", 3, 4));
    expect(t.call).toBe("Seven, winner!");
    expect(t.streak).toBe(3);
    expect(t.celebration?.headline).toBe("WINNER!");

    const hot = t.heat;
    t.point = 6;
    t = finishRoll(t, arm(t, "timeout", 2, 5));
    expect(t.call).toBe("Seven out.");
    expect(t.heat).toBe(0);
    expect(t.streak).toBe(0);
    expect(t.celebration).toBeNull();
    expect(t.passShooter).toBe(true);
    expect(hot).toBeGreaterThan(0);
    expect(heatLabel(0)).toBe("COLD");
  });
});

describe("per-player bets off", () => {
  it("leaves place, buy, hardways, and odds on the layout while the pass flat still wins", () => {
    const s = makeSeat(50);
    s.betsOff = true;
    s.bets = { pass: 10, odds: 20, buy4: 20, place6: 12, hard8: 1 };
    const out = finishRoll(makeTable(4, s), arm(makeTable(4, s), "button", 1, 3));
    const me = out.seats[0];
    expect(out.call).toBe("Four, winner!");
    expect(out.point).toBeNull();
    expect(me.ledger.won).toBe(10);
    expect(me.ledger.lost).toBe(0);
    expect(me.ledger.returned).toBe(0);
    expect(me.bank).toBe(60);
    expect(me.bets.pass).toBe(10);
    expect(me.bets.odds).toBe(20);
    expect(me.bets.buy4).toBe(20);
    expect(me.bets.place6).toBe(12);
    expect(me.bets.hard8).toBe(1);
    expect(offMarker(me, "odds", out.point)).toBe("OFF");
    expect(offMarker(me, "buy4", out.point)).toBe("OFF");
    expect(offMarker(me, "place6", out.point)).toBe("OFF");
    expect(offMarker(me, "hard8", out.point)).toBe("OFF");
    expect(offMarker(me, "pass", out.point)).toBe("");
  });

  it("on a seven-out, drops only the pass flat and gives odds stake back without paying place or buy", () => {
    const s = makeSeat(50);
    s.betsOff = true;
    s.bets = { pass: 10, odds: 20, buy4: 20, hard4: 5 };
    const out = finishRoll(makeTable(4, s), arm(makeTable(4, s), "flick", 3, 4));
    const me = out.seats[0];
    expect(out.call).toBe("Seven out.");
    expect(me.bets.pass).toBeUndefined();
    expect(me.bets.odds).toBeUndefined();
    expect(me.bets.buy4).toBe(20);
    expect(me.bets.hard4).toBe(5);
    expect(me.ledger.won).toBe(0);
    expect(me.ledger.lost).toBe(10);
    expect(me.ledger.returned).toBe(20);
    expect(me.bank).toBe(70);
    expect(offMarker(me, "buy4", null)).toBe("OFF");
  });

  it("pays a come flat and does not pay or take the come odds", () => {
    const s = makeSeat(70);
    s.betsOff = true;
    s.come = { 6: 10 };
    s.comeOdds = { 6: 20 };
    const out = finishRoll(makeTable(9, s), arm(makeTable(9, s), "bot", 1, 5));
    const me = out.seats[0];
    expect(me.ledger.won).toBe(10);
    expect(me.ledger.lost).toBe(0);
    expect(me.ledger.returned).toBe(30);
    expect(me.bank).toBe(110);
    expect(me.come[6]).toBeUndefined();
    expect(me.comeOdds[6]).toBeUndefined();
    expect(out.point).toBe(9);
  });

  it("keeps come odds sitting when the come number is not rolled", () => {
    const s = makeSeat(70);
    s.betsOff = true;
    s.come = { 6: 10 };
    s.comeOdds = { 6: 20 };
    s.bets = { place6: 12 };
    const out = finishRoll(makeTable(9, s), arm(makeTable(9, s), "timeout", 2, 3));
    const me = out.seats[0];
    expect(me.bank).toBe(70);
    expect(me.come[6]).toBe(10);
    expect(me.comeOdds[6]).toBe(20);
    expect(me.bets.place6).toBe(12);
    expect(me.ledger.won).toBe(0);
    expect(me.ledger.lost).toBe(0);
    expect(offMarker(me, "comeOdds6", 9)).toBe("OFF");
    expect(offMarker(me, "pass", 9)).toBe("");
  });

  it("is per player: the same roll pays the seat that left bets working", () => {
    const off = makeSeat(50);
    off.id = "off";
    off.betsOff = true;
    off.bets = { pass: 10, odds: 20, buy4: 20 };
    const on = makeSeat(50);
    on.id = "on";
    on.betsOff = false;
    on.bets = { pass: 10, odds: 20, buy4: 20 };
    const t = createTable("test", [off, on]);
    t.point = 4;
    const out = finishRoll(t, arm(t, "button", 1, 3));
    expect(out.seats[0].bank).toBe(60);
    expect(out.seats[0].bets.odds).toBe(20);
    expect(out.seats[0].bets.buy4).toBe(20);
    expect(out.seats[0].ledger.won).toBe(10);
    expect(out.seats[1].ledger.won).toBe(89);
    expect(out.seats[1].bets.odds).toBeUndefined();
    expect(out.seats[1].bets.buy4).toBe(20);
    expect(out.seats[1].bank).toBe(50 + 89 + 20);
    expect(offMarker(out.seats[0], "odds", null)).toBe("OFF");
    expect(offMarker(out.seats[1], "buy4", null)).toBe("OFF");
    expect(offMarker(out.seats[1], "odds", 4)).toBe("");
  });
});

describe("buy hotkey units", () => {
  it("adds the selected chip again without resetting the bet", () => {
    const s = makeSeat(100);
    expect(addBuyUnit(s, 6, 10, null)).toContain("buy 6");
    expect(s.bets.buy6).toBe(10);
    expect(s.bank).toBe(90);
    addBuyUnit(s, 6, 10, null);
    expect(s.bets.buy6).toBe(20);
    expect(s.bank).toBe(80);
    addBuyUnit(s, 10, 5, 6);
    expect(s.bets.buy10).toBe(10);
    expect(s.bank).toBe(70);
    s.placedSince = 0;
    const t = makeTable(6, s);
    const out = finishRoll(t, arm(t, "button", 4, 6));
    expect(out.seats[0].bets.buy10).toBe(10);
    expect(out.seats[0].ledger.won).toBe(buyProfit(10, 10));
    expect(out.seats[0].ledger.placed).toBe(0);
    expect(out.seats[0].bank).toBe(r2(70 + buyProfit(10, 10)));
  });
});

function nameOf(sum: number): string {
  return ["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][sum];
}

function requireName(sum: number): string {
  if (sum === 2) return "aces";
  if (sum === 12) return "twelve";
  return nameOf(sum);
}
