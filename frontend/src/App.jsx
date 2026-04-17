import { useState, useEffect, useCallback } from "react";
import CameraFeed from "./components/CameraFeed.jsx";
import AlertPanel from "./components/AlertPanel.jsx";
import CoachPanel from "./components/CoachPanel.jsx";
import WorkerDashboard from "./components/WorkerDashboard.jsx";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { getIncidents, getStats, resolveIncident } from "./api/gemini.js";

const TABS = ["Monitor", "Worker Dashboard"];
const THEME_KEY = "lance-theme";

const DEMO_SCENARIOS = [
  {
    label: "Hazard",
    overall_risk: "high",
    frame_summary: "Liquid spill near workstation creating a slip hazard.",
    posture_issues: [],
    housekeeping_issues: [{ issue: "liquid spill", severity: "critical", description: "Slip hazard near operator position" }],
    detections: [
      { category: "PERSON",  label: "operator",     confidence: 0.96, box: { x: 0.1,  y: 0.05, w: 0.35, h: 0.8  }, severity: "ok"       },
      { category: "HAZARDS", label: "liquid spill",  confidence: 0.91, box: { x: 0.0,  y: 0.75, w: 0.5,  h: 0.2  }, severity: "critical" },
    ],
  },
  {
    label: "Posture",
    overall_risk: "medium",
    frame_summary: "Operator showing forward neck lean at workbench.",
    posture_issues: [{ issue: "forward neck lean", severity: "warning", description: "Head angled forward sustained" }],
    housekeeping_issues: [],
    detections: [
      { category: "PERSON", label: "operator leaning forward", confidence: 0.95, box: { x: 0.2, y: 0.1, w: 0.4, h: 0.75 }, severity: "warning" },
    ],
  },
  {
    label: "Housekeeping",
    overall_risk: "medium",
    frame_summary: "Loose cable and food/drink item present at workstation.",
    posture_issues: [],
    housekeeping_issues: [{ issue: "loose cable on floor", severity: "warning", description: "Trip hazard near station" }],
    detections: [
      { category: "WIRES_CABLES", label: "loose cable",  confidence: 0.88, box: { x: 0.05, y: 0.72, w: 0.45, h: 0.18 }, severity: "warning"  },
      { category: "FOOD_DRINK",   label: "coffee cup",   confidence: 0.93, box: { x: 0.74, y: 0.28, w: 0.14, h: 0.22 }, severity: "critical" },
      { category: "PERSON",       label: "operator",     confidence: 0.96, box: { x: 0.3,  y: 0.08, w: 0.35, h: 0.78 }, severity: "ok"       },
    ],
  },
  {
    label: "All Clear",
    overall_risk: "low",
    frame_summary: "Workstation clear. No hazards detected.",
    posture_issues: [],
    housekeeping_issues: [],
    detections: [
      { category: "PERSON",     label: "operator",     confidence: 0.96, box: { x: 0.3,  y: 0.1,  w: 0.35, h: 0.75 }, severity: "ok" },
      { category: "COMPONENTS", label: "PCB assembly", confidence: 0.92, box: { x: 0.55, y: 0.4,  w: 0.3,  h: 0.25 }, severity: "ok" },
      { category: "TOOLS",      label: "screwdriver",  confidence: 0.84, box: { x: 0.72, y: 0.6,  w: 0.1,  h: 0.18 }, severity: "ok" },
    ],
  },
  {
    label: "Multi Violation",
    overall_risk: "high",
    frame_summary: "Multiple critical violations: exposed wiring and drink near components.",
    posture_issues: [],
    housekeeping_issues: [
      { issue: "exposed wiring",              severity: "critical", description: "Electrical hazard at workstation" },
      { issue: "drink bottle near components", severity: "critical", description: "Liquid contamination risk" },
    ],
    detections: [
      { category: "PERSON",       label: "operator",       confidence: 0.97, box: { x: 0.15, y: 0.05, w: 0.4,  h: 0.8  }, severity: "ok"       },
      { category: "WIRES_CABLES", label: "exposed wiring", confidence: 0.85, box: { x: 0.6,  y: 0.6,  w: 0.3,  h: 0.25 }, severity: "critical" },
      { category: "FOOD_DRINK",   label: "drink bottle",      confidence: 0.9,  box: { x: 0.7,  y: 0.2,  w: 0.1,  h: 0.25 }, severity: "critical" },
    ],
  },
];

export default function App() {
  const [tab, setTab]                 = useState("Monitor");
  const [theme, setTheme]             = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "dark";
    } catch {
      return "dark";
    }
  });
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [incidents, setIncidents]     = useState([]);
  const [stats, setStats]             = useState({ total: 0, unresolved: 0, by_severity: { low: 0, medium: 0, high: 0 } });
  const [wsConnected, setWsConnected] = useState(false);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [demoMode, setDemoMode]       = useState(false);
  const [demoIndex, setDemoIndex]     = useState(0);

  const refreshDashboard = useCallback(async () => {
    const [incidentData, statsData] = await Promise.all([getIncidents(100), getStats()]);
    setIncidents(incidentData);
    setStats(statsData);
  }, []);

  useEffect(() => {
    refreshDashboard().catch(() => {});
  }, [refreshDashboard]);

  useEffect(() => {
    if (!monitoringActive) {
      return;
    }
    refreshDashboard().catch(() => {});
  }, [monitoringActive, refreshDashboard]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-light", theme === "light");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

  const handleWsMessage = useCallback((msg) => {
    if (msg.event === "connected") {
      setWsConnected(true);
      if (monitoringActive && msg.stats) {
        setStats(msg.stats);
      }
    } else if (msg.event === "new_incident") {
      if (!monitoringActive) {
        return;
      }
      setIncidents((prev) => {
        const existing = prev.find((incident) => incident.id === msg.incident.id);
        if (existing) {
          return prev.map((incident) => (incident.id === msg.incident.id ? msg.incident : incident));
        }
        return [msg.incident, ...prev].slice(0, 100);
      });
      if (msg.stats) {
        setStats(msg.stats);
      }
      setLatestAnalysis({ incident: msg.incident, coach: msg.coach });
    } else if (msg.event === "incident_resolved") {
      if (!monitoringActive) {
        return;
      }
      setIncidents((prev) =>
        prev.map((incident) => (incident.id === msg.incident_id ? { ...incident, resolved: true } : incident))
      );
      if (msg.stats) {
        setStats(msg.stats);
      }
    }
  }, [monitoringActive]);

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
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* ── Header ── */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐕</span>
          <h1 className="text-xl font-bold tracking-tight">Lance</h1>
          <span className="text-xs text-gray-400 mt-0.5 hidden sm:block">Workstation Safety Monitor</span>
        </div>

        <div className="flex items-center gap-4">
          {/* WS status dot */}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${wsConnected ? "bg-green-500" : "bg-gray-600 animate-pulse"}`} />
            <span className="text-xs text-gray-400 hidden sm:block">
              {wsConnected ? "Live" : "Connecting…"}
            </span>
          </div>

          {/* Unresolved badge */}
          {stats.unresolved > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
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
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className="px-2.5 py-1.5 rounded text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-800"
            title="Toggle light/dark theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 p-4">
        {tab === "Monitor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* Demo controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setDemoMode(d => !d)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                    demoMode ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  {demoMode ? "Exit Demo" : "Demo Mode"}
                </button>
                {demoMode && DEMO_SCENARIOS.map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => setDemoIndex(i)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      demoIndex === i
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <CameraFeed
                onAnalysis={setLatestAnalysis}
                onMonitoringChange={setMonitoringActive}
                demoAnalysis={demoMode ? DEMO_SCENARIOS[demoIndex] : null}
              />
              <CoachPanel analysis={latestAnalysis} />
            </div>
            <AlertPanel incidents={incidents} stats={stats} onResolveIncident={handleResolveIncident} />
          </div>
        )}
        {tab === "Worker Dashboard" && (
          <WorkerDashboard incidents={incidents} stats={stats} />
        )}
      </main>
    </div>
  );
}
