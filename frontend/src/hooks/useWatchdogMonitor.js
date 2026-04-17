import { useCallback, useEffect, useState } from "react";
import { getIncidents } from "../api/gemini.js";
import { useWebSocket } from "./useWebSocket.js";

const DEFAULT_STATS = {
  total: 0,
  unresolved: 0,
  by_severity: { low: 0, medium: 0, high: 0 },
};

export function useWatchdogMonitor(limit = 100) {
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    getIncidents(limit)
      .then(setIncidents)
      .catch(() => {});
  }, [limit]);

  const handleAnalysis = useCallback((result) => {
    setLatestAnalysis(result);
  }, []);

  const handleWsMessage = useCallback((msg) => {
    if (msg.event === "connected") {
      setWsConnected(true);
      setStats(msg.stats ?? DEFAULT_STATS);
      return;
    }

    if (msg.event === "new_incident") {
      setIncidents((prev) => [msg.incident, ...prev].slice(0, limit));
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        unresolved: prev.unresolved + 1,
        by_severity: {
          ...prev.by_severity,
          [msg.incident.severity]: (prev.by_severity[msg.incident.severity] || 0) + 1,
        },
      }));
      setLatestAnalysis({ incident: msg.incident, coach: msg.coach });
      return;
    }

    if (msg.event === "incident_resolved") {
      setIncidents((prev) =>
        prev.map((incident) =>
          incident.id === msg.incident_id ? { ...incident, resolved: true } : incident
        )
      );
      setStats((prev) => ({
        ...prev,
        unresolved: Math.max(0, prev.unresolved - 1),
      }));
    }
  }, [limit]);

  const wsRef = useWebSocket("/ws", handleWsMessage);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const onClose = () => setWsConnected(false);
    ws.addEventListener("close", onClose);
    return () => ws.removeEventListener("close", onClose);
  }, [wsRef]);

  return {
    incidents,
    latestAnalysis,
    stats,
    wsConnected,
    handleAnalysis,
  };
}
