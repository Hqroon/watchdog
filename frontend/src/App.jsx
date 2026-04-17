import { useState, useEffect, useCallback } from "react";
import CameraFeed from "./components/CameraFeed.jsx";
import AlertPanel from "./components/AlertPanel.jsx";
import CoachPanel from "./components/CoachPanel.jsx";
import SupervisorDashboard from "./components/SupervisorDashboard.jsx";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { getIncidents } from "./api/gemini.js";
import { BUTTON, STATUS, SURFACE } from "./ui/tokens.js";

const TABS = ["Monitor", "Supervisor"];

export default function App() {
  const [tab, setTab]                 = useState("Monitor");
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [incidents, setIncidents]     = useState([]);
  const [stats, setStats]             = useState({ total: 0, unresolved: 0, by_severity: { low: 0, medium: 0, high: 0 } });
  const [wsConnected, setWsConnected] = useState(false);

  // Load existing incidents on mount
  useEffect(() => {
    getIncidents(100)
      .then(setIncidents)
      .catch(() => {});
  }, []);

  const handleWsMessage = useCallback((msg) => {
    if (msg.event === "connected") {
      setWsConnected(true);
      setStats(msg.stats);
    } else if (msg.event === "new_incident") {
      setIncidents((prev) => [msg.incident, ...prev].slice(0, 100));
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
    } else if (msg.event === "incident_resolved") {
      setIncidents((prev) =>
        prev.map((i) => (i.id === msg.incident_id ? { ...i, resolved: true } : i))
      );
      setStats((prev) => ({ ...prev, unresolved: Math.max(0, prev.unresolved - 1) }));
    }
  }, []);

  const wsRef = useWebSocket("/ws", handleWsMessage);

  // Track WS disconnect
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const onClose = () => setWsConnected(false);
    ws.addEventListener("close", onClose);
    return () => ws.removeEventListener("close", onClose);
  }, [wsRef]);

  return (
    <div className={`min-h-screen flex flex-col ${SURFACE.app}`}>
      {/* ── Header ── */}
      <header className={`${SURFACE.card} rounded-none border-x-0 border-t-0 px-6 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐕</span>
          <h1 className="text-xl font-bold tracking-tight">WatchDog</h1>
          <span className={`text-xs mt-0.5 hidden sm:block ${SURFACE.mutedText}`}>Workstation Safety Monitor</span>
        </div>

        <div className="flex items-center gap-4">
          {/* WS status dot */}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${wsConnected ? STATUS.liveDot : STATUS.connectingDot}`} />
            <span className={`text-xs hidden sm:block ${SURFACE.mutedText}`}>
              {wsConnected ? "Live" : "Connecting…"}
            </span>
          </div>

          {/* Unresolved badge */}
          {stats.unresolved > 0 && (
            <span className={`${STATUS.openBadge} text-xs font-bold px-2 py-0.5 rounded-full animate-pulse`}>
              {stats.unresolved} OPEN
            </span>
          )}

          {/* Tab bar */}
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  tab === t
                    ? BUTTON.tabActive
                    : BUTTON.primaryGhost
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 p-4">
        {tab === "Monitor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <CameraFeed onAnalysis={setLatestAnalysis} />
              <CoachPanel analysis={latestAnalysis} />
            </div>
            <AlertPanel incidents={incidents} stats={stats} />
          </div>
        )}
        {tab === "Supervisor" && (
          <SupervisorDashboard incidents={incidents} stats={stats} />
        )}
      </main>
    </div>
  );
}
