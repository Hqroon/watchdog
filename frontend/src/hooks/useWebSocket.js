import { useEffect, useRef } from "react";

export function useWebSocket(path, onMessage, retryMs = 3000) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const retryTimeout = useRef(null);
  const unmounted = useRef(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    unmounted.current = false;

    function connect() {
      if (unmounted.current) return;

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const token = localStorage.getItem("watchdog_token");
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const url = `${protocol}://${window.location.host}${path}${query}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected to", url);
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          onMessageRef.current?.(data);
        } catch {
          // ignore non-JSON frames
        }
      };

      ws.onclose = () => {
        if (!unmounted.current) {
          console.log(`[WS] Disconnected. Retrying in ${retryMs}ms…`);
          retryTimeout.current = setTimeout(connect, retryMs);
        }
      };

      ws.onerror = (err) => {
        console.warn("[WS] Error:", err);
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted.current = true;
      clearTimeout(retryTimeout.current);
      wsRef.current?.close();
    };
  }, [path, retryMs]);

  return wsRef;
}
