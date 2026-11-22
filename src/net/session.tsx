import { useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import { Authority, cleanPattern, type ClientMsg, type ServerMsg } from "./authority";
import { defaultPattern } from "../game/engine";
import type { Pattern, Table } from "../game/types";

export type Session = {
  status: "lobby" | "connecting" | "live" | "closed";
  error: string;
  room: string;
  state: Table | null;
  mySeatId: string;
  isHost: boolean;
  offset: number;
  create: (name: string, pattern: Pattern) => void;
  join: (room: string, name: string, pattern: Pattern) => void;
  send: (msg: ClientMsg) => void;
  leave: () => void;
};

export function useSession(): Session {
  const [status, setStatus] = useState<Session["status"]>("lobby");
  const [error, setError] = useState("");
  const [room, setRoom] = useState("");
  const [state, setState] = useState<Table | null>(null);
  const [mySeatId, setMySeatId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [offset, setOffset] = useState(0);
  const auth = useRef<Authority | null>(null);
  const peer = useRef<Peer | null>(null);
  const conn = useRef<DataConnection | null>(null);
  const queue = useRef<ClientMsg[]>([]);

  const take = (table: Table) => {
    setOffset(table.serverNow - Date.now());
    setState(table);
    setRoom(table.room);
  };

  const leave = () => {
    auth.current?.destroy();
    auth.current = null;
    conn.current?.close();
    conn.current = null;
    peer.current?.destroy();
    peer.current = null;
    queue.current = [];
    setStatus("lobby");
    setState(null);
    setIsHost(false);
  };

  const create = (name: string, pattern: Pattern) => {
    leave();
    setStatus("connecting");
    setError("");
    setIsHost(true);
    const host = new Authority(
      name,
      pattern,
      (table) => {
        take(table);
        setStatus("live");
      },
      (id) => {
        setRoom(id);
        const url = new URL(window.location.href);
        url.searchParams.set("room", id);
        window.history.replaceState(null, "", url.pathname + url.search);
      },
      (msg) => {
        setError(msg);
        setStatus("lobby");
      },
    );
    auth.current = host;
    setMySeatId(host.hostSeatId);
  };

  const join = (code: string, name: string, pattern: Pattern) => {
    leave();
    const roomId = code.trim().toLowerCase();
    if (!roomId) {
      setError("Enter a room code.");
      return;
    }
    setStatus("connecting");
    setError("");
    setIsHost(false);
    setRoom(roomId);
    const guest = new Peer();
    peer.current = guest;
    guest.on("open", () => {
      const link = guest.connect(roomId, { reliable: true });
      conn.current = link;
      link.on("open", () => {
        link.send({ t: "join", name, pattern: cleanPattern(pattern) } satisfies ClientMsg);
        for (const m of queue.current) link.send(m);
        queue.current = [];
      });
      link.on("data", (raw) => {
        const msg = raw as ServerMsg;
        if (msg.t === "welcome") {
          setMySeatId(msg.seatId);
          take(msg.state);
          setStatus("live");
        } else if (msg.t === "state") {
          take(msg.state);
        } else if (msg.t === "full") {
          setError("That table is full.");
          leave();
        } else if (msg.t === "bye") {
          setError(msg.reason || "The host left. Their tab has to stay open.");
          setStatus("closed");
        }
      });
      link.on("close", () => {
        if (auth.current) return;
        setError("Disconnected. The host has to keep their tab open.");
        setStatus("closed");
      });
    });
    guest.on("error", (err) => {
      setError(err.type === "peer-unavailable" ? "No table with that code. The host may have closed it." : err.message || "Could not connect.");
      setStatus("lobby");
    });
  };

  const send = (msg: ClientMsg) => {
    if (auth.current) {
      auth.current.act(auth.current.hostSeatId, msg);
      return;
    }
    const link = conn.current;
    if (link && link.open) link.send(msg);
    else queue.current.push(msg);
  };

  useEffect(() => () => {
    auth.current?.destroy();
    peer.current?.destroy();
  }, []);

  return { status, error, room, state, mySeatId, isHost, offset, create, join, send, leave };
}

export { defaultPattern };
