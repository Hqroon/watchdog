import { useEffect, useRef } from "react";
import { useToast } from "../components/ToastContainer.jsx";

const RISK_TO_TYPE = { high: "critical", medium: "warning", low: "info" };

export function useWebSocket(path, onMessage, retryMs = 3000) {
  const { addToast }    = useToast();
  const wsRef           = useRef(null);
  const onMessageRef    = useRef(onMessage);
  const retryTimeout    = useRef(null);
  const unmounted       = useRef(false);
  const addToastRef     = useRef(addToast);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { addToastRef.current  = addToast;  }, [addToast]);

  useEffect(() => {
    unmounted.current = false;

    function connect() {
      if (unmounted.current) return;

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}${path}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected to", url);
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.event === "new_incident") {
            const type = RISK_TO_TYPE[data.incident?.severity] ?? "info";
            addToastRef.current?.(data.incident?.description || "New incident detected", type);
          }
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
