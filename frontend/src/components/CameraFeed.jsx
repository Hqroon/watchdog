import { useState, useCallback, useRef, useEffect } from "react";
import { useCamera } from "../hooks/useCamera.js";
import { analyzeFrame } from "../api/gemini.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

function RiskBadge({ risk }) {
  if (!risk || risk === "low") return null;
  if (risk === "high") {
    return <Badge variant="destructive" className="uppercase">{risk}</Badge>;
  }
  return (
    <Badge variant="outline" className="uppercase text-yellow-600 border-yellow-500">
      {risk}
    </Badge>
  );
}

export default function CameraFeed({ onAnalysis, onMonitoringChange, demoAnalysis }) {
  const [status, setStatus]         = useState("idle");
  const [hazard, setHazard]         = useState(null);
  const [analyzing, setAnalyzing]   = useState(false);
  const [detections, setDetections] = useState([]);
  const [vidW, setVidW]             = useState(0);
  const [vidH, setVidH]             = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const containerRef                = useRef(null);
  const abortRef                    = useRef(null);
  const sessionRef                  = useRef(0);
  const activeRef                   = useRef(false);
  const { videoRef, isActive, error, startCamera, stopCamera } = useCamera(INTERVAL_MS);

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
      const h = hazardFromAnalysis(analysis);
      setHazard(h);
      setStatus(h ? "warning" : "safe");
      onAnalysis?.({ incident: result.incident ?? null, coach: result.coach ?? null });
    } catch (err) {
      if (err?.name === "AbortError" || sessionId !== sessionRef.current) return;
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

  const sev    = hazard?.severity ?? "low";
  const styles = SEV[sev] ?? SEV.low;
  const showFeed = isActive || !!demoAnalysis;
  const activeDetections = demoAnalysis ? (demoAnalysis.detections ?? []) : detections;

  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border flex flex-col">
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

        {/* Camera-off placeholder */}
        {!isActive && !demoAnalysis && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2">
            <span className="text-4xl">📷</span>
            <p className="text-muted-foreground text-sm">Camera is off</p>
          </div>
        )}

        {/* Demo placeholder */}
        {demoAnalysis && !isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2">
            <span className="text-4xl">🎬</span>
            <p className="text-foreground text-sm font-medium">Demo Mode</p>
            <p className="text-muted-foreground text-xs text-center px-4">{demoAnalysis.frame_summary}</p>
          </div>
        )}

        {/* LIVE indicator */}
        {isActive && (
          <div className="absolute top-2 left-2 z-10">
            <Badge variant="outline" className="bg-black/60 border-border text-white gap-1.5">
              <span className={cn(
                "h-2 w-2 rounded-full",
                analyzing ? "bg-yellow-400 animate-pulse" : "bg-red-500 animate-ping"
              )} />
              {analyzing ? "ANALYZING" : "LIVE"}
            </Badge>
          </div>
        )}

        {/* Bounding boxes */}
        {showFeed && vidW > 0 && activeDetections.map((det, i) => {
          const color = boxColor(det);
          const pulse = PULSE_CATS.has(det.category);
          return (
            <div
              key={i}
              style={{
                position:      "absolute",
                left:          det.box.x * vidW + "px",
                top:           det.box.y * vidH + "px",
                width:         det.box.w * vidW + "px",
                height:        det.box.h * vidH + "px",
                border:        `2px solid ${color}`,
                borderRadius:  "3px",
                pointerEvents: "none",
                animation:     pulse ? "borderPulse 1s ease-in-out infinite" : "none",
                zIndex:        5,
              }}
            >
              <span style={{
                position:    "absolute",
                top:         0,
                left:        0,
                background:  "rgba(0,0,0,0.65)",
                color:       "#fff",
                fontSize:    "11px",
                padding:     "1px 5px",
                borderRadius:"3px",
                whiteSpace:  "nowrap",
                lineHeight:  "1.4",
              }}>
                {det.label} {Math.round(det.confidence * 100)}%
              </span>
            </div>
          );
        })}

        {/* Hazard bar */}
        {showFeed && hazard && (
          <div className={cn(
            "absolute bottom-0 left-0 right-0 bg-black/75 backdrop-blur-sm border-t-2 px-4 py-3 z-10",
            styles.border
          )}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <RiskBadge risk={hazard.severity} />
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
          <div className="absolute bottom-2 left-2 right-2 z-10">
            <Badge variant="outline" className="w-full justify-center bg-green-900/70 border-green-600 text-green-300">
              Workstation is safe
            </Badge>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="absolute bottom-2 left-2 z-10">
            <Badge variant="destructive">Analysis failed — retrying…</Badge>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-2 right-2 z-20">
          <Card className="shadow-none overflow-hidden" style={{ maxWidth: "160px" }}>
            <button
              className="w-full px-2 py-1 text-xs text-muted-foreground flex items-center justify-between gap-1 hover:bg-muted"
              onClick={() => setLegendOpen(o => !o)}
            >
              <span>Legend</span>
              <span>{legendOpen ? "▲" : "▼"}</span>
            </button>
            {legendOpen && (
              <CardContent className="px-2 pb-2 pt-0 flex flex-col gap-0.5">
                {LEGEND_ITEMS.map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs text-muted-foreground">
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
          <Button
            onClick={toggle}
            variant={isActive ? "destructive" : "default"}
            size="sm"
          >
            {isActive ? "Stop" : "Start Monitoring"}
          </Button>
        )}
      </div>
    </div>
  );
}
