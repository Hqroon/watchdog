import { useState, useCallback, useRef, useEffect } from "react";
import { useCamera } from "../hooks/useCamera.js";
import { analyzeFrame } from "../api/gemini.js";
import { BUTTON, SEVERITY, SURFACE } from "../ui/tokens.js";
import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";

const INTERVAL_MS = 3000;

const CAT_COLOR = {
  PERSON: "#378ADD",
  FOOD_DRINK: "#E24B4A",
  WIRES_CABLES: "#EF9F27",
  TOOLS: "#7F77DD",
  COMPONENTS: "#1D9E75",
  HAZARDS: "#E24B4A",
  FIRE_EXIT: "#639922",
};

const PULSE_CATS = new Set(["HAZARDS", "FOOD_DRINK"]);

const LEGEND_ITEMS = [
  { color: "#378ADD", label: "Person" },
  { color: "#E24B4A", label: "Food/Drink" },
  { color: "#EF9F27", label: "Wires/Cables" },
  { color: "#7F77DD", label: "Tools" },
  { color: "#1D9E75", label: "Components" },
  { color: "#E24B4A", label: "Hazard" },
  { color: "#639922", label: "Fire Exit" },
];

function boxColor(det) {
  if (det.category === "FIRE_EXIT") {
    return det.severity === "critical" ? "#E24B4A" : "#639922";
  }
  return CAT_COLOR[det.category] ?? "#ffffff";
}

function hazardFromAnalysis(analysis) {
  const risk = analysis?.overall_risk ?? "low";
  if (risk === "low") return null;
  const posture = analysis?.posture_issues ?? [];
  const housekeeping = analysis?.housekeeping_issues ?? [];
  const category = posture.length ? "posture" : housekeeping.length ? "housekeeping" : "risk";
  const recommendations = [...posture, ...housekeeping]
    .map((item) => item.description)
    .filter(Boolean);

  return {
    severity: risk,
    category,
    description: analysis?.frame_summary ?? "",
    recommendations,
  };
}

export default function CameraFeed({ onAnalysis, onMonitoringChange, demoAnalysis }) {
  const [status, setStatus] = useState("idle");
  const [hazard, setHazard] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detections, setDetections] = useState([]);
  const [vidW, setVidW] = useState(0);
  const [vidH, setVidH] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const containerRef = useRef(null);
  const abortRef = useRef(null);
  const sessionRef = useRef(0);
  const activeRef = useRef(false);
  const { videoRef, isActive, error, startCamera, stopCamera } = useCamera(INTERVAL_MS);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const obs = new ResizeObserver(([entry]) => {
      setVidW(entry.contentRect.width);
      setVidH(entry.contentRect.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!demoAnalysis) return;
    setDetections(demoAnalysis.detections ?? []);
    setHazard(hazardFromAnalysis(demoAnalysis));
    setStatus(demoAnalysis.overall_risk === "low" ? "safe" : "warning");
  }, [demoAnalysis]);

  useEffect(() => {
    activeRef.current = isActive;
    onMonitoringChange?.(isActive);
  }, [isActive, onMonitoringChange]);

  const handleFrame = useCallback(async (dataUrl) => {
    const sessionId = sessionRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setAnalyzing(true);

    try {
      const result = await analyzeFrame(dataUrl, controller.signal);
      if (controller.signal.aborted || sessionId !== sessionRef.current || !activeRef.current) {
        return;
      }

      const analysis = result.analysis ?? {};
      setDetections(analysis.detections ?? []);
      const nextHazard = hazardFromAnalysis(analysis);
      setHazard(nextHazard);
      setStatus(nextHazard ? "warning" : "safe");
      onAnalysis?.({ incident: result.incident ?? null, coach: result.coach ?? null });
    } catch (requestError) {
      if (requestError?.name === "AbortError" || sessionId !== sessionRef.current) {
        return;
      }
      setStatus("error");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (sessionId === sessionRef.current) {
        setAnalyzing(false);
      }
    }
  }, [onAnalysis]);

  const toggle = () => {
    if (isActive) {
      sessionRef.current += 1;
      abortRef.current?.abort();
      stopCamera();
      setStatus("idle");
      setHazard(null);
      setDetections([]);
      setAnalyzing(false);
      onAnalysis?.(null);
    } else {
      sessionRef.current += 1;
      startCamera(handleFrame);
    }
  };

  const sev = hazard?.severity ?? "low";
  const styles = SEVERITY[sev] ?? SEVERITY.low;
  const showFeed = isActive || !!demoAnalysis;
  const activeDetections = demoAnalysis ? (demoAnalysis.detections ?? []) : detections;

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className={`border-b px-4 py-3 ${SURFACE.sectionBorder}`}>
        <SectionHeader
          title="Live Monitor"
          subtitle={isActive ? `Scanning every ${INTERVAL_MS / 1000}s` : "Start monitoring to begin live workstation analysis."}
          action={
            <Badge className={isActive ? "bg-red-950 text-red-200" : "bg-gray-800 text-gray-300"}>
              {isActive ? "Camera On" : demoAnalysis ? "Demo Mode" : "Camera Off"}
            </Badge>
          }
        />
      </div>

      <div
        ref={containerRef}
        className={`relative border-4 transition-colors duration-500 ${showFeed ? styles.border : "border-gray-700"}`}
      >
        <video
          ref={videoRef}
          className="w-full aspect-video object-cover bg-black"
          muted
          playsInline
        />

        {!isActive && !demoAnalysis && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2">
            <span className="text-4xl">📷</span>
            <p className={`text-sm ${SURFACE.mutedText}`}>Camera is off</p>
          </div>
        )}

        {demoAnalysis && !isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 gap-2">
            <span className="text-4xl">🎬</span>
            <p className="text-gray-300 text-sm font-medium">Demo Mode</p>
            <p className="text-gray-500 text-xs text-center px-4">{demoAnalysis.frame_summary}</p>
          </div>
        )}

        {isActive && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-1 z-10">
            <span className={`h-2 w-2 rounded-full ${analyzing ? "bg-yellow-400 animate-pulse" : "bg-red-500 animate-ping"}`} />
            <span className="text-xs font-bold text-white tracking-widest">
              {analyzing ? "ANALYZING" : "LIVE"}
            </span>
          </div>
        )}

        {showFeed && vidW > 0 && activeDetections.map((det, i) => {
          const color = boxColor(det);
          const pulse = PULSE_CATS.has(det.category);
          return (
            <div
              key={`${det.label}-${i}`}
              style={{
                position: "absolute",
                left: `${det.box.x * vidW}px`,
                top: `${det.box.y * vidH}px`,
                width: `${det.box.w * vidW}px`,
                height: `${det.box.h * vidH}px`,
                border: `2px solid ${color}`,
                borderRadius: "3px",
                pointerEvents: "none",
                animation: pulse ? "borderPulse 1s ease-in-out infinite" : "none",
                zIndex: 5,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  background: "rgba(0,0,0,0.65)",
                  color: "#fff",
                  fontSize: "11px",
                  padding: "1px 5px",
                  borderRadius: "3px",
                  whiteSpace: "nowrap",
                  lineHeight: "1.4",
                }}
              >
                {det.label} {Math.round(det.confidence * 100)}%
              </span>
            </div>
          );
        })}

        {showFeed && hazard && (
          <div className={`absolute bottom-0 left-0 right-0 bg-black/75 backdrop-blur-sm border-t-2 ${styles.border} px-4 py-3 z-10`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={styles.badge}>{hazard.severity}</Badge>
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

        {showFeed && status === "safe" && !hazard && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 bg-green-900/70 border border-green-600 rounded-lg px-3 py-1.5 z-10">
            <span className="text-green-400 text-sm">✅</span>
            <span className="text-xs text-green-300 font-medium">Workstation is safe</span>
          </div>
        )}

        {status === "error" && (
          <div className="absolute bottom-2 left-2 bg-red-900/80 border border-red-600 rounded px-3 py-1.5 z-10">
            <p className="text-xs text-red-300">Analysis failed — retrying…</p>
          </div>
        )}

        <div className="absolute bottom-2 right-2 z-20">
          <div className="bg-gray-900/90 border border-gray-700 rounded-lg overflow-hidden" style={{ maxWidth: "160px" }}>
            <button
              className="w-full px-2 py-1 text-xs text-gray-300 flex items-center justify-between gap-1 hover:bg-gray-800"
              onClick={() => setLegendOpen((open) => !open)}
            >
              <span>Legend</span>
              <span>{legendOpen ? "▲" : "▼"}</span>
            </button>
            {legendOpen && (
              <div className="px-2 pb-2 flex flex-col gap-0.5">
                {LEGEND_ITEMS.map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 10, color: "#d1d5db" }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-xs sm:max-w-[70%] ${SURFACE.mutedText}`}>
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : isActive ? (
            `Scanning every ${INTERVAL_MS / 1000}s`
          ) : demoAnalysis ? (
            "Demo mode active"
          ) : (
            "Click Start to begin monitoring"
          )}
        </p>
        {!demoAnalysis && (
          <button
            onClick={toggle}
            className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors sm:w-auto ${
              isActive ? BUTTON.danger : BUTTON.primary
            }`}
          >
            {isActive ? "Stop" : "Start Monitoring"}
          </button>
        )}
      </div>
    </Card>
  );
}
