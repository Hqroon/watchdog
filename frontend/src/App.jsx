import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import CameraFeed from "./components/CameraFeed.jsx";
import WellnessPanel from "./components/WellnessPanel.jsx";
import CoachPanel from "./components/CoachPanel.jsx";
import SessionDashboard from "./components/SessionDashboard.jsx";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { getIncidents, getStats, resolveIncident } from "./api/gemini.js";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ActivityLogProvider, useActivityLog } from "./stores/activityLog.js";

const lanceLogo = "/logo.png";
const THEME_KEY = "lance-theme";
const ALERT_COOLDOWN_MS = 30_000;
const LOG_COOLDOWN_MS   = 6_000;

// ---------------------------------------------------------------------------
// Demo scenarios
// ---------------------------------------------------------------------------
const DEMO_SCENARIOS = [
  {
    label: "Good Session",
    presence: true,
    posture: { score: 85, status: "good", issues: [], description: "Upright seated position, good alignment" },
    eye_strain: { detected: false, severity: "none", description: "Eyes appear relaxed and normal distance from screen" },
    hydration: { water_visible: true, container_type: "water bottle", description: "Water bottle visible on desk" },
    focus_state: { state: "focused", confidence: 0.92, description: "Alert and engaged" },
    environment: { lighting: "good", monitor_position: "good", issues: [] },
    screen_proximity: { status: "safe", estimated_distance: "normal", face_fill_ratio: 0.25, description: "Good viewing distance maintained" },
    eye_openness: { status: "normal", openness_percent: 90, sore_eyes_likely: false, description: "Eyes wide open and alert" },
    overall_wellness: "good",
    frame_summary: "Good posture, hydrated, focused",
    time_based_alerts: [],
    session_stats: { session_duration_minutes: 12, avg_posture_score: 82, time_since_water_minutes: 3, presence_ratio: 0.95 },
  },
  {
    label: "Poor Posture",
    presence: true,
    posture: { score: 28, status: "poor", issues: ["forward head posture", "rounded shoulders", "slouching"], description: "Significant forward lean with rounded shoulders" },
    eye_strain: { detected: true, severity: "mild", description: "Slight squinting, leaning toward screen" },
    hydration: { water_visible: false, container_type: "none", description: "No water visible on desk" },
    focus_state: { state: "focused", confidence: 0.85, description: "Focused but tense posture" },
    environment: { lighting: "good", monitor_position: "too_low", issues: ["monitor too low causing neck strain"] },
    screen_proximity: { status: "too_close", estimated_distance: "very_close", face_fill_ratio: 0.52, description: "Face too close to screen" },
    eye_openness: { status: "partially_closed", openness_percent: 60, sore_eyes_likely: true, description: "Eyes partially closed from squinting at screen" },
    overall_wellness: "poor",
    frame_summary: "Poor posture with forward head, no water visible",
    time_based_alerts: [
      { type: "hydration", severity: "warning", message: "No water detected in the last 20 minutes — time to hydrate", category: "HYDRATION" },
      { type: "screen_proximity", severity: "warning", message: "You are too close to the screen — move back at least 50-70cm for healthy viewing distance", category: "EYE_HEALTH" },
    ],
    session_stats: { session_duration_minutes: 47, avg_posture_score: 45, time_since_water_minutes: 23, presence_ratio: 0.91 },
  },
  {
    label: "Drowsy",
    presence: true,
    posture: { score: 55, status: "warning", issues: ["head tilting forward"], description: "Head beginning to droop forward" },
    eye_strain: { detected: true, severity: "severe", description: "Eyes visibly drooping and half closed" },
    hydration: { water_visible: true, container_type: "glass", description: "Glass of water visible" },
    focus_state: { state: "drowsy", confidence: 0.89, description: "Eyelids heavy, head nodding" },
    environment: { lighting: "poor", monitor_position: "good", issues: ["dim lighting may be contributing to drowsiness"] },
    screen_proximity: { status: "safe", estimated_distance: "normal", face_fill_ratio: 0.30, description: "Viewing distance okay" },
    eye_openness: { status: "squinting", openness_percent: 25, sore_eyes_likely: true, description: "Eyes nearly closed from drowsiness" },
    overall_wellness: "poor",
    frame_summary: "User appears drowsy with heavy eyelids",
    time_based_alerts: [
      { type: "drowsy", severity: "critical", message: "You appear to be falling asleep — stand up, splash water on your face, or take a short break", category: "COLLAPSE_RISK" },
      { type: "eye_critical", severity: "critical", message: "Your eyes are nearly closed — rest your eyes immediately, look away from all screens", category: "EYE_HEALTH" },
    ],
    session_stats: { session_duration_minutes: 95, avg_posture_score: 61, time_since_water_minutes: 8, presence_ratio: 0.88 },
  },
  {
    label: "Overwork",
    presence: true,
    posture: { score: 62, status: "warning", issues: ["slight forward lean"], description: "Mild forward lean, showing fatigue" },
    eye_strain: { detected: true, severity: "mild", description: "Eyes slightly strained from prolonged screen use" },
    hydration: { water_visible: true, container_type: "water bottle", description: "Water bottle present" },
    focus_state: { state: "focused", confidence: 0.78, description: "Still focused but signs of fatigue" },
    environment: { lighting: "good", monitor_position: "good", issues: [] },
    screen_proximity: { status: "close", estimated_distance: "slightly_close", face_fill_ratio: 0.38, description: "Slightly close to screen" },
    eye_openness: { status: "partially_closed", openness_percent: 55, sore_eyes_likely: true, description: "Eyes partially closed from fatigue" },
    overall_wellness: "fair",
    frame_summary: "Extended session showing fatigue signs",
    time_based_alerts: [
      { type: "overwork", severity: "warning", message: "You have been working for over 2.5 hours — consider taking a proper break", category: "OVERWORK" },
      { type: "stand_up", severity: "info", message: "You have been sitting for 45 minutes — stand up and stretch for 2 minutes", category: "MOVEMENT" },
      { type: "eye_soreness", severity: "warning", message: "Your eyes appear sore or strained — try the 20-20-20 rule: look at something 20 feet away for 20 seconds", category: "EYE_HEALTH" },
    ],
    session_stats: { session_duration_minutes: 152, avg_posture_score: 68, time_since_water_minutes: 12, presence_ratio: 0.93 },
  },
  {
    label: "Sudden Absence",
    presence: false,
    posture: { score: 50, status: "good", issues: [], description: "No person detected" },
    eye_strain: { detected: false, severity: "none", description: "No person detected" },
    hydration: { water_visible: false, container_type: "none", description: "Empty desk" },
    focus_state: { state: "away", confidence: 1.0, description: "Seat is empty" },
    environment: { lighting: "good", monitor_position: "unknown", issues: [] },
    screen_proximity: { status: "safe", estimated_distance: "normal", face_fill_ratio: 0.0, description: "No person at desk" },
    eye_openness: { status: "normal", openness_percent: 80, sore_eyes_likely: false, description: "No person detected" },
    overall_wellness: "good",
    frame_summary: "No person detected at workstation",
    time_based_alerts: [{ type: "absence_alert", severity: "critical", message: "You suddenly disappeared from view — are you okay?", category: "COLLAPSE_RISK" }],
    session_stats: { session_duration_minutes: 67, avg_posture_score: 74, time_since_water_minutes: 5, presence_ratio: 0.94 },
  },
];

// ---------------------------------------------------------------------------
// Inner app — needs ActivityLogProvider in tree above it
// ---------------------------------------------------------------------------
function AppContent() {
  const [tab, setTab]           = useState("monitor");
  const [theme, setTheme]       = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; }
  });
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [timeAlerts, setTimeAlerts]         = useState([]);
  const [sessionStats, setSessionStats]     = useState({});
  const [postureHistory, setPostureHistory] = useState([]);
  const [incidents, setIncidents]   = useState([]);
  const [stats, setStats]           = useState({ total: 0, unresolved: 0, by_severity: { low: 0, medium: 0, high: 0 } });
  const [wsConnected, setWsConnected]       = useState(false);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [demoMode, setDemoMode]     = useState(false);
  const [demoIndex, setDemoIndex]   = useState(0);
  const [criticalFlash, setCriticalFlash]   = useState(false);

  const { logs, addLog, clearLogs } = useActivityLog();
  const recentAlerts = useRef(new Map());

  function shouldShowAlert(key, cooldownMs = ALERT_COOLDOWN_MS) {
    const last = recentAlerts.current.get(key);
    if (last && Date.now() - last < cooldownMs) return false;
    recentAlerts.current.set(key, Date.now());
    return true;
  }

  // Flash badge on new critical log entry
  useEffect(() => {
    if (logs[0]?.severity === "critical") {
      setCriticalFlash(true);
      const t = setTimeout(() => setCriticalFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [logs[0]?.severity, logs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fireToastsForAnalysis = useCallback((a, alerts) => {
    if (!a) return;

    for (const alert of (alerts ?? [])) {
      if (!shouldShowAlert(`ta:${alert.type}`)) continue;
      if (alert.category === "COLLAPSE_RISK") toast.error(alert.message);
      else if (alert.category === "OVERWORK" || alert.category === "POSTURE") toast.warning(alert.message);
      else if (alert.category === "EYE_HEALTH") {
        if (alert.severity === "critical") toast.error(alert.message);
        else toast.warning(alert.message);
      }
      else toast.info(alert.message);
    }

    if (a.focus_state?.state === "drowsy" && shouldShowAlert("drowsy")) {
      toast.error("Drowsiness detected — take a break");
    }
    if (a.posture?.status === "poor" && (a.posture?.score ?? 100) < 40 && shouldShowAlert("posture_poor")) {
      toast.warning(a.posture?.description || "Poor posture detected");
    }
    if (a.eye_strain?.severity === "severe" && shouldShowAlert("eye_severe")) {
      toast.warning("Severe eye strain detected — look away from screen");
    }
    if (a.screen_proximity?.status === "too_close" && shouldShowAlert("screen_too_close")) {
      toast.warning("You are too close to the screen — move back for eye health");
    }
    if (a.eye_openness?.sore_eyes_likely && shouldShowAlert("sore_eyes_detected")) {
      toast.warning("Your eyes appear sore — try the 20-20-20 rule");
    }
    if ((a.eye_openness?.openness_percent ?? 100) < 30 && shouldShowAlert("eye_critical")) {
      toast.error("Your eyes are nearly closed — rest your eyes immediately");
    }
    if (a.overall_wellness === "poor" && shouldShowAlert("wellness_poor")) {
      toast.error("Poor wellness detected: " + (a.frame_summary ?? ""));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fireLogsForAnalysis = useCallback((a, timeAlertsList) => {
    if (!a) return;

    const posture   = a.posture          ?? {};
    const eyeStrain = a.eye_strain       ?? {};
    const eyeOpen   = a.eye_openness     ?? {};
    const prox      = a.screen_proximity ?? {};
    const focus     = a.focus_state      ?? {};
    const hydration = a.hydration        ?? {};
    const wellness  = a.overall_wellness ?? "good";
    const presence  = a.presence         ?? false;
    const summary   = a.frame_summary    ?? "";

    // POSTURE
    if (posture.status === "good" && (posture.score ?? 0) >= 80) {
      addLog("POSTURE", "good", "Good posture", posture.description);
    } else if (posture.status === "warning") {
      if (shouldShowAlert("log_Posture warning", LOG_COOLDOWN_MS))
        addLog("POSTURE", "warning", "Posture warning", posture.description);
      (posture.issues ?? []).forEach(issue => {
        if (shouldShowAlert("log_" + issue, LOG_COOLDOWN_MS))
          addLog("POSTURE", "warning", issue, posture.description);
      });
    } else if (posture.status === "poor") {
      if (shouldShowAlert("log_Poor posture detected", LOG_COOLDOWN_MS))
        addLog("POSTURE", "critical", "Poor posture detected", posture.description);
      (posture.issues ?? []).forEach(issue => {
        if (shouldShowAlert("log_" + issue, LOG_COOLDOWN_MS))
          addLog("POSTURE", "critical", issue, posture.description);
      });
    }

    // EYE STRAIN
    if (eyeStrain.severity === "mild") {
      if (shouldShowAlert("log_Mild eye strain", LOG_COOLDOWN_MS))
        addLog("EYE_STRAIN", "warning", "Mild eye strain", eyeStrain.description);
    } else if (eyeStrain.severity === "severe") {
      if (shouldShowAlert("log_Severe eye strain", LOG_COOLDOWN_MS))
        addLog("EYE_STRAIN", "critical", "Severe eye strain", eyeStrain.description);
    }

    // EYE OPENNESS
    if (eyeOpen.sore_eyes_likely) {
      if (shouldShowAlert("log_Sore eyes detected", LOG_COOLDOWN_MS))
        addLog("EYE_HEALTH", "warning", "Sore eyes detected", eyeOpen.description);
    }
    if ((eyeOpen.openness_percent ?? 100) < 30) {
      const t = `Eyes nearly closed — ${eyeOpen.openness_percent ?? 0}% open`;
      if (shouldShowAlert("log_" + t, LOG_COOLDOWN_MS))
        addLog("EYE_HEALTH", "critical", t, eyeOpen.description);
    }
    if (eyeOpen.status === "squinting") {
      const t = `Squinting detected — ${eyeOpen.openness_percent ?? 0}% eye openness`;
      if (shouldShowAlert("log_" + t, LOG_COOLDOWN_MS))
        addLog("EYE_HEALTH", "warning", t, eyeOpen.description);
    }

    // SCREEN PROXIMITY
    if (prox.status === "too_close") {
      if (shouldShowAlert("log_Too close to screen", LOG_COOLDOWN_MS))
        addLog("SCREEN_DISTANCE", "warning", "Too close to screen", prox.description);
    } else if (prox.status === "close") {
      if (shouldShowAlert("log_Slightly close to screen", LOG_COOLDOWN_MS))
        addLog("SCREEN_DISTANCE", "info", "Slightly close to screen", prox.description);
    }

    // FOCUS
    if (focus.state === "drowsy") {
      if (shouldShowAlert("log_Drowsiness detected", LOG_COOLDOWN_MS))
        addLog("DROWSINESS", "critical", "Drowsiness detected", focus.description);
    } else if (focus.state === "distracted") {
      if (shouldShowAlert("log_Distraction detected", LOG_COOLDOWN_MS))
        addLog("FOCUS", "info", "Distraction detected", focus.description);
    }

    // HYDRATION
    if (!hydration.water_visible) {
      if (shouldShowAlert("log_No water visible", LOG_COOLDOWN_MS))
        addLog("HYDRATION", "info", "No water visible", hydration.description);
    } else {
      addLog("HYDRATION", "good", `Water visible — ${hydration.container_type ?? ""}`, hydration.description);
    }

    // WELLNESS
    if (wellness === "poor") {
      if (shouldShowAlert("log_Poor overall wellness", LOG_COOLDOWN_MS))
        addLog("WELLNESS", "critical", "Poor overall wellness", summary);
    } else if (wellness === "good" && presence) {
      addLog("WELLNESS", "good", "Wellness check passed", summary);
    }

    // TIME-BASED ALERTS
    for (const item of (timeAlertsList ?? [])) {
      const title = item.type.replace(/_/g, " ");
      if (shouldShowAlert("log_ta_" + title, LOG_COOLDOWN_MS))
        addLog(item.category, item.severity, title, item.message);
    }
  }, [addLog]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshDashboard = useCallback(async () => {
    const [incidentData, statsData] = await Promise.all([getIncidents(100), getStats()]);
    setIncidents(incidentData);
    setStats(statsData);
  }, []);

  useEffect(() => { refreshDashboard().catch(() => {}); }, [refreshDashboard]);

  useEffect(() => {
    if (!monitoringActive) return;
    refreshDashboard().catch(() => {});
  }, [monitoringActive, refreshDashboard]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
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

  const handleWsMessage = useCallback((msg) => {
    if (msg.event === "connected") {
      setWsConnected(true);
      if (monitoringActive && msg.stats) setStats(msg.stats);
    } else if (msg.event === "new_incident") {
      if (!monitoringActive) return;
      setIncidents((prev) => {
        const existing = prev.find((i) => i.id === msg.incident.id);
        if (existing) return prev.map((i) => (i.id === msg.incident.id ? msg.incident : i));
        return [msg.incident, ...prev].slice(0, 100);
      });
      if (msg.stats) setStats(msg.stats);
    } else if (msg.event === "incident_resolved") {
      if (!monitoringActive) return;
      setIncidents((prev) =>
        prev.map((i) => (i.id === msg.incident_id ? { ...i, resolved: true } : i))
      );
      if (msg.stats) setStats(msg.stats);
    }
  }, [monitoringActive]);

  const handleAnalysis = useCallback((result) => {
    if (!result) {
      setLatestAnalysis(null);
      setTimeAlerts([]);
      return;
    }
    if (result.networkError) {
      addLog("SYSTEM", "critical", "Analysis failed", "Could not reach backend — check connection");
      return;
    }
    const { analysis, timeAlerts: ta = [], sessionStats: ss = {}, incident, coach } = result;
    setLatestAnalysis({ analysis, incident, coach });
    setTimeAlerts(ta);
    setSessionStats(ss);
    setPostureHistory(prev => [...prev, analysis?.posture?.score ?? 50].slice(-20));
    fireToastsForAnalysis(analysis, ta);
    fireLogsForAnalysis(analysis, ta);
  }, [fireToastsForAnalysis, fireLogsForAnalysis, addLog]);

  const handleResolveIncident = useCallback(async (incidentId) => {
    const result = await resolveIncident(incidentId);
    if (result.incident) {
      setIncidents((prev) => prev.map((i) => (i.id === incidentId ? result.incident : i)));
    }
    if (result.stats) setStats(result.stats);
    else refreshDashboard().catch(() => {});
    return result;
  }, [refreshDashboard]);

  const handleResetSession = useCallback(() => {
    setIncidents([]);
    setStats({ total: 0, unresolved: 0, by_severity: { low: 0, medium: 0, high: 0 } });
    setSessionStats({});
    setPostureHistory([]);
    setTimeAlerts([]);
    setLatestAnalysis(null);
    clearLogs();
  }, [clearLogs]);

  const wsRef = useWebSocket("/ws", handleWsMessage);
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const onClose = () => setWsConnected(false);
    ws.addEventListener("close", onClose);
    return () => ws.removeEventListener("close", onClose);
  }, [wsRef]);

  // Demo: fire toasts and logs on scenario switch
  const prevDemoIndex = useRef(null);
  useEffect(() => {
    if (!demoMode) return;
    if (prevDemoIndex.current === demoIndex) return;
    prevDemoIndex.current = demoIndex;
    const scenario = DEMO_SCENARIOS[demoIndex];
    recentAlerts.current.clear();
    fireToastsForAnalysis(scenario, scenario.time_based_alerts);
    fireLogsForAnalysis(scenario, scenario.time_based_alerts);
  }, [demoMode, demoIndex, fireToastsForAnalysis, fireLogsForAnalysis]);

  const demoScenario       = demoMode ? DEMO_SCENARIOS[demoIndex] : null;
  const displayAnalysis    = demoScenario ?? latestAnalysis?.analysis ?? null;
  const displayTimeAlerts  = demoScenario ? demoScenario.time_based_alerts : timeAlerts;
  const displaySessionStats = demoScenario ? demoScenario.session_stats : sessionStats;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-border bg-background">
        <div className="flex items-center justify-between h-14 px-4">
          <a href="/landing.html" className="flex items-center gap-2 shrink-0 no-underline hover:opacity-80 transition-opacity">
            <img
              src={lanceLogo}
              alt="Lance logo"
              className="h-8 w-8 rounded-full object-cover ring-1 ring-border"
            />
            <span className="text-lg font-semibold tracking-tight text-foreground">Lance</span>
            <span className="text-xs text-muted-foreground hidden sm:block">Personal Wellness Monitor</span>
          </a>

          <Tabs value={tab} onValueChange={setTab} className="hidden sm:flex">
            <TabsList>
              <TabsTrigger value="monitor">Live Monitor</TabsTrigger>
              <TabsTrigger value="session">Session</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {/* Live event counter */}
            {logs.length > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "transition-colors duration-500 tabular-nums",
                  criticalFlash && "bg-destructive text-destructive-foreground"
                )}
              >
                {logs.length} events
              </Badge>
            )}

            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${wsConnected ? "bg-green-500" : "bg-muted-foreground animate-pulse"}`} />
              <span className="text-xs text-muted-foreground hidden sm:block">
                {wsConnected ? "Live" : "Connecting…"}
              </span>
            </div>

            {stats.unresolved > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {stats.unresolved} OPEN
              </Badge>
            )}

            <Button
              variant={demoMode ? "default" : "outline"}
              size="sm"
              onClick={() => setDemoMode(d => !d)}
            >
              {demoMode ? "Exit Demo" : "Demo"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </Button>
          </div>
        </div>

        <div className="sm:hidden px-4 pb-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="monitor" className="flex-1">Monitor</TabsTrigger>
              <TabsTrigger value="session" className="flex-1">Session</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 p-4">
        {tab === "monitor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4">
              {demoMode && (
                <div className="flex items-center gap-2 flex-wrap">
                  {DEMO_SCENARIOS.map((s, i) => (
                    <Button
                      key={s.label}
                      variant={demoIndex === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDemoIndex(i)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              )}
              <CameraFeed
                onAnalysis={handleAnalysis}
                onMonitoringChange={setMonitoringActive}
                demoAnalysis={demoScenario}
              />
              <CoachPanel analysis={latestAnalysis} />
            </div>
            <WellnessPanel
              analysis={displayAnalysis}
              timeAlerts={displayTimeAlerts}
              sessionStats={displaySessionStats}
            />
          </div>
        )}
        {tab === "session" && (
          <SessionDashboard
            incidents={incidents}
            stats={stats}
            sessionStats={displaySessionStats}
            postureHistory={postureHistory}
            onResetSession={handleResetSession}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ActivityLogProvider>
      <AppContent />
    </ActivityLogProvider>
  );
}
