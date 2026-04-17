import { useState, useCallback } from "react";
import { useCamera } from "../hooks/useCamera.js";
import { analyzeFrame } from "../api/gemini.js";
import { BUTTON, SEVERITY, SURFACE } from "../ui/tokens.js";

const INTERVAL_MS = 3000;

const CATEGORY_ICON = {
  PPE:          "🦺",
  posture:      "🧍",
  proximity:    "⚠️",
  housekeeping: "🧹",
  tool_use:     "🔧",
  none:         "✅",
};

export default function CameraFeed({ onAnalysis }) {
  const [status, setStatus]       = useState("idle");
  const [hazard, setHazard]       = useState(null);   // latest unsafe analysis
  const [analyzing, setAnalyzing] = useState(false);

  const handleFrame = useCallback(async (dataUrl) => {
    setAnalyzing(true);
    try {
      const result = await analyzeFrame(dataUrl);
      const analysis = result.analysis ?? {};
      if (!analysis.safe) {
        setHazard(analysis);
        setStatus("warning");
      } else {
        setHazard(null);
        setStatus("safe");
      }
      onAnalysis?.(result);
    } catch {
      setStatus("error");
    } finally {
      setAnalyzing(false);
    }
  }, [onAnalysis]);

  const { videoRef, isActive, error, startCamera, stopCamera } = useCamera(INTERVAL_MS);

  const toggle = () => {
    if (isActive) { stopCamera(); setStatus("idle"); setHazard(null); }
    else          { startCamera(handleFrame); }
  };

  const sev    = hazard?.severity ?? "low";
  const styles = SEVERITY[sev] ?? SEVERITY.low;

  return (
    <div className={`${SURFACE.card} overflow-hidden flex flex-col`}>
      {/* Video wrapper */}
      <div className={`relative border-4 transition-colors duration-500 ${isActive ? styles.border : "border-gray-700"}`}>
        <video
          ref={videoRef}
          className="w-full aspect-video object-cover bg-black"
          muted
          playsInline
        />

        {/* Camera-off overlay */}
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2">
            <span className="text-4xl">📷</span>
            <p className={`text-sm ${SURFACE.mutedText}`}>Camera is off</p>
          </div>
        )}

        {/* ── LIVE indicator ── */}
        {isActive && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-1">
            <span className={`h-2 w-2 rounded-full ${analyzing ? "bg-yellow-400 animate-pulse" : "bg-red-500 animate-ping"}`} />
            <span className="text-xs font-bold text-white tracking-widest">
              {analyzing ? "ANALYZING" : "LIVE"}
            </span>
          </div>
        )}

        {/* ── Hazard overlay box ── */}
        {isActive && hazard && (
          <div className={`absolute bottom-0 left-0 right-0 bg-black/75 backdrop-blur-sm border-t-2 ${styles.border} px-4 py-3`}>
            <div className="flex items-start gap-3">
              {/* Category icon */}
              <span className="text-2xl mt-0.5 shrink-0">
                {CATEGORY_ICON[hazard.category] ?? "⚠️"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${styles.badge}`}>
                    {hazard.severity}
                  </span>
                  <span className="text-xs text-gray-300 capitalize font-medium">
                    {hazard.category?.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-white leading-snug line-clamp-2">
                  {hazard.description}
                </p>
                {hazard.recommendations?.length > 0 && (
                  <p className={`text-xs mt-1 truncate ${SURFACE.mutedText}`}>
                    ↳ {hazard.recommendations[0]}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Safe indicator (brief) ── */}
        {isActive && status === "safe" && !hazard && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 bg-green-900/70 border border-green-600 rounded-lg px-3 py-1.5">
            <span className="text-green-400 text-sm">✅</span>
            <span className="text-xs text-green-300 font-medium">Workstation is safe</span>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="absolute bottom-2 left-2 bg-red-900/80 border border-red-600 rounded px-3 py-1.5">
            <p className="text-xs text-red-300">Analysis failed — retrying…</p>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className={`text-xs ${SURFACE.mutedText}`}>
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : isActive ? (
            `Scanning every ${INTERVAL_MS / 1000}s`
          ) : (
            "Click Start to begin monitoring"
          )}
        </p>
        <button
          onClick={toggle}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            isActive
              ? BUTTON.danger
              : BUTTON.primary
          }`}
        >
          {isActive ? "Stop" : "Start Monitoring"}
        </button>
      </div>
    </div>
  );
}
