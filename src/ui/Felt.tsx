import type { ReactNode } from "react";
import { money, offMarker } from "../game/engine";
import type { Seat, Table } from "../game/types";

const NUMS = [4, 5, 6, 8, 9, 10];
const MINE = "#FFD400";
const WIN = "#4ea8ff";

function nx(n: number): number {
  return 188 + NUMS.indexOf(n) * 112 + 56;
}

type Zone = { k: string; x: number; y: number; w: number; h: number };

const ZONES: Zone[] = [
  { k: "pass", x: 16, y: 48, w: 64, h: 500 },
  { k: "pass", x: 16, y: 500, w: 860, h: 52 },
  { k: "dont", x: 84, y: 48, w: 56, h: 430 },
  { k: "dont", x: 84, y: 448, w: 792, h: 46 },
  { k: "odds", x: 220, y: 556, w: 460, h: 40 },
  { k: "come", x: 160, y: 210, w: 700, h: 78 },
  { k: "dontCome", x: 160, y: 292, w: 700, h: 48 },
  { k: "field", x: 160, y: 348, w: 700, h: 90 },
  { k: "any7", x: 900, y: 48, w: 180, h: 48 },
  { k: "hard6", x: 900, y: 100, w: 88, h: 78 },
  { k: "hard8", x: 992, y: 100, w: 88, h: 78 },
  { k: "hard10", x: 900, y: 182, w: 88, h: 70 },
  { k: "hard4", x: 992, y: 182, w: 88, h: 70 },
  { k: "yo", x: 900, y: 258, w: 180, h: 48 },
  { k: "anyc", x: 900, y: 310, w: 180, h: 48 },
  { k: "aces", x: 900, y: 362, w: 88, h: 56 },
  { k: "twelve", x: 992, y: 362, w: 88, h: 56 },
];

NUMS.forEach((n, i) => {
  ZONES.push({ k: "buy" + n, x: 160 + i * 112, y: 48, w: 112, h: 36 });
  ZONES.push({ k: "place" + n, x: 160 + i * 112, y: 84, w: 112, h: 118 });
});

function anchor(k: string): [number, number] {
  if (k.startsWith("place")) return [nx(Number(k.replace(/\D/g, ""))) - 16, 150];
  if (k.startsWith("buy")) return [nx(Number(k.replace(/\D/g, ""))) + 18, 66];
  if (k.startsWith("come") && k !== "come") return [nx(Number(k.replace(/\D/g, ""))) - 20, 200];
  const fixed: Record<string, [number, number]> = {
    pass: [420, 526],
    dont: [420, 470],
    odds: [450, 576],
    dontOdds: [620, 470],
    come: [400, 248],
    dontCome: [560, 316],
    field: [500, 400],
    any7: [990, 72],
    hard6: [944, 140],
    hard8: [1036, 140],
    hard10: [944, 216],
    hard4: [1036, 216],
    yo: [990, 282],
    anyc: [990, 334],
    aces: [944, 390],
    twelve: [1036, 390],
  };
  return fixed[k] || [200, 200];
}

function MyChip({ x, y, amt, off }: { x: number; y: number; amt: number; off: boolean }): ReactNode {
  const label = money(amt);
  const w = 18 + label.length * 8;
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r="15" fill="#1d4fb6" stroke="#000" strokeWidth="7" />
      <circle cx={x} cy={y} r="15" fill="none" stroke={MINE} strokeWidth="4" />
      <circle cx={x - 16} cy={y - 16} r="8" fill={MINE} stroke="#000" strokeWidth="1.5" />
      <text x={x - 16} y={y - 13} textAnchor="middle" fontSize="11" fontWeight="900" fill="#000">★</text>
      <rect x={x - w / 2} y={y + 16} width={w} height="16" rx="4" fill="#000" stroke={MINE} strokeWidth="1.5" />
      <text x={x} y={y + 28} textAnchor="middle" fontSize="11" fontWeight="900" fill={MINE}>{label}</text>
      {off ? (
        <g>
          <rect x={x + 8} y={y - 28} width="36" height="14" rx="3" fill="#000" stroke="#fff" />
          <text x={x + 26} y={y - 17} textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff">OFF</text>
        </g>
      ) : null}
    </g>
  );
}

export function Felt({ table, myId, onZone }: { table: Table; myId: string; onZone: (key: string) => void }): ReactNode {
  const my = table.seats.find((s) => s.id === myId);
  const point = table.point;
  return (
    <svg viewBox="0 0 1100 620" className="felt" role="img" aria-label="Craps layout">
      <rect x="8" y="8" width="1084" height="604" rx="16" fill="#0c5a32" stroke="#f4e2a4" strokeWidth="3" />
      <g className="rubber" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => (
          <polygon key={i} points={`${18 + i * 40},40 ${38 + i * 40},10 ${58 + i * 40},40`} fill="#141414" stroke="#e2c56a" strokeWidth="1.4" />
        ))}
      </g>
      <g fill="none" stroke="#fff" strokeWidth="3">
        <path d="M16 48 H80 V552 H876 V500 H16 Z" />
        <path d="M84 48 H140 V478 H876 V448 H84 Z" />
        <rect x="220" y="556" width="460" height="40" rx="20" stroke="#ffd75e" />
        <rect x="160" y="210" width="700" height="78" />
        <rect x="160" y="292" width="700" height="48" />
        <rect x="160" y="348" width="700" height="90" />
        {NUMS.map((n, i) => (
          <g key={n}>
            <rect x={160 + i * 112} y="48" width="112" height="36" />
            <rect x={160 + i * 112} y="84" width="112" height="118" />
          </g>
        ))}
        <rect x="890" y="40" width="200" height="500" rx="8" stroke="#ffd75e" />
      </g>
      <text x="430" y="534" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="900" stroke="#042" strokeWidth="4" paintOrder="stroke">PASS LINE</text>
      <text x="430" y="476" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900">DON'T PASS</text>
      <text x="450" y="582" textAnchor="middle" fill="#ffd75e" fontSize="14" fontWeight="900">ODDS 2× TRUE ODDS</text>
      <text x="400" y="258" textAnchor="middle" fill="#fff" fontSize="36" fontWeight="900">COME</text>
      <text x="620" y="324" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="900">DON'T COME</text>
      <text x="300" y="400" textAnchor="middle" fill="#ffd75e" fontSize="28" fontWeight="900">FIELD</text>
      <text x="620" y="400" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800">2 pays 2× · 12 pays 3×</text>
      {NUMS.map((n) => (
        <g key={"t" + n}>
          <text x={nx(n)} y="72" textAnchor="middle" fill="#ffd75e" fontSize="13" fontWeight="900">BUY</text>
          <text x={nx(n)} y="150" textAnchor="middle" fill="#fff" fontSize="32" fontWeight="900">{n === 6 ? "SIX" : n === 9 ? "NINE" : n}</text>
          <text x={nx(n)} y="188" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">PLACE</text>
        </g>
      ))}
      <text x="990" y="78" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900">SEVEN 4:1</text>
      <text x="944" y="150" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">HARD 6</text>
      <text x="1036" y="150" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">HARD 8</text>
      <text x="944" y="222" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">HARD 10</text>
      <text x="1036" y="222" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">HARD 4</text>
      <text x="990" y="288" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900">YO 15:1</text>
      <text x="990" y="340" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900">CRAPS 7:1</text>
      <text x="944" y="396" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">ACES</text>
      <text x="1036" y="396" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">12</text>
      {ZONES.map((z, i) => (
        <rect key={i} className="zone" x={z.x} y={z.y} width={z.w} height={z.h} rx="4" onClick={() => onZone(z.k)}>
          <title>{z.k}</title>
        </rect>
      ))}
      {table.seats.map((s, i) => (
        <SeatChips key={s.id} seat={s} index={i} mine={s.id === myId} point={point} />
      ))}
      {my
        ? Object.keys(my.pays).map((k) => {
            const a = anchor(k);
            const label = "+" + money(my.pays[k]) + " ✓";
            const w = 16 + label.length * 7;
            return (
              <g key={k + table.rev} pointerEvents="none">
                <rect x={a[0] - w / 2} y={a[1] - 46} width={w} height="18" rx="4" fill={WIN} stroke="#000" strokeWidth="2" />
                <text x={a[0]} y={a[1] - 33} textAnchor="middle" fontSize="12" fontWeight="900" fill="#041018">{label}</text>
              </g>
            );
          })
        : null}
      {point !== null ? (
        <g pointerEvents="none">
          <circle cx={nx(point)} cy="130" r="16" fill="#fafafa" stroke="#111" strokeWidth="3" />
          <text x={nx(point)} y="136" textAnchor="middle" fontSize="12" fontWeight="900" fill="#111">ON</text>
        </g>
      ) : (
        <g pointerEvents="none">
          <circle cx="820" cy="250" r="16" fill="#111" stroke="#fafafa" strokeWidth="3" />
          <text x="820" y="255" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fafafa">OFF</text>
        </g>
      )}
    </svg>
  );
}

function SeatChips({ seat, index, mine, point }: { seat: Seat; index: number; mine: boolean; point: number | null }): ReactNode {
  const dx = ((index % 4) - 1.5) * 16;
  const dy = Math.floor(index / 4) * 14;
  const nodes: ReactNode[] = [];
  const add = (k: string, amt: number) => {
    if (!amt) return;
    const a = anchor(k);
    if (mine) nodes.push(<MyChip key={k} x={a[0]} y={a[1]} amt={amt} off={offMarker(seat, k, point) === "OFF"} />);
    else nodes.push(<circle key={k} cx={a[0] + dx} cy={a[1] + dy} r="7" fill={seat.color} stroke="#000" strokeWidth="1.5" />);
  };
  for (const k of Object.keys(seat.bets)) add(k, seat.bets[k]);
  for (const n of Object.keys(seat.come)) add("come" + n, seat.come[Number(n)]);
  for (const n of Object.keys(seat.comeOdds)) add("comeOdds" + n, seat.comeOdds[Number(n)]);
  for (const n of Object.keys(seat.dontCome)) add("dontCome" + n, seat.dontCome[Number(n)]);
  for (const n of Object.keys(seat.dontComeOdds)) add("dontComeOdds" + n, seat.dontComeOdds[Number(n)]);
  return <g pointerEvents="none">{nodes}</g>;
}
