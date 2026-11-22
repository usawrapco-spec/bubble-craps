import Peer, { type DataConnection } from "peerjs";
import { botLine, botWager, faceForName, fillAsBot, makeRing } from "../game/bots";
import {
  addBuyUnit,
  applyPattern,
  canBet,
  canThrow,
  classifyRelease,
  clearBets,
  createTable,
  restartBankroll,
  restartTable,
  d6,
  defaultPattern,
  finishRoll,
  insertBill,
  makeTicket,
  maxOdds2x,
  noteShortThrow,
  placeChip,
  repeatBets,
} from "../game/engine";
import type { Pattern, Seat, Table, ThrowKind } from "../game/types";

export type ClientMsg =
  | { t: "join"; name: string; pattern: Pattern }
  | { t: "bet"; key: string; amt: number; takeDown: boolean }
  | { t: "buy"; n: number; amt: number }
  | { t: "clear" }
  | { t: "repeat" }
  | { t: "insert"; amt: number }
  | { t: "cashout" }
  | { t: "restart" }
  | { t: "restartTable" }
  | { t: "ackTicket" }
  | { t: "pattern"; pattern: Pattern }
  | { t: "oddsFlag"; on: boolean }
  | { t: "betsOff"; on: boolean }
  | { t: "maxOdds" }
  | { t: "throw"; kind: "button" | "flick"; power: number; angle: number }
  | { t: "chat"; text: string }
  | { t: "timer"; sec: number }
  | { t: "pause" }
  | { t: "resume" };

export type ServerMsg =
  | { t: "welcome"; seatId: string; state: Table }
  | { t: "state"; state: Table }
  | { t: "full" }
  | { t: "bye"; reason: string };

const APPROACH = 1100;
const RETURN = 900;
const RESULT = 2800;

export function roomCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(5);
  crypto.getRandomValues(buf);
  let s = "bc";
  for (let i = 0; i < 5; i++) s += alphabet[buf[i] % alphabet.length];
  return s;
}

function seed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] || 1;
}

function cleanName(name: string): string {
  const n = name.replace(/[<>]/g, "").trim().slice(0, 16);
  return n || "Player";
}

export function cleanPattern(p: Pattern | undefined): Pattern {
  const d = defaultPattern();
  if (!p) return d;
  const num = (v: number, lo: number, hi: number, fallback: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, Math.round(n)));
  };
  return {
    on: !!p.on,
    line: !!p.line,
    lineAmt: num(p.lineAmt, 10, 100, d.lineAmt),
    odds: !!p.odds,
    oddsX: Math.min(2, Math.max(1, Math.round(Number(p.oddsX) || 2))),
    buy: !!p.buy,
    buyAmt: num(p.buyAmt, 10, 200, d.buyAmt),
    place: !!p.place,
    placeAmt: num(p.placeAmt, 12, 120, d.placeAmt),
    hard: !!p.hard,
    hardAmt: num(p.hardAmt, 1, 25, d.hardAmt),
  };
}

export class Authority {
  table: Table;
  readonly hostSeatId = "p0";
  private peer: Peer | null = null;
  private conns = new Map<string, DataConnection>();
  private byConn = new Map<DataConnection, string>();
  private timer = 0;
  private lastBeat = 0;
  private retries = 0;
  private onChange: (table: Table) => void;
  private onRoom: (id: string) => void;
  private onError: (msg: string) => void;

  constructor(hostName: string, pattern: Pattern, onChange: (table: Table) => void, onRoom: (id: string) => void, onError: (msg: string) => void) {
    const code = roomCode();
    this.table = createTable(code, makeRing(cleanName(hostName), cleanPattern(pattern)));
    this.onChange = onChange;
    this.onRoom = onRoom;
    this.onError = onError;
    this.openBetting();
    this.timer = window.setInterval(() => this.tick(), 100);
    this.connect(code);
  }

  destroy(): void {
    window.clearInterval(this.timer);
    const msg: ServerMsg = { t: "bye", reason: "The host closed the table." };
    for (const c of this.conns.values()) if (c.open) c.send(msg);
    this.peer?.destroy();
    this.peer = null;
  }

  act(seatId: string, msg: ClientMsg): void {
    const seat = this.table.seats.find((s) => s.id === seatId);
    if (!seat || seat.isBot) return;
    const phase = this.table.phase;
    if (msg.t === "throw") {
      this.release(seatId, msg.kind, msg.power);
      return;
    }
    if (msg.t === "chat") {
      const text = msg.text.replace(/\s+/g, " ").trim().slice(0, 80);
      if (!text) return;
      this.say(seat, text);
      this.publish();
      return;
    }
    if (msg.t === "insert") {
      const amt = msg.amt === 20 ? 20 : 100;
      insertBill(seat, amt);
      seat.note = "Bill accepted. Play money only.";
      this.publish();
      return;
    }
    if (msg.t === "ackTicket") {
      seat.ticket = null;
      this.publish();
      return;
    }
    if (msg.t === "pattern") {
      seat.pattern = cleanPattern(msg.pattern);
      if (canBet(phase)) applyPattern(seat, this.table.point);
      this.publish();
      return;
    }
    if (msg.t === "oddsFlag") {
      seat.oddsOnComeout = !!msg.on;
      this.publish();
      return;
    }
    if (msg.t === "betsOff") {
      seat.betsOff = !!msg.on;
      seat.note = seat.betsOff ? "Bets OFF. Pass and come still work." : "Bets working.";
      this.publish();
      return;
    }
    if (msg.t === "restart" || msg.t === "restartTable") {
      if (!canBet(phase)) {
        seat.note = "Wait for the betting window to restart.";
        this.publish();
        return;
      }
      if (msg.t === "restartTable") {
        if (seatId !== this.hostSeatId) return;
        const hist = this.table.hist;
        restartTable(this.table);
        this.table.hist = hist;
        this.publish();
        return;
      }
      restartBankroll(seat, 100);
      this.publish();
      return;
    }
    if (msg.t === "timer" || msg.t === "pause" || msg.t === "resume") {
      if (seatId !== this.hostSeatId) return;
      if (msg.t === "timer" && (msg.sec === 10 || msg.sec === 15 || msg.sec === 20)) {
        this.table.betLen = msg.sec;
        if (phase === "betting") {
          const left = Math.max(1000, Math.min(Math.max(0, this.table.cdEnd - Date.now()), msg.sec * 1000));
          this.table.cdDur = msg.sec * 1000;
          this.table.cdEnd = Date.now() + left;
        }
      }
      if (msg.t === "pause" && phase === "betting") {
        this.table.running = false;
        this.table.phase = "paused";
        this.table.cdEnd = 0;
        this.table.call = "Paused. Bets open.";
      }
      if (msg.t === "resume") {
        this.table.running = true;
        if (this.table.phase === "paused") this.openBetting();
      }
      this.publish();
      return;
    }
    if (!canBet(phase)) {
      seat.note = "No more bets.";
      this.publish();
      return;
    }
    if (msg.t === "bet") seat.note = placeChip(seat, msg.key, msg.amt, this.table.point, msg.takeDown);
    else if (msg.t === "buy") seat.note = addBuyUnit(seat, msg.n, msg.amt, this.table.point);
    else if (msg.t === "clear") seat.note = clearBets(seat, this.table.point);
    else if (msg.t === "repeat") seat.note = repeatBets(seat, this.table.point);
    else if (msg.t === "maxOdds") seat.note = maxOdds2x(seat, this.table.point);
    else if (msg.t === "cashout") {
      clearBets(seat, this.table.point);
      const amt = seat.bank;
      seat.bank = 0;
      seat.ticket = { amt, id: String(100000 + Math.floor(Math.random() * 900000)), time: new Date().toLocaleString() };
      seat.note = "Voucher printed. Play money — no cash value.";
    }
    this.publish();
  }

  private connect(room: string): void {
    this.table.room = room;
    this.peer?.destroy();
    this.peer = new Peer(room);
    this.peer.on("open", (id) => this.onRoom(id));
    this.peer.on("connection", (conn) => this.accept(conn));
    this.peer.on("error", (err) => {
      if (err.type === "unavailable-id" && this.retries < 4) {
        this.retries += 1;
        this.connect(roomCode());
        return;
      }
      this.onError(err.message || "Could not reach the PeerJS broker.");
    });
  }

  private accept(conn: DataConnection): void {
    conn.on("data", (raw) => {
      const msg = raw as ClientMsg;
      const known = this.byConn.get(conn);
      if (!known) {
        if (!msg || msg.t !== "join") return;
        const seat = this.table.seats.find((s) => s.isBot);
        if (!seat) {
          conn.send({ t: "full" } satisfies ServerMsg);
          conn.close();
          return;
        }
        this.seatHuman(seat, msg.name, msg.pattern);
        this.byConn.set(conn, seat.id);
        this.conns.set(seat.id, conn);
        conn.send({ t: "welcome", seatId: seat.id, state: this.snapshot() } satisfies ServerMsg);
        this.say(seat, "I'm in.");
        this.publish();
        return;
      }
      this.act(known, msg);
    });
    conn.on("close", () => this.drop(conn));
    conn.on("error", () => this.drop(conn));
  }

  private drop(conn: DataConnection): void {
    const id = this.byConn.get(conn);
    if (!id) return;
    this.byConn.delete(conn);
    this.conns.delete(id);
    const index = this.table.seats.findIndex((s) => s.id === id);
    const seat = index >= 0 ? this.table.seats[index] : undefined;
    if (!seat || index < 0) return;
    fillAsBot(seat, index);
    if (this.table.phase === "awaiting" && this.table.shooter === index) this.table.awaitUntil = Date.now() + APPROACH + 700;
    this.say(seat, "takes the open seat.");
    this.publish();
  }

  private seatHuman(seat: Seat, name: string, pattern: Pattern): void {
    const clean = cleanName(name);
    seat.name = clean;
    seat.face = faceForName(clean);
    seat.bank = 100;
    seat.rebuy = 0;
    seat.isBot = false;
    seat.bets = {};
    seat.come = {};
    seat.comeOdds = {};
    seat.dontCome = {};
    seat.dontComeOdds = {};
    seat.pattern = cleanPattern(pattern);
    seat.betsOff = false;
    seat.oddsOnComeout = false;
    seat.placedSince = 0;
    seat.ticket = null;
    seat.hi = 100;
    seat.lo = 100;
    seat.note = "";
    seat.pays = {};
  }

  private release(seatId: string, kind: ThrowKind, power: number): void {
    const index = this.table.seats.findIndex((s) => s.id === seatId);
    if (index !== this.table.shooter) return;
    if (!canThrow(this.table.phase)) return;
    const p = Math.max(0, Math.min(1, Number(power) || 0));
    if (classifyRelease(p) === "short") {
      this.table = noteShortThrow(this.table);
      if (this.table.phase === "awaiting") this.table.awaitUntil = Date.now() + 12000;
      this.publish();
      return;
    }
    this.beginRoll(kind === "flick" ? "flick" : "button", p);
  }

  private beginRoll(kind: ThrowKind, power: number): void {
    if (!canThrow(this.table.phase)) return;
    const ticket = makeTicket(this.table, kind, power, (power - 0.5) * 1.1, d6, seed());
    ticket.startedAt = Date.now();
    this.table.phase = "rolling";
    this.table.roll = ticket;
    this.table.pending = null;
    this.table.cdEnd = 0;
    this.table.walk = { phase: "atBubble", seat: this.table.shooter, startedAt: Date.now() };
    this.table.call = power > 0.85 ? "Monster pop!" : power > 0.55 ? "Air pop!" : "Soft pop.";
    this.publish();
  }

  private settle(): void {
    const ticket = this.table.roll;
    if (!ticket || this.table.phase !== "rolling") return;
    this.table = finishRoll(this.table, ticket);
    this.table.resultUntil = Date.now() + RESULT;
    this.quips();
    this.publish();
  }

  private quips(): void {
    const seven = this.table.call === "Seven out.";
    const win = !!this.table.celebration;
    const hard = this.table.call.toLowerCase().includes("hard");
    const kind = seven ? "seven" : hard ? "hard" : win ? "win" : "point";
    let said = 0;
    for (let n = 0; n < this.table.seats.length && said < 2; n++) {
      const i = Math.floor(Math.random() * this.table.seats.length);
      const s = this.table.seats[i];
      if (!s.isBot) continue;
      this.say(s, botLine(i, kind));
      said += 1;
    }
  }

  private openBetting(): void {
    if (this.table.passShooter) {
      this.table.shooter = (this.table.shooter + 1) % this.table.seats.length;
      this.table.passShooter = false;
    }
    const g = this.table;
    g.phase = "betting";
    g.walk = { phase: "seated", seat: g.shooter, startedAt: Date.now() };
    g.cdDur = g.betLen * 1000;
    g.cdEnd = Date.now() + g.cdDur;
    g.call = g.point === null ? "Coming out. Place bets." : "Point is " + g.point + ". Place bets.";
    g.seats.forEach((s, i) => {
      if (s.isBot) botWager(s, g.point, i);
      else applyPattern(s, g.point);
    });
    this.publish();
  }

  private timeUp(): void {
    if (this.table.phase !== "betting") return;
    const seat = this.table.seats[this.table.shooter];
    this.table.phase = "awaiting";
    this.table.cdEnd = 0;
    this.table.walk = { phase: "approach", seat: this.table.shooter, startedAt: Date.now() };
    this.table.call = seat.isBot ? seat.name + " shoots." : "YOUR SHOT — HOLD SHIFT OR SPACE";
    this.table.awaitUntil = Date.now() + APPROACH + (seat.isBot ? 800 : 16000);
    this.publish();
  }

  private tick(): void {
    const now = Date.now();
    const g = this.table;
    let dirty = false;
    for (const k of Object.keys(g.bubbles)) {
      if (g.bubbles[k].until < now) {
        delete g.bubbles[k];
        dirty = true;
      }
    }
    if (g.phase === "betting" && g.cdEnd > 0 && now >= g.cdEnd) {
      this.timeUp();
      return;
    }
    if (g.phase === "awaiting" && g.walk.phase === "approach" && now >= g.walk.startedAt + APPROACH) {
      g.walk = { phase: "atBubble", seat: g.shooter, startedAt: now };
      dirty = true;
    }
    if (g.phase === "awaiting" && now >= g.awaitUntil) {
      const seat = g.seats[g.shooter];
      this.beginRoll(seat.isBot ? "bot" : "timeout", seat.isBot ? 0.48 + Math.random() * 0.4 : 0.62);
      return;
    }
    if (g.phase === "rolling" && g.roll && now >= g.roll.startedAt + g.roll.dur) {
      this.settle();
      return;
    }
    if (g.phase === "result" && now >= g.resultUntil) {
      g.phase = "returning";
      g.walk = { phase: "returning", seat: g.shooter, startedAt: now };
      g.returnUntil = now + RETURN;
      this.publish();
      return;
    }
    if (g.phase === "returning" && now >= g.returnUntil) {
      if (g.running) this.openBetting();
      else {
        g.phase = "paused";
        g.walk = { phase: "seated", seat: g.shooter, startedAt: now };
        g.call = "Paused. Bets open.";
        this.publish();
      }
      return;
    }
    if (dirty || now - this.lastBeat > 1000) this.publish();
  }

  private say(seat: Seat, text: string): void {
    const at = Date.now();
    this.table.chat = [...this.table.chat, { id: seat.id + "-" + at, seatId: seat.id, name: seat.name, text, at }].slice(-40);
    this.table.bubbles[seat.id] = { text, until: at + 3800 };
  }

  private snapshot(): Table {
    this.table.serverNow = Date.now();
    this.table.rev += 1;
    return structuredClone(this.table);
  }

  private publish(): void {
    const state = this.snapshot();
    const msg: ServerMsg = { t: "state", state };
    for (const c of this.conns.values()) if (c.open) c.send(msg);
    this.onChange(state);
    this.lastBeat = Date.now();
  }
}
