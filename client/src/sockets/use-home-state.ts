import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { HomeState, ServerMessage } from "./types";

export function useHomeState() {
  const [state, setState] = useState<HomeState | null>(null);
  const [connected, setConnected] = useState(false);
  const API_BASE = import.meta.env.VITE_API_HOSTNAME;
  const SOCKET_URL = `${API_BASE}/state`;
  const suppressRef = useRef<boolean>(false);
  const setStateSuppressSocket = useCallback((suppress = true) => {
    suppressRef.current = suppress;
  }, []);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      path: "/api/socket.io",
    });

    socketRef.current = socket;

    socket.on("connect_error", (err) => console.error("connect_error", err));
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("state:update", (msg: ServerMessage<HomeState>) => {
      if (suppressRef.current) {
        return;
      }

      setState(msg.payload);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { state, connected, setStateSuppressSocket };
}
