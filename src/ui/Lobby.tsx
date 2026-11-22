import { useState } from "react";
import { defaultPattern } from "../game/engine";
import type { Pattern } from "../game/types";

export function Lobby({
  error,
  initialRoom,
  busy,
  onCreate,
  onJoin,
}: {
  error: string;
  initialRoom: string;
  busy: boolean;
  onCreate: (name: string, pattern: Pattern) => void;
  onJoin: (room: string, name: string, pattern: Pattern) => void;
}) {
  const [name, setName] = useState(() => sessionStorage.getItem("bc-name") || "");
  const [room, setRoom] = useState(initialRoom);
  const [patternOn, setPatternOn] = useState(true);
  const pattern = { ...defaultPattern(), on: patternOn };
  const go = (fn: () => void) => {
    const n = name.trim() || "Player";
    sessionStorage.setItem("bc-name", n);
    setName(n);
    fn();
  };
  return (
    <div className="lobby">
      <h1>BUBBLE CRAPS</h1>
      <p data-testid="play-money">Play money — no cash value. Nothing here can be cashed out for real money.</p>
      <label>
        Your name
        <input data-testid="name" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={patternOn} onChange={(e) => setPatternOn(e.target.checked)} />
        Start with My Pattern on
      </label>
      <button type="button" data-testid="create-table" disabled={busy} onClick={() => go(() => onCreate(name.trim() || "Player", pattern))}>
        Create a table
      </button>
      <div className="join-row">
        <input data-testid="join-code" value={room} placeholder="Room code" onChange={(e) => setRoom(e.target.value)} />
        <button type="button" data-testid="join" disabled={busy} onClick={() => go(() => onJoin(room, name.trim() || "Player", pattern))}>
          Join
        </button>
      </div>
      {error ? <p className="err">{error}</p> : null}
      <p className="fine">
        The player who creates the table is the host. Their browser rolls the dice. Friends need the invite link, and the host has to keep that tab open.
        Hold Shift or Space and release to throw. A release under 20% is a no-roll.
      </p>
    </div>
  );
}
