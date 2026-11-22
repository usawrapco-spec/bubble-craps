import { useEffect, useRef, useState } from "react";
import { Avatar } from "./avatar";
import { Dome } from "./DiceStage";
import { Felt } from "./Felt";
import { canThrow, formatLedger, heatLabel, money, oscillatingPower, onTable, signed } from "../game/engine";
import type { Sfx } from "../game/sfx";
import { speak } from "../game/sfx";
import type { ClientMsg } from "../net/authority";
import type { Pattern, Table } from "../game/types";

const MINE = "#FFD400";
const WIN = "#4ea8ff";
const CHIPS = [1, 5, 10, 25, 100];

export function Game({
  state,
  mySeatId,
  isHost,
  offset,
  room,
  send,
  sfx,
}: {
  state: Table;
  mySeatId: string;
  isHost: boolean;
  offset: number;
  room: string;
  send: (msg: ClientMsg) => void;
  sfx: Sfx;
}) {
  const me = state.seats.find((s) => s.id === mySeatId) ?? state.seats[0];
  const myIndex = state.seats.findIndex((s) => s.id === me.id);
  const [chip, setChip] = useState(10);
  const [takeDown, setTakeDown] = useState(false);
  const [voice, setVoice] = useState(false);
  const [holding, setHolding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const meterRef = useRef<HTMLDivElement | null>(null);
  const meterTxt = useRef<HTMLDivElement | null>(null);
  const powerRef = useRef(0);
  const holdingRef = useRef(false);
  const holdStart = useRef(0);
  const keys = useRef(new Set<string>());
  const stateRef = useRef(state);
  const meRef = useRef(myIndex);
  const sendRef = useRef(send);
  const sfxRef = useRef(sfx);
  const prev = useRef<Table | null>(null);
  stateRef.current = state;
  meRef.current = myIndex;
  sendRef.current = send;
  sfxRef.current = sfx;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    sfx.setHeat(state.heat / 100);
    if (!p) return;
    if (state.phase === "rolling" && p.phase !== "rolling" && state.roll) {
      sfx.noMore();
      sfx.whoosh(state.roll.power);
      sfx.rattle((state.roll.dur / 1000) * 0.65, state.roll.power);
    }
    if (state.phase === "result" && p.phase !== "result") {
      sfx.thunk();
      if (state.celebration) {
        sfx.cheer(state.heat / 100, state.celebration.amount >= 40);
        if (me.ledger.won > 0) {
          sfx.winJingle(me.ledger.won >= 25);
          sfx.tickUp(Math.min(8, Math.max(3, Math.round(me.ledger.won / 10))));
        }
      }
      if (state.call === "Seven out.") {
        sfx.groan();
        sfx.lossTone();
      } else if (!state.celebration && me.ledger.lost > 0) sfx.lossTone();
      if (voice && sfx.on) speak(state.call);
    }
    if (state.noRollId !== p.noRollId) sfx.lossTone();
  }, [state, me.ledger.lost, me.ledger.won, sfx, voice]);

  useEffect(() => {
    let raf = 0;
    const paint = (p: number) => {
      powerRef.current = p;
      if (meterRef.current) meterRef.current.style.height = Math.round(p * 100) + "%";
      if (meterTxt.current) meterTxt.current.textContent = Math.round(p * 100) + "%";
    };
    const loop = () => {
      if (!holdingRef.current) return;
      const p = oscillatingPower(holdStart.current, performance.now());
      paint(p);
      sfxRef.current.rustleSet(p);
      raf = requestAnimationFrame(loop);
    };
    const throwable = () => {
      const g = stateRef.current;
      return meRef.current === g.shooter && canThrow(g.phase);
    };
    const start = () => {
      if (!throwable() || holdingRef.current) return;
      sfxRef.current.ensure();
      sfxRef.current.rustleStart();
      holdingRef.current = true;
      holdStart.current = performance.now();
      setHolding(true);
      loop();
    };
    const release = () => {
      if (!holdingRef.current) return;
      holdingRef.current = false;
      cancelAnimationFrame(raf);
      setHolding(false);
      sfxRef.current.rustleStop();
      const power = powerRef.current;
      paint(0);
      sendRef.current({ t: "throw", kind: "button", power, angle: 0 });
    };
    const field = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n || !n.tagName) return false;
      const tag = n.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const down = (e: KeyboardEvent) => {
      if (field(e.target)) return;
      if (e.key === "Shift" || e.key === " ") {
        e.preventDefault();
        if (e.repeat) return;
        const was = keys.current.size;
        keys.current.add(e.key);
        if (was === 0) start();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const buy: Record<string, number> = { "4": 4, "5": 5, "6": 6, "8": 8, "9": 9, "0": 10 };
      if (buy[e.key]) {
        sendRef.current({ t: "buy", n: buy[e.key], amt: chip });
        sfxRef.current.chip();
      } else if (e.key.toLowerCase() === "m") sfxRef.current.setOn(!sfxRef.current.on);
      else if (e.key.toLowerCase() === "r") sendRef.current({ t: "repeat" });
      else if (e.key.toLowerCase() === "c") sendRef.current({ t: "clear" });
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== "Shift" && e.key !== " ") return;
      if (!keys.current.has(e.key)) return;
      keys.current.delete(e.key);
      if (keys.current.size === 0) release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const api = { start, release };
    (window as unknown as { __bc?: typeof api }).__bc = api;
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      cancelAnimationFrame(raf);
      holdingRef.current = false;
    };
  }, [chip]);

  const throwable = myIndex === state.shooter && canThrow(state.phase);
  const cd = state.phase === "betting" ? Math.max(0, Math.ceil((state.cdEnd - (now + offset)) / 1000)) : 0;
  const invite = window.location.origin + import.meta.env.BASE_URL + "?room=" + encodeURIComponent(room);
  const shooter = state.seats[state.shooter];
  const pattern = me.pattern;
  const setP = (fn: (p: Pattern) => void) => {
    const next = { ...pattern };
    fn(next);
    send({ t: "pattern", pattern: next });
  };
  const bet = (key: string) => {
    sfx.ensure();
    sfx.chip();
    send({ t: "bet", key, amt: chip, takeDown });
  };

  return (
    <div className="stage">
      <header className="top">
        <div className="brand">
          BUBBLE CRAPS
          <span data-testid="play-money">Play money — no cash value</span>
        </div>
        <div className="room">
          Room <b data-testid="room-code">{room}</b>
          <button type="button" onClick={() => { void navigator.clipboard.writeText(invite).then(() => setCopied(true)); }}>
            {copied ? "COPIED" : "COPY INVITE"}
          </button>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => sfx.setOn(!sfx.on)}>{sfx.on ? "SOUND ON" : "SOUND OFF"}</button>
          <input aria-label="Volume" type="range" min={0} max={100} defaultValue={70} onChange={(e) => sfx.setVol(Number(e.target.value) / 100)} />
          <button type="button" onClick={() => { const el = document.documentElement; if (!document.fullscreenElement) void el.requestFullscreen(); else void document.exitFullscreen(); }}>
            FULLSCREEN
          </button>
        </div>
      </header>

      <div className="seats seats-l">
        {state.seats.slice(0, 4).map((s, i) => (
          <SeatCard key={s.id} seat={s} index={i} you={s.id === me.id} shooter={state.shooter === i} walk={state.walk} bubble={state.bubbles[s.id]} now={now + offset} />
        ))}
      </div>

      <div className="pit">
        <Dome table={state} offset={offset} />
        <div className="felt-wrap">
          <Felt table={state} myId={me.id} onZone={bet} />
        </div>
        <div className="call-row">
          <div className="heat" data-testid="heat" data-heat={state.heat}>
            <div className="heat-label">{heatLabel(state.heat)}</div>
            <div className="heat-track">
              <div className="heat-fill" style={{ height: state.heat + "%" }} />
              <div className="heat-notch" />
            </div>
            <div data-testid="streak">×{state.streak}</div>
          </div>
          <div className="call-block">
            <div className="call" data-testid="call">{state.call}</div>
            <div className="dice-readout" data-testid="dice-readout">
              {state.phase === "result" || state.phase === "returning" ? state.dice[0] + "–" + state.dice[1] : state.phase === "betting" ? cd + "s" : ""}
            </div>
            {state.call.startsWith("NO ROLL") ? <div className="short-banner" data-testid="short-banner">NO ROLL, short throw — release above 20%</div> : null}
          </div>
          <div className="throw-box">
            <div className="meter" aria-hidden>
              <div className="short-zone">SHORT</div>
              <div className="meter-fill" ref={meterRef} />
            </div>
            <div>
              <div ref={meterTxt} className="meter-txt">0%</div>
              <button
                type="button"
                className={"roll" + (throwable ? " live" : "")}
                data-testid="roll"
                onPointerDown={(e) => {
                  if (!throwable) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  if (holdingRef.current) return;
                  sfx.ensure();
                  sfx.rustleStart();
                  holdingRef.current = true;
                  holdStart.current = performance.now();
                  setHolding(true);
                  const loop = () => {
                    if (!holdingRef.current) return;
                    const p = oscillatingPower(holdStart.current, performance.now());
                    powerRef.current = p;
                    if (meterRef.current) meterRef.current.style.height = Math.round(p * 100) + "%";
                    if (meterTxt.current) meterTxt.current.textContent = Math.round(p * 100) + "%";
                    sfx.rustleSet(p);
                    requestAnimationFrame(loop);
                  };
                  requestAnimationFrame(loop);
                }}
                onPointerUp={() => {
                  if (!holdingRef.current || keys.current.size > 0) return;
                  holdingRef.current = false;
                  setHolding(false);
                  sfx.rustleStop();
                  const power = powerRef.current;
                  powerRef.current = 0;
                  if (meterRef.current) meterRef.current.style.height = "0%";
                  send({ t: "throw", kind: "button", power, angle: 0 });
                }}
              >
                {throwable ? (holding ? "RELEASE" : "HOLD") : shooter.name.split(" ")[0]}
                <small>{throwable ? "SHIFT / SPACE" : "SHOOTER"}</small>
              </button>
            </div>
          </div>
        </div>
        {state.celebration && (state.phase === "result" || state.phase === "returning") ? (
          <div className="winner" key={state.celebration.id} data-testid="winner-banner">
            <div className="winner-card">
              <div>WINNER!</div>
              <div>{state.celebration.amount > 0 ? "+" + money(state.celebration.amount) : state.celebration.detail}</div>
            </div>
            {Array.from({ length: 14 }, (_, i) => (
              <i
                key={i}
                className="burst"
                style={{
                  ["--dx" as string]: Math.cos((i / 14) * Math.PI * 2) * 140 + "px",
                  ["--dy" as string]: Math.sin((i / 14) * Math.PI * 2) * 90 + "px",
                  background: ["#f4f2ea", "#c9222c", "#1d4fb6", "#1c8a3f", "#141414"][i % 5],
                }}
              />
            ))}
          </div>
        ) : null}
        {state.flash === "seven" && state.phase === "result" ? <div className="seven-flash">✗ SEVEN OUT</div> : null}
      </div>

      <div className="seats seats-r">
        {state.seats.slice(4).map((s, i) => (
          <SeatCard key={s.id} seat={s} index={i + 4} you={s.id === me.id} shooter={state.shooter === i + 4} walk={state.walk} bubble={state.bubbles[s.id]} now={now + offset} />
        ))}
      </div>

      <footer className="dock">
        <div className="meters">
          <Stat k="CREDITS" v={money(me.bank)} c={MINE} testid="credits" />
          <Stat k="BET" v={money(onTable(me))} c="#fff" />
          <Stat k="WIN" v={money(me.lastWin)} c={WIN} />
          <div className="net" data-testid="net-line">{formatLedger(me.ledger)}</div>
        </div>
        <div className="note">{me.note || (me.betsOff ? "Place, buy, hardways and odds are OFF. Pass and come still work." : "Place, buy and hardways stay up until a 7. Odds are 2× true odds.")}</div>
        <div className="controls">
          <div className="chips">
            {CHIPS.map((c) => (
              <button key={c} type="button" className={"chip-btn" + (chip === c && !takeDown ? " on" : "")} onClick={() => { setChip(c); setTakeDown(false); sfx.chip(); }}>
                {c}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => send({ t: "repeat" })}>REPEAT</button>
          <button type="button" onClick={() => send({ t: "clear" })}>CLEAR</button>
          <button type="button" onClick={() => setTakeDown((v) => !v)}>{takeDown ? "TAKE DOWN ON" : "TAKE DOWN"}</button>
          <button type="button" onClick={() => send({ t: "maxOdds" })}>MAX ODDS 2×</button>
          <button type="button" data-testid="bets-off" className={me.betsOff ? "off-on" : ""} onClick={() => send({ t: "betsOff", on: !me.betsOff })}>
            {me.betsOff ? "BETS OFF" : "BETS ON"}
          </button>
          <button type="button" onClick={() => send({ t: "oddsFlag", on: !me.oddsOnComeout })}>
            {me.oddsOnComeout ? "COME-OUT ODDS ON" : "COME-OUT ODDS OFF"}
          </button>
          <button type="button" onClick={() => { sfx.ensure(); send({ t: "insert", amt: 100 }); }}>INSERT $100</button>
          <button type="button" onClick={() => { sfx.ensure(); send({ t: "insert", amt: 20 }); }}>$20</button>
          <button type="button" onClick={() => send({ t: "cashout" })}>CASH OUT</button>
          <button type="button" onClick={() => setP((p) => { p.on = !p.on; })}>{pattern.on ? "PATTERN ON" : "PATTERN OFF"}</button>
          <button type="button" onClick={() => setVoice((v) => !v)}>{voice ? "CALLS ON" : "CALLS OFF"}</button>
          {isHost ? (
            <>
              {[10, 15, 20].map((n) => (
                <button key={n} type="button" onClick={() => send({ t: "timer", sec: n })}>{n}s</button>
              ))}
              <button type="button" onClick={() => send({ t: state.running ? "pause" : "resume" })}>{state.running ? "PAUSE" : "RESUME"}</button>
            </>
          ) : null}
        </div>
        <div className="legend" data-testid="key-legend">
          Hold Shift or Space — the meter oscillates, release to throw. Under 20% is NO ROLL. Keys 4 5 6 8 9 0 buy that number (0 = 10). M mute. R repeat. C clear.
        </div>
        <div className="bottom-row">
          <div className="hist">
            {state.hist.length === 0 ? <span>No rolls yet</span> : null}
            {state.hist.map((h, i) => {
              const sum = h[0] + h[1];
              const hard = h[0] === h[1] && sum >= 4 && sum <= 10;
              return (
                <span key={i} className={sum === 7 ? "h7" : hard ? "hH" : ""}>
                  {sum}{hard ? "H" : ""}
                </span>
              );
            })}
          </div>
          <div className="last">{signed(me.last)} · Hi {money(me.hi)} · Low {money(me.lo)}</div>
          <form
            className="chat"
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem("msg") as HTMLInputElement);
              const text = input.value;
              if (text.trim()) send({ t: "chat", text });
              input.value = "";
            }}
          >
            <input name="msg" maxLength={80} placeholder="Chat" aria-label="Chat" />
          </form>
        </div>
      </footer>

      {me.ticket ? (
        <div className="ticket">
          <div>
            <div>BUBBLE CRAPS</div>
            <div>PLAY MONEY VOUCHER</div>
            <strong>{money(me.ticket.amt)}</strong>
            <div>{me.ticket.id}</div>
            <div>Play money — no cash value</div>
            <button type="button" onClick={() => send({ t: "ackTicket" })}>TAKE TICKET</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ k, v, c, testid }: { k: string; v: string; c: string; testid?: string }) {
  return (
    <div className="stat">
      <span>{k}</span>
      <b style={{ color: c }} data-testid={testid}>{v}</b>
    </div>
  );
}

function SeatCard({
  seat,
  index,
  you,
  shooter,
  walk,
  bubble,
  now,
}: {
  seat: Table["seats"][number];
  index: number;
  you: boolean;
  shooter: boolean;
  walk: Table["walk"];
  bubble?: { text: string; until: number };
  now: number;
}) {
  const walking = walk.seat === index && walk.phase !== "seated";
  return (
    <div className={"seat" + (you ? " you" : "") + (shooter ? " shooter" : "") + (walking ? " " + walk.phase : "") + (index >= 4 ? " right" : " left")}>
      <div className="who">
        <Avatar face={seat.face} size={36} />
      </div>
      <div>
        <div className="seat-name" style={{ color: seat.color }}>{you ? "YOU" : seat.name} {seat.letter}</div>
        <div>{money(seat.bank)}</div>
        <div className="seat-last">{seat.last ? signed(seat.last) : "—"}</div>
      </div>
      {shooter ? <div className="tag">SHOOTER</div> : null}
      {bubble && bubble.until > now ? <div className="bubble">{bubble.text}</div> : null}
    </div>
  );
}
