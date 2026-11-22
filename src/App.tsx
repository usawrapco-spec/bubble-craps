import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Game } from "./ui/Game";
import { Lobby } from "./ui/Lobby";
import { Sfx } from "./game/sfx";
import { useSession } from "./net/session";

export function App() {
  const session = useSession();
  const sfx = useMemo(() => new Sfx(), []);
  const [booted, setBooted] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const initialRoom = params.get("room") || "";
  const unlock = () => {
    if (!booted) {
      sfx.ensure();
      setBooted(true);
    }
  };
  return (
    <div className="viewport" onPointerDown={unlock}>
      {session.status === "live" && session.state ? (
        <Frame>
          <Game
            state={session.state}
            mySeatId={session.mySeatId}
            isHost={session.isHost}
            offset={session.offset}
            room={session.room}
            send={session.send}
            sfx={sfx}
          />
        </Frame>
      ) : (
        <Frame>
          <Lobby
            error={session.error}
            initialRoom={initialRoom}
            busy={session.status === "connecting"}
            onCreate={(name, pattern) => {
              unlock();
              session.create(name, pattern);
            }}
            onJoin={(room, name, pattern) => {
              unlock();
              session.join(room, name, pattern);
            }}
          />
        </Frame>
      )}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(() => Math.min(window.innerWidth / 1600, window.innerHeight / 900));
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1600, window.innerHeight / 900));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="frame" style={{ width: 1600 * scale, height: 900 * scale }}>
      <div className="stage-scale" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
