import { useState, useCallback, useRef, useEffect } from "react";
import { useCamera } from "../hooks/useCamera.js";
import { analyzeFrame } from "../api/gemini.js";

const INTERVAL_MS = 3000;

const SEV = {
  low:    { border: "border-green-500",  badge: "bg-green-600"  },
  medium: { border: "border-yellow-500", badge: "bg-yellow-600" },
  high:   { border: "border-red-500",    badge: "bg-red-600"    },
};

const CAT_COLOR = {
  PERSON:       "#378ADD",
  FOOD_DRINK:   "#E24B4A",
  WIRES_CABLES: "#EF9F27",
  TOOLS:        "#7F77DD",
  COMPONENTS:   "#1D9E75",
  HAZARDS:      "#E24B4A",
  FIRE_EXIT:    "#639922",
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
  const risk = analysis.overall_risk ?? "low";
  if (risk === "low") return null;
  const posture = analysis.posture_issues ?? [];
  const cat = posture.length ? "posture" : "housekeeping";
  return { severity: risk, category: cat, description: analysis.frame_summary ?? "" };
}

export default function CameraFeed({ onAnalysis, demoAnalysis }) {
  const [status, setStatus]         = useState("idle");
  const [hazard, setHazard]         = useState(null);
  const [analyzing, setAnalyzing]   = useState(false);
  const [detections, setDetections] = useState([]);
  const [vidW, setVidW]             = useState(0);
  const [vidH, setVidH]             = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const containerRef                = useRef(null);

  // Measure video area for box positioning
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setVidW(entry.contentRect.width);
      setVidH(entry.contentRect.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Apply demo analysis
  useEffect(() => {
    if (!demoAnalysis) return;
    setDetections(demoAnalysis.detections ?? []);
    setHazard(hazardFromAnalysis(demoAnalysis));
    setStatus(demoAnalysis.overall_risk === "low" ? "safe" : "warning");
  }, [demoAnalysis]);

  const handleFrame = useCallback(async (dataUrl) => {
    setAnalyzing(true);
    try {
      const result = await analyzeFrame(dataUrl);
      const analysis = result.analysis ?? {};
      setDetections(analysis.detections ?? []);
      const h = hazardFromAnalysis(analysis);
      setHazard(h);
      setStatus(h ? "warning" : "safe");
      // Pass data in the shape CoachPanel expects: { incident, coach }
      onAnalysis?.({ incident: result.incident ?? null, coach: result.coach ?? null });
    } catch {
      setStatus("error");
    } finally {
      setAnalyzing(false);
    }
  }, [onAnalysis]);

  const { videoRef, isActive, error, startCamera, stopCamera } = useCamera(INTERVAL_MS);

  const toggle = () => {
    if (isActive) { stopCamera(); setStatus("idle"); setHazard(null); setDetections([]); }
    else          { startCamera(handleFrame); }
  };

  const sev       = hazard?.severity ?? "low";
  const styles    = SEV[sev] ?? SEV.low;
  const showFeed  = isActive || !!demoAnalysis;
  const activeDetections = demoAnalysis ? (demoAnalysis.detections ?? []) : detections;

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 flex flex-col">
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

        {/* Camera-off placeholder */}
        {!isActive && !demoAnalysis && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2">
            <span className="text-4xl">📷</span>
            <p className="text-gray-400 text-sm">Camera is off</p>
          </div>
        )}

        {/* Demo placeholder */}
        {demoAnalysis && !isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 gap-2">
            <span className="text-4xl">🎬</span>
            <p className="text-gray-300 text-sm font-medium">Demo Mode</p>
            <p className="text-gray-500 text-xs text-center px-4">{demoAnalysis.frame_summary}</p>
          </div>
        )}

        {/* LIVE indicator */}
        {isActive && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-1 z-10">
            <span className={`h-2 w-2 rounded-full ${analyzing ? "bg-yellow-400 animate-pulse" : "bg-red-500 animate-ping"}`} />
            <span className="text-xs font-bold text-white tracking-widest">
              {analyzing ? "ANALYZING" : "LIVE"}
            </span>
          </div>
        )}

        {/* Bounding boxes */}
        {showFeed && vidW > 0 && activeDetections.map((det, i) => {
          const color  = boxColor(det);
          const pulse  = PULSE_CATS.has(det.category);
          return (
            <div
              key={i}
              style={{
                position:     "absolute",
                left:         det.box.x * vidW + "px",
                top:          det.box.y * vidH + "px",
                width:        det.box.w * vidW + "px",
                height:       det.box.h * vidH + "px",
                border:       `2px solid ${color}`,
                borderRadius: "3px",
                pointerEvents: "none",
                animation:    pulse ? "borderPulse 1s ease-in-out infinite" : "none",
                zIndex:       5,
              }}
            >
              <span style={{
                position:     "absolute",
                top:          0,
                left:         0,
                background:   "rgba(0,0,0,0.65)",
                color:        "#fff",
                fontSize:     "11px",
                padding:      "1px 5px",
                borderRadius: "3px",
                whiteSpace:   "nowrap",
                lineHeight:   "1.4",
              }}>
                {det.label} {Math.round(det.confidence * 100)}%
              </span>
            </div>
          );
        })}

        {/* Hazard bar */}
        {showFeed && hazard && (
          <div className={`absolute bottom-0 left-0 right-0 bg-black/75 backdrop-blur-sm border-t-2 ${styles.border} px-4 py-3 z-10`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${styles.badge} text-white`}>
                    {hazard.severity}
                  </span>
                  <span className="text-xs text-gray-300 capitalize font-medium">
                    {hazard.category?.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-white leading-snug line-clamp-2">{hazard.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Safe indicator */}
        {showFeed && status === "safe" && !hazard && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 bg-green-900/70 border border-green-600 rounded-lg px-3 py-1.5 z-10">
            <span className="text-green-400 text-sm">✅</span>
            <span className="text-xs text-green-300 font-medium">Workstation is safe</span>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="absolute bottom-2 left-2 bg-red-900/80 border border-red-600 rounded px-3 py-1.5 z-10">
            <p className="text-xs text-red-300">Analysis failed — retrying…</p>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-2 right-2 z-20">
          <div className="bg-gray-900/90 border border-gray-700 rounded-lg overflow-hidden" style={{ maxWidth: "160px" }}>
            <button
              className="w-full px-2 py-1 text-xs text-gray-300 flex items-center justify-between gap-1 hover:bg-gray-800"
              onClick={() => setLegendOpen(o => !o)}
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

      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs text-gray-400">
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
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              isActive
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isActive ? "Stop" : "Start Monitoring"}
          </button>
        )}
      </div>
    </div>
  );
}
