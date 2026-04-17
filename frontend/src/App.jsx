import { useState } from "react";
import CameraFeed from "./components/CameraFeed.jsx";
import AlertPanel from "./components/AlertPanel.jsx";
import CoachPanel from "./components/CoachPanel.jsx";
import SupervisorDashboard from "./components/SupervisorDashboard.jsx";
import { useWatchdogMonitor } from "./hooks/useWatchdogMonitor.js";
import { BUTTON, STATUS, SURFACE } from "./ui/tokens.js";
import Badge from "./ui/Badge.jsx";
import StatusDot from "./ui/StatusDot.jsx";

const TABS = ["Monitor", "Supervisor"];

export default function App() {
  const [tab, setTab] = useState("Monitor");
  const { incidents, latestAnalysis, stats, wsConnected, handleAnalysis } = useWatchdogMonitor();

  return (
    <div className={`min-h-screen flex flex-col ${SURFACE.app}`}>
      {/* ── Header ── */}
      <header className={`${SURFACE.card} rounded-none border-x-0 border-t-0 px-4 py-3 sm:px-6`}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐕</span>
          <h1 className="text-xl font-bold tracking-tight">WatchDog</h1>
          <span className={`text-xs mt-0.5 hidden sm:block ${SURFACE.mutedText}`}>Workstation Safety Monitor</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* WS status dot */}
          <div className="flex items-center gap-1.5">
            <StatusDot className={wsConnected ? STATUS.liveDot : STATUS.connectingDot} />
            <span className={`text-xs hidden sm:block ${SURFACE.mutedText}`}>
              {wsConnected ? "Live" : "Connecting…"}
            </span>
          </div>

          {/* Unresolved badge */}
          {stats.unresolved > 0 && (
            <Badge className={`${STATUS.openBadge} animate-pulse`}>
              {stats.unresolved} OPEN
            </Badge>
          )}

          {/* Tab bar */}
          <nav className="flex w-full gap-1 sm:w-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors sm:flex-none ${
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
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 p-4 sm:p-5">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        {tab === "Monitor" && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)] xl:items-start">
            <div className="flex min-w-0 flex-col gap-4">
              <CameraFeed onAnalysis={handleAnalysis} />
              <CoachPanel analysis={latestAnalysis} />
            </div>
            <div className="min-w-0">
              <AlertPanel incidents={incidents} stats={stats} />
            </div>
          </div>
        )}
        {tab === "Supervisor" && (
          <SupervisorDashboard incidents={incidents} stats={stats} />
        )}
        </div>
      </main>
    </div>
  );
}
