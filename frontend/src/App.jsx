import { useEffect, useState } from "react";
import CameraFeed from "./components/CameraFeed.jsx";
import AlertPanel from "./components/AlertPanel.jsx";
import CoachPanel from "./components/CoachPanel.jsx";
import WorkerDashboard from "./components/WorkerDashboard.jsx";
import lanceLogo from "./assets/lance-logo.png";
import { useWatchdogMonitor } from "./hooks/useWatchdogMonitor.js";
import { BUTTON, STATUS, SURFACE } from "./ui/tokens.js";
import Badge from "./ui/Badge.jsx";
import StatusDot from "./ui/StatusDot.jsx";

const TABS = [
  { value: "monitor", label: "Monitor" },
  { value: "dashboard", label: "Worker Dashboard" },
];

const THEME_KEY = "lance-theme";

const DEMO_SCENARIOS = [
  {
    label: "Hazard",
    overall_risk: "high",
    frame_summary: "Liquid spill near workstation creating a slip hazard.",
    posture_issues: [],
    housekeeping_issues: [{ issue: "liquid spill", severity: "critical", description: "Slip hazard near operator position" }],
    detections: [
      { category: "PERSON", label: "operator", confidence: 0.96, box: { x: 0.1, y: 0.05, w: 0.35, h: 0.8 }, severity: "ok" },
      { category: "HAZARDS", label: "liquid spill", confidence: 0.91, box: { x: 0.0, y: 0.75, w: 0.5, h: 0.2 }, severity: "critical" },
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
      { category: "WIRES_CABLES", label: "loose cable", confidence: 0.88, box: { x: 0.05, y: 0.72, w: 0.45, h: 0.18 }, severity: "warning" },
      { category: "FOOD_DRINK", label: "coffee cup", confidence: 0.93, box: { x: 0.74, y: 0.28, w: 0.14, h: 0.22 }, severity: "critical" },
      { category: "PERSON", label: "operator", confidence: 0.96, box: { x: 0.3, y: 0.08, w: 0.35, h: 0.78 }, severity: "ok" },
    ],
  },
  {
    label: "All Clear",
    overall_risk: "low",
    frame_summary: "Workstation clear. No hazards detected.",
    posture_issues: [],
    housekeeping_issues: [],
    detections: [
      { category: "PERSON", label: "operator", confidence: 0.96, box: { x: 0.3, y: 0.1, w: 0.35, h: 0.75 }, severity: "ok" },
      { category: "COMPONENTS", label: "PCB assembly", confidence: 0.92, box: { x: 0.55, y: 0.4, w: 0.3, h: 0.25 }, severity: "ok" },
      { category: "TOOLS", label: "screwdriver", confidence: 0.84, box: { x: 0.72, y: 0.6, w: 0.1, h: 0.18 }, severity: "ok" },
    ],
  },
  {
    label: "Multi Violation",
    overall_risk: "high",
    frame_summary: "Multiple critical violations: exposed wiring and drink near components.",
    posture_issues: [],
    housekeeping_issues: [
      { issue: "exposed wiring", severity: "critical", description: "Electrical hazard at workstation" },
      { issue: "drink bottle near components", severity: "critical", description: "Liquid contamination risk" },
    ],
    detections: [
      { category: "PERSON", label: "operator", confidence: 0.97, box: { x: 0.15, y: 0.05, w: 0.4, h: 0.8 }, severity: "ok" },
      { category: "WIRES_CABLES", label: "exposed wiring", confidence: 0.85, box: { x: 0.6, y: 0.6, w: 0.3, h: 0.25 }, severity: "critical" },
      { category: "FOOD_DRINK", label: "drink bottle", confidence: 0.9, box: { x: 0.7, y: 0.2, w: 0.1, h: 0.25 }, severity: "critical" },
    ],
  },
];

export default function App() {
  const [tab, setTab] = useState("monitor");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "dark";
    } catch {
      return "dark";
    }
  });
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);

  const {
    incidents,
    latestAnalysis,
    stats,
    wsConnected,
    handleAnalysis,
    handleResolveIncident,
  } = useWatchdogMonitor({ limit: 100, monitoringActive });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

  useEffect(() => {
    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.setAttribute("rel", "icon");
      document.head.appendChild(favicon);
    }
    favicon.setAttribute("type", "image/png");
    favicon.setAttribute("href", lanceLogo);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col ${SURFACE.app}`}>
      <header className={`border-b ${SURFACE.sectionBorder} bg-background`}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={lanceLogo}
              alt="Lance logo"
              className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Lance</h1>
              <p className={`hidden text-xs sm:block ${SURFACE.mutedText}`}>Workstation Safety Monitor</p>
            </div>
          </div>

          <nav className="flex w-full gap-1 sm:w-auto">
            {TABS.map((item) => (
              <button
                key={item.value}
                onClick={() => setTab(item.value)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                  tab === item.value ? BUTTON.tabActive : BUTTON.primaryGhost
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <StatusDot className={wsConnected ? STATUS.liveDot : STATUS.connectingDot} />
              <span className={`hidden text-xs sm:block ${SURFACE.mutedText}`}>
                {wsConnected ? "Live" : "Connecting…"}
              </span>
            </div>

            {stats.unresolved > 0 && (
              <Badge className={`${STATUS.openBadge} animate-pulse`}>
                {stats.unresolved} OPEN
              </Badge>
            )}

            <button
              onClick={() => setDemoMode((value) => !value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                demoMode ? BUTTON.tabActive : "bg-muted text-foreground hover:bg-accent"
              }`}
            >
              {demoMode ? "Exit Demo" : "Demo"}
            </button>

            <button
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Toggle light/dark theme"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-5">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          {tab === "monitor" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)] xl:items-start">
              <div className="flex min-w-0 flex-col gap-4">
                {demoMode && (
                  <div className="flex flex-wrap items-center gap-2">
                    {DEMO_SCENARIOS.map((scenario, index) => (
                      <button
                        key={scenario.label}
                        onClick={() => setDemoIndex(index)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          demoIndex === index ? BUTTON.tabActive : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {scenario.label}
                      </button>
                    ))}
                  </div>
                )}

                <CameraFeed
                  onAnalysis={handleAnalysis}
                  onMonitoringChange={setMonitoringActive}
                  demoAnalysis={demoMode ? DEMO_SCENARIOS[demoIndex] : null}
                />
                <CoachPanel analysis={latestAnalysis} />
              </div>

              <div className="min-w-0">
                <AlertPanel
                  incidents={incidents}
                  stats={stats}
                  onResolveIncident={handleResolveIncident}
                />
              </div>
            </div>
          )}

          {tab === "dashboard" && (
            <WorkerDashboard incidents={incidents} stats={stats} />
          )}
        </div>
      </main>
    </div>
  );
}
