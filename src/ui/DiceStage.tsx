import { useEffect, useRef } from "react";
import { PIPS, buildAnim, buildTableAnim, cubeTf, DIE, FACE_TF } from "../game/dice";
import type { RollTicket, Table } from "../game/types";

function Face({ n, size }: { n: number; size: number }) {
  return (
    <div className="die-face" style={{ width: size, height: size }}>
      {(PIPS[n] || PIPS[1]).map((p, i) => (
        <i key={i} style={{ left: p[0] + "%", top: p[1] + "%" }} />
      ))}
    </div>
  );
}

export function TableDice({ table, offset }: { table: Table; offset: number }) {
  const box = useRef<HTMLDivElement | null>(null);
  const dice = useRef<Array<HTMLDivElement | null>>([null, null]);
  const rubber = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<RollTicket | null>(table.roll);
  const phaseRef = useRef(table.phase);
  const offRef = useRef(offset);
  const shortRef = useRef(table.noRollId);
  rollRef.current = table.roll;
  phaseRef.current = table.phase;
  offRef.current = offset;

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const roll = rollRef.current;
      const phase = phaseRef.current;
      if (roll && (phase === "rolling" || phase === "result" || phase === "returning")) {
        const now = Date.now() + offRef.current;
        const t = phase === "rolling" ? Math.max(0, Math.min(1, (now - roll.startedAt) / roll.dur)) : 1;
        const anim = buildTableAnim(roll.power, roll.seed, roll.d1, roll.d2);
        anim.dice.forEach((die, i) => {
          const el = dice.current[i];
          if (!el) return;
          const f = Math.min(die.frames.length - 1, t * (die.frames.length - 1));
          const a = die.frames[Math.floor(f)];
          const b = die.frames[Math.min(die.frames.length - 1, Math.floor(f) + 1)];
          const u = f - Math.floor(f);
          const x = a.x + (b.x - a.x) * u;
          const y = a.y + (b.y - a.y) * u;
          const rot = a.rot + (b.rot - a.rot) * u;
          el.style.left = x * 100 + "%";
          el.style.top = y * 100 + "%";
          el.style.transform = `translate(-50%, -50%) rotate(${rot.toFixed(1)}deg)`;
          if (a.bounce && rubber.current) rubber.current.classList.add("hit");
        });
        if (t < 0.2 && rubber.current) rubber.current.classList.remove("hit");
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (shortRef.current === table.noRollId) return;
    shortRef.current = table.noRollId;
    dice.current.forEach((el, i) => {
      if (!el) return;
      el.style.left = i === 0 ? "42%" : "58%";
      el.style.top = "88%";
      el.animate(
        [
          { top: "88%", offset: 0 },
          { top: "70%", offset: 0.45 },
          { top: "90%", offset: 1 },
        ],
        { duration: 700, easing: "ease-out" },
      );
    });
  }, [table.noRollId]);

  const faces: [number, number] = table.roll ? [table.roll.d1, table.roll.d2] : table.dice;
  return (
    <div className="table-dice" ref={box} aria-hidden>
      <div className="pyramid" ref={rubber}>
        {Array.from({ length: 22 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      {faces.map((n, i) => (
        <div key={i} ref={(el) => { dice.current[i] = el; }} className="tumble" style={{ left: i ? "58%" : "42%", top: "86%" }}>
          <Face n={n} size={46} />
        </div>
      ))}
    </div>
  );
}

export function Dome({ table, offset }: { table: Table; offset: number }) {
  const pos = useRef<Array<HTMLDivElement | null>>([null, null]);
  const cubes = useRef<Array<HTMLDivElement | null>>([null, null]);
  const rollRef = useRef(table.roll);
  const phaseRef = useRef(table.phase);
  const offRef = useRef(offset);
  rollRef.current = table.roll;
  phaseRef.current = table.phase;
  offRef.current = offset;

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const roll = rollRef.current;
      const phase = phaseRef.current;
      if (roll && phase === "rolling") {
        const now = Date.now() + offRef.current;
        const tt = Math.max(0, Math.min(1, (now - roll.startedAt) / roll.dur));
        const u = 1 - Math.pow(1 - tt, 1.5);
        const e2 = 1 - Math.pow(1 - tt, 2.6);
        const anim = buildAnim(roll.from, roll.d1, roll.d2, roll.power, roll.angle, roll.seed);
        anim.forEach((p, i) => {
          const n = p.pts.length - 1;
          const f = Math.min(n - 0.0001, u * n);
          const idx = Math.floor(f);
          const sm = f - idx;
          const A = p.pts[idx];
          const B = p.pts[Math.min(n, idx + 1)];
          const x = A[0] + (B[0] - A[0]) * sm;
          const y = A[1] + (B[1] - A[1]) * sm;
          const el = pos.current[i];
          const cube = cubes.current[i];
          if (el) {
            el.style.left = x + "px";
            el.style.top = y + "px";
          }
          if (cube) cube.style.transform = cubeTf(0, p.fz + 360 * p.kz * (1 - e2), p.fx + 360 * p.kx * (1 - e2), p.fy + 360 * p.ky * (1 - e2));
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rest = table.rest;
  return (
    <div className={"dome" + (table.phase === "rolling" ? " shaking" : "")}>
      <div className="dome-bowl">
        <div className="dome-stage">
        {[0, 1].map((i) => (
          <div key={i} ref={(el) => { pos.current[i] = el; }} className="die-pos" style={{ left: rest[i].x, top: rest[i].y, width: DIE, height: DIE }}>
            <div ref={(el) => { cubes.current[i] = el; }} className="cube" style={{ width: DIE, height: DIE, transform: cubeTf(0, rest[i].fz, rest[i].fx, rest[i].fy) }}>
              {FACE_TF.map(([face, tf]) => (
                <div key={face} className="cube-face" style={{ width: DIE, height: DIE, transform: tf + " translateZ(" + DIE / 2 + "px)" }}>
                  {(PIPS[face] || []).map((p, k) => (
                    <i key={k} style={{ left: p[0] + "%", top: p[1] + "%" }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      </div>
      <div className="dome-call">{table.call}</div>
    </div>
  );
}
