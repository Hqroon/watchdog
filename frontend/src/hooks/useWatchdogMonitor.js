import { useCallback, useEffect, useRef, useState } from "react";
import { getIncidents, getStats, resolveIncident } from "../api/gemini.js";
import { useWebSocket } from "./useWebSocket.js";

const DEFAULT_STATS = {
  total: 0,
  unresolved: 0,
  by_severity: { low: 0, medium: 0, high: 0 },
};

export function useWatchdogMonitor({ limit = 100, monitoringActive = false } = {}) {
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [wsConnected, setWsConnected] = useState(false);
  const monitoringActiveRef = useRef(monitoringActive);

  useEffect(() => {
    monitoringActiveRef.current = monitoringActive;
  }, [monitoringActive]);

  const refreshDashboard = useCallback(async () => {
    const [incidentData, statsData] = await Promise.all([getIncidents(limit), getStats()]);
    setIncidents(incidentData);
    setStats(statsData);
  }, [limit]);

  useEffect(() => {
    refreshDashboard().catch(() => {});
  }, [refreshDashboard]);

  useEffect(() => {
    if (!monitoringActive) {
      return;
    }
    refreshDashboard().catch(() => {});
  }, [monitoringActive, refreshDashboard]);

  const handleAnalysis = useCallback((result) => {
    setLatestAnalysis(result);
  }, []);

  const handleWsMessage = useCallback((msg) => {
    if (msg.event === "connected") {
      setWsConnected(true);
      if (monitoringActiveRef.current && msg.stats) {
        setStats(msg.stats);
      }
      return;
    }

    if (msg.event === "new_incident") {
      if (!monitoringActiveRef.current) {
        return;
      }
      setIncidents((prev) => {
        const existing = prev.find((incident) => incident.id === msg.incident.id);
        if (existing) {
          return prev.map((incident) => (incident.id === msg.incident.id ? msg.incident : incident));
        }
        return [msg.incident, ...prev].slice(0, limit);
      });
      if (msg.stats) {
        setStats(msg.stats);
      }
      setLatestAnalysis({ incident: msg.incident, coach: msg.coach });
      return;
    }

    if (msg.event === "incident_resolved") {
      if (!monitoringActiveRef.current) {
        return;
      }
      setIncidents((prev) =>
        prev.map((incident) => (incident.id === msg.incident_id ? { ...incident, resolved: true } : incident))
      );
      if (msg.stats) {
        setStats(msg.stats);
      }
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

  const handleResolveIncident = useCallback(async (incidentId) => {
    const result = await resolveIncident(incidentId);
    if (result.incident) {
      setIncidents((prev) =>
        prev.map((incident) => (incident.id === incidentId ? result.incident : incident))
      );
    }
    if (result.stats) {
      setStats(result.stats);
    } else {
      refreshDashboard().catch(() => {});
    }
    return result;
  }, [refreshDashboard]);

  return {
    incidents,
    latestAnalysis,
    stats,
    wsConnected,
    handleAnalysis,
    handleResolveIncident,
    refreshDashboard,
  };
}
