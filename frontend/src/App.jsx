import { useState } from "react";
import CameraFeed from "./components/CameraFeed.jsx";
import AlertPanel from "./components/AlertPanel.jsx";
import CoachPanel from "./components/CoachPanel.jsx";
import SupervisorDashboard from "./components/SupervisorDashboard.jsx";
import { useWebSocket } from "./hooks/useWebSocket.js";

const TABS = ["Monitor", "Supervisor"];

export default function App() {
  const [tab, setTab] = useState("Monitor");
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ total: 0, unresolved: 0, by_severity: { low: 0, medium: 0, high: 0 } });

  // WebSocket for real-time updates
  useWebSocket("/ws", (msg) => {
    if (msg.event === "connected") {
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
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐕</span>
          <h1 className="text-xl font-bold tracking-tight">WatchDog</h1>
          <span className="text-xs text-gray-400 mt-0.5">Workstation Safety Monitor</span>
        </div>
        <div className="flex items-center gap-4">
          {stats.unresolved > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {stats.unresolved} UNRESOLVED
            </span>
          )}
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        {tab === "Monitor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <CameraFeed onAnalysis={setLatestAnalysis} />
              {latestAnalysis && (
                <CoachPanel analysis={latestAnalysis} />
              )}
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
