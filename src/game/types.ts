export type Bets = Record<string, number>;

export type Face = {
  skin: string;
  hair: string;
  shirt: string;
  style: string;
  glasses?: boolean;
  shades?: boolean;
  lips?: string;
  beard?: boolean;
  chain?: boolean;
};

export type Pattern = {
  on: boolean;
  line: boolean;
  lineAmt: number;
  odds: boolean;
  oddsX: number;
  buy: boolean;
  buyAmt: number;
  place: boolean;
  placeAmt: number;
  hard: boolean;
  hardAmt: number;
};

/** Profits, forfeited stakes, and wagers taken from credits since the previous roll. */
export type Ledger = {
  won: number;
  lost: number;
  placed: number;
  returned: number;
  net: number;
};

export type Ticket = { amt: number; id: string; time: string };

export type Seat = {
  id: string;
  name: string;
  color: string;
  letter: string;
  bank: number;
  bets: Bets;
  come: Record<number, number>;
  comeOdds: Record<number, number>;
  dontCome: Record<number, number>;
  dontComeOdds: Record<number, number>;
  face: Face;
  rebuy: number;
  last: number;
  lastWin: number;
  lastBets: Bets;
  placedSince: number;
  ledger: Ledger;
  pays: Record<string, number>;
  banner: string;
  note: string;
  hi: number;
  lo: number;
  combo: number;
  isBot: boolean;
  pattern: Pattern;
  /** When false, odds (pass, come, lay) are not at risk on the come-out. */
  oddsOnComeout: boolean;
  /**
   * While on, this player's place, buy, hardway, and odds bets stay on the layout
   * but neither win nor lose. Pass, Don't Pass, Come, and Don't Come flats still work.
   */
  betsOff: boolean;
  ticket: Ticket | null;
};

export type Phase = "idle" | "betting" | "paused" | "awaiting" | "locked" | "rolling" | "result" | "returning";

export type ThrowKind = "flick" | "button" | "bot" | "timeout";

export type Rest = { x: number; y: number; fx: number; fy: number; fz: number };

export type DieAnim = {
  pts: Array<[number, number]>;
  fx: number;
  fy: number;
  fz: number;
  kx: number;
  ky: number;
  kz: number;
};

/** The only description of a roll. Dice and the point are fixed here before anyone animates or pays. */
export type RollTicket = {
  id: number;
  kind: ThrowKind;
  d1: number;
  d2: number;
  point: number | null;
  power: number;
  angle: number;
  seed: number;
  startedAt: number;
  dur: number;
  from: Rest[];
};

export type WalkPhase = "seated" | "approach" | "atBubble" | "returning";

export type Walk = { phase: WalkPhase; seat: number; startedAt: number };

export type ChatMsg = { id: string; seatId: string; name: string; text: string; at: number };

export type PendingThrow = { kind: ThrowKind; power: number; angle: number };

/** Same object on every client. Amount is the sum of profits paid on that roll. */
export type Celebration = {
  id: number;
  headline: "WINNER!";
  amount: number;
  detail: string;
};

export type HeatKind = "hit" | "point" | "natural" | "craps" | "seven" | "cool";

export type Table = {
  room: string;
  seats: Seat[];
  shooter: number;
  point: number | null;
  pointsMade: number;
  hand: number;
  handLog: number[];
  hist: Array<[number, number]>;
  phase: Phase;
  running: boolean;
  betLen: number;
  cdEnd: number;
  cdDur: number;
  dice: [number, number];
  call: string;
  flash: "" | "win" | "seven" | "hard";
  flashId: number;
  rest: Rest[];
  roll: RollTicket | null;
  pending: PendingThrow | null;
  walk: Walk;
  bubbles: Record<string, { text: string; until: number }>;
  chat: ChatMsg[];
  nextRoll: number;
  passShooter: boolean;
  /** 0–100. Rises on hits during this shooter's hand. Shared by every seat. */
  heat: number;
  /** Consecutive hits this hand. Resets on a seven-out. */
  streak: number;
  celebration: Celebration | null;
  /** Bumps when the shooter releases under the short-throw line. No dice are rolled. */
  noRollId: number;
  serverNow: number;
  rev: number;
  resultUntil: number;
  lockUntil: number;
  awaitUntil: number;
  returnUntil: number;
};
