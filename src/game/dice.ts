import type { DieAnim, Rest } from "./types";

export const DIE = 38;
export const FLOOR = 238;

export const FACE_ROT: Record<number, [number, number]> = {
  1: [0, 0],
  2: [90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  6: [0, 180],
};

export const FACE_TF: Array<[number, string]> = [
  [1, "rotateY(0deg)"],
  [6, "rotateY(180deg)"],
  [3, "rotateY(90deg)"],
  [4, "rotateY(-90deg)"],
  [5, "rotateX(90deg)"],
  [2, "rotateX(-90deg)"],
];

export const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
};

export function initialRest(): Rest[] {
  return [
    { x: 132, y: FLOOR, fx: 0, fy: -90, fz: 14 },
    { x: 186, y: FLOOR - 4, fx: 0, fy: 90, fz: -22 },
  ];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cubeTf(z: number, rz: number, rx: number, ry: number): string {
  return (
    "translateZ(" +
    (DIE / 2 + z).toFixed(1) +
    "px) rotateZ(" +
    rz.toFixed(1) +
    "deg) rotateX(" +
    rx.toFixed(1) +
    "deg) rotateY(" +
    ry.toFixed(1) +
    "deg)"
  );
}

/** Flight path is cosmetic. The resting face is FACE_ROT of the ticket's die, not a new roll. */
export function buildAnim(from: Rest[], d1: number, d2: number, power: number, angle: number, seed: number): DieAnim[] {
  const rand = mulberry32(seed || 1);
  const rnd = (a: number, b: number) => a + rand() * (b - a);
  const P = power;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const hops = 8 + Math.round(P * 6);
  const restX = 160 + rnd(-28, 28);
  return [d1, d2].map((face, i) => {
    const fr = FACE_ROT[face];
    const pts: Array<[number, number]> = [[from[i].x, from[i].y]];
    for (let k = 0; k < hops; k++) {
      const lift = 1 - k / hops;
      const bias = dirX * 75 * P * lift * (k % 2 === 0 ? 1 : -0.6);
      const x = Math.max(62, Math.min(258, rnd(80, 240) + bias));
      const top = 40 + 150 * P + (dirY < 0 ? 20 : 0);
      pts.push([x, FLOOR - rnd(15, top) * lift - (k % 2 === 0 ? 0 : 10)]);
    }
    pts.push([restX + (i ? 26 : -26) + rnd(-4, 4), FLOOR - rnd(0, 6)]);
    return {
      pts,
      fx: fr[0],
      fy: fr[1],
      fz: Math.round(rnd(-40, 40)),
      kx: 3 + Math.floor(rnd(0, 3) + P * 4),
      ky: 2 + Math.floor(rnd(0, 3) + P * 3),
      kz: (rand() < 0.5 ? -1 : 1) * (1 + Math.round(P * 2)),
    };
  });
}

export type TableFrame = { x: number; y: number; rot: number; bounce: boolean };
export type TableDiePath = { face: number; frames: TableFrame[] };

/**
 * Dice leave the shooter's end of the felt, tumble into the back-wall pyramid rubber, and bounce back.
 * `power` changes speed and rebound only. The face on each die is the host's number.
 */
export function buildTableAnim(power: number, seed: number, d1: number, d2: number): { dice: [TableDiePath, TableDiePath] } {
  const rand = mulberry32(seed || 1);
  const p = Math.max(0, Math.min(1, power));
  const travel = 0.34 + (1 - p) * 0.12;
  const die = (face: number, bias: number): TableDiePath => {
    const frames: TableFrame[] = [];
    const n = 40;
    const xWall = 0.5 + bias + (rand() - 0.5) * 0.08;
    const settleX = 0.5 + bias * 0.85 + (rand() - 0.5) * 0.06;
    const settleY = 0.46 + (1 - p) * 0.08 + rand() * 0.05;
    const rebound = 0.1 + p * 0.28;
    const spin = (640 + p * 1100) * (bias < 0 ? -1 : 1);
    let bounced = false;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let x: number;
      let y: number;
      let bounce = false;
      if (t < travel) {
        const u = t / travel;
        const ease = u * u * (3 - 2 * u);
        y = 0.9 + (0.045 - 0.9) * ease;
        x = 0.5 + bias * 0.15 + (xWall - (0.5 + bias * 0.15)) * ease;
      } else {
        const u = (t - travel) / (1 - travel);
        const back = Math.sin(u * Math.PI) * rebound * (1 - u * 0.35);
        y = 0.045 + (settleY - 0.045) * u + back;
        x = xWall + (settleX - xWall) * u;
        if (!bounced) {
          bounce = true;
          bounced = true;
        }
      }
      const fade = Math.min(1, t / 0.86);
      frames.push({
        x: Math.max(0.07, Math.min(0.93, x)),
        y: Math.max(0.03, Math.min(0.94, y)),
        rot: spin * (1 - fade),
        bounce,
      });
    }
    return { face, frames };
  };
  return { dice: [die(d1, -0.16), die(d2, 0.16)] };
}

/** Cryptographic d6. Rejection sampling keeps the residue unbiased. */
export function d6(): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 6) * 6;
  let x = limit;
  while (x >= limit) {
    crypto.getRandomValues(buf);
    x = buf[0];
  }
  return (x % 6) + 1;
}
