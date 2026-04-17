import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CameraFeed from "./components/CameraFeed.jsx";
import AlertPanel from "./components/AlertPanel.jsx";
import CoachPanel from "./components/CoachPanel.jsx";
import SupervisorDashboard from "./components/SupervisorDashboard.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { getIncidents } from "./api/gemini.js";

const TABS = ["Monitor", "Supervisor"];

const DEMO_SCENARIOS = [
  {
    label: "Hazard",
    overall_risk: "high",
    frame_summary: "Liquid spill near workstation creating a slip hazard.",
    posture_issues: [],
    housekeeping_issues: [{ issue: "liquid spill", severity: "critical", description: "Slip hazard near operator position" }],
    detections: [
      { category: "PERSON",  label: "operator",    confidence: 0.96, box: { x: 0.1, y: 0.05, w: 0.35, h: 0.8  }, severity: "ok"       },
      { category: "HAZARDS", label: "liquid spill", confidence: 0.91, box: { x: 0.0, y: 0.75, w: 0.5,  h: 0.2  }, severity: "critical" },
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
      { category: "WIRES_CABLES", label: "loose cable", confidence: 0.88, box: { x: 0.05, y: 0.72, w: 0.45, h: 0.18 }, severity: "warning"  },
      { category: "FOOD_DRINK",   label: "coffee cup",  confidence: 0.93, box: { x: 0.74, y: 0.28, w: 0.14, h: 0.22 }, severity: "critical" },
      { category: "PERSON",       label: "operator",    confidence: 0.96, box: { x: 0.3,  y: 0.08, w: 0.35, h: 0.78 }, severity: "ok"       },
    ],
  },
  {
    label: "All Clear",
    overall_risk: "low",
    frame_summary: "Workstation clear. No hazards detected.",
    posture_issues: [],
    housekeeping_issues: [],
    detections: [
      { category: "PERSON",     label: "operator",     confidence: 0.96, box: { x: 0.3,  y: 0.1, w: 0.35, h: 0.75 }, severity: "ok" },
      { category: "COMPONENTS", label: "PCB assembly", confidence: 0.92, box: { x: 0.55, y: 0.4, w: 0.3,  h: 0.25 }, severity: "ok" },
      { category: "TOOLS",      label: "screwdriver",  confidence: 0.84, box: { x: 0.72, y: 0.6, w: 0.1,  h: 0.18 }, severity: "ok" },
    ],
  },
  {
    label: "Multi Violation",
    overall_risk: "high",
    frame_summary: "Multiple critical violations: exposed wiring and drink near components.",
    posture_issues: [],
    housekeeping_issues: [
      { issue: "exposed wiring",               severity: "critical", description: "Electrical hazard at workstation" },
      { issue: "drink bottle near components", severity: "critical", description: "Liquid contamination risk" },
    ],
    detections: [
      { category: "PERSON",       label: "operator",       confidence: 0.97, box: { x: 0.15, y: 0.05, w: 0.4,  h: 0.8  }, severity: "ok"       },
      { category: "WIRES_CABLES", label: "exposed wiring", confidence: 0.85, box: { x: 0.6,  y: 0.6,  w: 0.3,  h: 0.25 }, severity: "critical" },
      { category: "FOOD_DRINK",   label: "drink bottle",   confidence: 0.9,  box: { x: 0.7,  y: 0.2,  w: 0.1,  h: 0.25 }, severity: "critical" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Protected route wrapper
// ---------------------------------------------------------------------------
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <span className="h-6 w-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ---------------------------------------------------------------------------
// User menu
// ---------------------------------------------------------------------------
function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen]  = useState(false);
  const initials = (user?.display_name ?? "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 hover:bg-gray-800 rounded-lg px-2 py-1 transition-colors"
      >
        <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
        <span className="text-sm text-gray-300 hidden sm:block">{user?.display_name}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px] z-50">
            <p className="px-3 py-2 text-xs text-gray-500 truncate">Signed in as {user?.email}</p>
            <div className="border-t border-gray-700 my-1" />
            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app (protected)
// ---------------------------------------------------------------------------
function MainApp() {
  const [tab, setTab]                       = useState("Monitor");
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [incidents, setIncidents]           = useState([]);
  const [stats, setStats]                   = useState({ total: 0, unresolved: 0, by_severity: { low: 0, medium: 0, high: 0 } });
  const [wsConnected, setWsConnected]       = useState(false);
  const [demoMode, setDemoMode]             = useState(false);
  const [demoIndex, setDemoIndex]           = useState(0);

  useEffect(() => {
    getIncidents(100).then(setIncidents).catch(() => {});
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

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const onClose = () => setWsConnected(false);
    ws.addEventListener("close", onClose);
    return () => ws.removeEventListener("close", onClose);
  }, [wsRef]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐕</span>
          <h1 className="text-xl font-bold tracking-tight">WatchDog</h1>
          <span className="text-xs text-gray-400 mt-0.5 hidden sm:block">Workstation Safety Monitor</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${wsConnected ? "bg-green-500" : "bg-gray-600 animate-pulse"}`} />
            <span className="text-xs text-gray-400 hidden sm:block">{wsConnected ? "Live" : "Connecting…"}</span>
          </div>

          {stats.unresolved > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {stats.unresolved} OPEN
            </span>
          )}

          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  tab === t ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}>
                {t}
              </button>
            ))}
          </nav>

          <UserMenu />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        {tab === "Monitor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setDemoMode((d) => !d)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                    demoMode ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}>
                  {demoMode ? "Exit Demo" : "Demo Mode"}
                </button>
                {demoMode && DEMO_SCENARIOS.map((s, i) => (
                  <button key={s.label} onClick={() => setDemoIndex(i)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      demoIndex === i ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <CameraFeed
                onAnalysis={setLatestAnalysis}
                demoAnalysis={demoMode ? DEMO_SCENARIOS[demoIndex] : null}
              />
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

// ---------------------------------------------------------------------------
// Root with router + auth
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
