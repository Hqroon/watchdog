import { useState, useCallback, useRef, useEffect } from "react";
import { useCamera } from "../hooks/useCamera.js";
import { analyzeFrame } from "../api/gemini.js";
import { SEVERITY, SURFACE } from "../ui/tokens.js";
import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import { cn } from "@/lib/utils";

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
      if (controller.signal.aborted || sessionId !== sessionRef.current || !activeRef.current) return;

      const analysis = result.analysis ?? {};
      setDetections(analysis.detections ?? []);
      const nextHazard = hazardFromAnalysis(analysis);
      setHazard(nextHazard);
      setStatus(nextHazard ? "warning" : "safe");
      onAnalysis?.({ incident: result.incident ?? null, coach: result.coach ?? null });
    } catch (requestError) {
      if (requestError?.name === "AbortError" || sessionId !== sessionRef.current) return;
      setStatus("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (sessionId === sessionRef.current) setAnalyzing(false);
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
            <Badge className={isActive ? "bg-red-500/15 text-red-500" : demoAnalysis ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}>
              {isActive ? "Camera On" : demoAnalysis ? "Demo Mode" : "Camera Off"}
            </Badge>
          }
        />
      </div>

      <div
        ref={containerRef}
        className={cn(
          "relative border-4 transition-colors duration-500",
          showFeed ? styles.border : "border-border"
        )}
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
            <p className="text-sm text-muted-foreground">Camera is off</p>
          </div>
        )}

        {demoAnalysis && !isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2">
            <span className="text-4xl">🎬</span>
            <p className="text-sm font-medium text-white">Demo Mode</p>
            <p className="px-4 text-center text-xs text-muted-foreground">{demoAnalysis.frame_summary}</p>
          </div>
        )}

        {isActive && (
          <div className="absolute top-2 left-2 z-10">
            <Badge className="gap-1.5 border border-border bg-black/60 text-white">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  analyzing ? "bg-yellow-400 animate-pulse" : "bg-red-500 animate-ping"
                )}
              />
              {analyzing ? "ANALYZING" : "LIVE"}
            </Badge>
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
          <div className={cn(
            "absolute bottom-0 left-0 right-0 bg-black/75 backdrop-blur-sm border-t-2 px-4 py-3 z-10",
            styles.border
          )}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <Badge className={styles.badge}>{hazard.severity}</Badge>
                  <span className="text-xs font-medium capitalize text-gray-300">
                    {hazard.category?.replace("_", " ")}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm leading-snug text-white">
                  {hazard.description}
                </p>
                {hazard.recommendations?.length > 0 && (
                  <p className="mt-1 truncate text-xs text-gray-400">
                    ↳ {hazard.recommendations[0]}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {showFeed && status === "safe" && !hazard && (
          <div className="absolute bottom-2 left-2 right-2 z-10">
            <Badge className="w-full justify-center border border-green-600 bg-green-900/70 text-green-300">
              Workstation is safe
            </Badge>
          </div>
        )}

        {status === "error" && (
          <div className="absolute bottom-2 left-2 z-10">
            <Badge className="bg-destructive/15 text-destructive">Analysis failed — retrying…</Badge>
          </div>
        )}

        <div className="absolute bottom-2 right-2 z-20">
          <Card className="overflow-hidden shadow-none" style={{ maxWidth: "160px" }}>
            <button
              className="flex w-full items-center justify-between gap-1 px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              onClick={() => setLegendOpen((open) => !open)}
            >
              <span>Legend</span>
              <span>{legendOpen ? "▲" : "▼"}</span>
            </button>
            {legendOpen && (
              <div className="flex flex-col gap-0.5 px-2 pb-2 pt-0">
                {LEGEND_ITEMS.map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground sm:max-w-[70%]">
          {error ? (
            <span className="text-destructive">{error}</span>
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
            className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:w-auto ${
              isActive ? "bg-destructive/15 text-destructive hover:bg-destructive/20" : "bg-primary text-primary-foreground hover:bg-primary/85"
            }`}
          >
            {isActive ? "Stop" : "Start Monitoring"}
          </button>
        )}
      </div>
    </Card>
  );
}
