import { addBet, createSeat, defaultPattern, MAX_ODDS_X, onTable, r2 } from "./engine";
import type { Face, Pattern, Seat } from "./types";

export const SEAT_COLORS = ["#FFD400", "#ff8a2a", "#c084fc", "#e7e7e7", "#ff5fa2", "#4ea8ff", "#f2d27a", "#7ee0d6"];

const STYLES = ["short", "cap", "slick", "long", "curly"] as const;

export function faceForName(name: string): Face {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 33 + name.charCodeAt(i)) >>> 0;
  const skins = ["#f0c7a4", "#d9a47c", "#b97d55", "#8d5a3c", "#efc19b"];
  const hairs = ["#3a2416", "#111111", "#c0262c", "#5b1b1b", "#6b4a2a"];
  const shirts = ["#2b6cb0", "#e0662a", "#7a5cc9", "#1a1a1a", "#0f6e6e", "#c2185b"];
  const style = STYLES[h % STYLES.length];
  return {
    skin: skins[h % skins.length],
    hair: hairs[(h >>> 3) % hairs.length],
    shirt: shirts[(h >>> 6) % shirts.length],
    style,
    shades: style === "slick",
    chain: style === "slick",
    lips: style === "long" || style === "curly" ? "#a33b55" : undefined,
  };
}

function has(s: Seat, k: string): boolean {
  return (s.bets[k] || 0) > 0;
}
function put(s: Seat, k: string, a: number): void {
  if (!has(s, k)) addBet(s, k, a);
}
function takeOdds(s: Seat, point: number | null, x: number): void {
  if (point === null || !s.bets.pass) return;
  const diff = r2(Math.min(x, MAX_ODDS_X) * s.bets.pass - (s.bets.odds || 0));
  if (diff > 0.001) addBet(s, "odds", diff);
}

type Persona = {
  name: string;
  face: Face;
  bank: number;
  rebuy: number;
  wager: (s: Seat, point: number | null) => void;
};

function persona(name: string, face: Face, bank: number, rebuy: number, wager: Persona["wager"]): Persona {
  return { name, face, bank, rebuy, wager };
}

export const PERSONAS: Persona[] = [
  persona("Big Mike", { skin: "#e9b48f", hair: "#c0262c", shirt: "#e0662a", style: "cap" }, 400, 300, (s, pt) => {
    if (pt === null) {
      put(s, "pass", 10);
      if (Math.random() < 0.2) put(s, "yo", 1);
    } else {
      takeOdds(s, pt, 2);
      for (const n of [6, 8]) if (n !== pt) put(s, "place" + n, 12);
    }
  }),
  persona("Priya", { skin: "#b97d55", hair: "#1d1210", shirt: "#7a5cc9", style: "long", lips: "#8a3a4a" }, 150, 100, (s, pt) => {
    if (pt === null) put(s, "pass", 10);
    if (Math.random() < 0.3) put(s, "field", 5);
  }),
  persona("Vince", { skin: "#efc19b", hair: "#111111", shirt: "#1a1a1a", style: "slick", shades: true, chain: true }, 3000, 2000, (s, pt) => {
    if (pt === null) put(s, "pass", 25);
    else {
      takeOdds(s, pt, 2);
      for (const n of [6, 8]) if (n !== pt) put(s, "place" + n, 30);
      for (const n of [4, 10]) if (n !== pt) put(s, "buy" + n, 25);
    }
  }),
  persona("Rosa", { skin: "#c98e64", hair: "#5b1b1b", shirt: "#c2185b", style: "curly", lips: "#c2185b" }, 300, 200, (s, pt) => {
    if (pt === null) {
      put(s, "pass", 10);
      if (Math.random() < 0.3) put(s, "anyc", 1);
    } else {
      takeOdds(s, pt, 1);
      put(s, "hard6", 1);
      put(s, "hard8", 1);
    }
  }),
  persona("Dez", { skin: "#d7b89a", hair: "#222", shirt: "#243044", style: "short" }, 250, 150, (s, pt) => {
    if (pt === null) put(s, "dont", 15);
    else if (Math.random() < 0.35) put(s, "any7", 1);
  }),
  persona("June", { skin: "#e7c2a4", hair: "#6b3a22", shirt: "#3d6b4f", style: "long" }, 220, 120, (s, pt) => {
    if (pt === null) put(s, "pass", 10);
    else put(s, "come", 10);
  }),
  persona("Ace", { skin: "#c4926a", hair: "#111", shirt: "#143d66", style: "cap" }, 180, 100, (s, pt) => {
    if (pt === null) put(s, "pass", 10);
    if (Math.random() < 0.4) put(s, "yo", 1);
    if (Math.random() < 0.25) put(s, "anyc", 1);
  }),
  persona("Lucky", { skin: "#f0c7a4", hair: "#3a2416", shirt: "#6a4a12", style: "curly" }, 160, 80, (s, pt) => {
    if (pt === null) put(s, "pass", 10);
    else if (Math.random() < 0.5) put(s, "field", 5);
  }),
];

export function botWager(s: Seat, point: number | null, index: number): void {
  if (s.bank < 20 && onTable(s) === 0) {
    const bonus = s.rebuy || 100;
    s.bank = r2(s.bank + bonus);
  }
  const personaAt = PERSONAS[index % PERSONAS.length];
  personaAt.wager(s, point);
}

export function botLine(index: number, kind: "seven" | "win" | "point" | "hard"): string {
  const packs: Record<typeof kind, string[]> = {
    seven: ["Seven out. Brutal.", "The bubble went cold.", "That's the game.", "Noooo, seven."],
    win: ["Winner! Pay the table.", "That's what I'm here for.", "Keep it hot.", "Yes! Pay me."],
    point: ["Come on, point.", "No sevens.", "Let it ride.", "I like this number."],
    hard: ["Came hard!", "Hard way. That's mine.", "The hard way!"],
  };
  const lines = packs[kind];
  const pick = lines[(index + Math.floor(Math.random() * lines.length)) % lines.length];
  return pick;
}

export function makeRing(hostName: string, pattern: Pattern): Seat[] {
  return Array.from({ length: 8 }, (_, i) => {
    const color = SEAT_COLORS[i];
    const letter = "ABCDEFGH"[i];
    if (i === 0) {
      return createSeat({
        id: "p0",
        name: hostName,
        color,
        letter,
        face: faceForName(hostName),
        bank: 100,
        isBot: false,
        pattern,
        rebuy: 0,
      });
    }
    const bot = PERSONAS[(i - 1) % PERSONAS.length];
    return createSeat({
      id: "p" + i,
      name: bot.name,
      color,
      letter,
      face: bot.face,
      bank: bot.bank,
      rebuy: bot.rebuy,
      isBot: true,
      pattern: { ...defaultPattern(), on: false },
    });
  });
}

export function fillAsBot(seat: Seat, index: number): void {
  const bot = PERSONAS[index % PERSONAS.length];
  seat.name = bot.name;
  seat.face = bot.face;
  seat.bank = bot.bank;
  seat.rebuy = bot.rebuy;
  seat.isBot = true;
  seat.bets = {};
  seat.come = {};
  seat.comeOdds = {};
  seat.dontCome = {};
  seat.dontComeOdds = {};
  seat.pattern = { ...defaultPattern(), on: false };
  seat.betsOff = false;
  seat.oddsOnComeout = false;
  seat.placedSince = 0;
  seat.ticket = null;
  seat.note = "";
  seat.pays = {};
}
