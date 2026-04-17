import { useState, useCallback, useRef, useEffect } from "react";
import { useCamera } from "../hooks/useCamera.js";
import { analyzeFrame } from "../api/gemini.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 3000;

const POSTURE_BAR = {
  good:    { bg: "bg-green-500",  label: "Good" },
  warning: { bg: "bg-yellow-500", label: "Fair" },
  poor:    { bg: "bg-red-500",    label: "Poor" },
};

const WELLNESS_BADGE = {
  good: "text-green-600 border-green-500",
  fair: "text-yellow-600 border-yellow-500",
  poor: "text-destructive border-destructive",
};

function eyeMeterColor(pct) {
  if (pct >= 80) return "#639922";
  if (pct >= 50) return "#EF9F27";
  return "#E24B4A";
}

function WellnessBadge({ wellness }) {
  if (!wellness || wellness === "good") {
    return (
      <Badge variant="outline" className="text-green-600 border-green-500 uppercase">
        Good
      </Badge>
    );
  }
  return (
    <Badge
      variant={wellness === "poor" ? "destructive" : "outline"}
      className={cn("uppercase", wellness !== "poor" && WELLNESS_BADGE[wellness])}
    >
      {wellness}
    </Badge>
  );
}

export default function CameraFeed({ onAnalysis, onMonitoringChange, demoAnalysis }) {
  const [status, setStatus]         = useState("idle");
  const [analysis, setAnalysis]     = useState(null);
  const [analyzing, setAnalyzing]   = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const abortRef                    = useRef(null);
  const sessionRef                  = useRef(0);
  const activeRef                   = useRef(false);
  const { videoRef, isActive, error, startCamera, stopCamera } = useCamera(INTERVAL_MS);

  const currentAnalysis = demoAnalysis ?? analysis;

  useEffect(() => {
    activeRef.current = isActive;
    onMonitoringChange?.(isActive);
  }, [isActive, onMonitoringChange]);

  useEffect(() => {
    if (!demoAnalysis) return;
    setAnalysis(demoAnalysis);
    setStatus(demoAnalysis.overall_wellness === "good" ? "safe" : "warning");
  }, [demoAnalysis]);

  const handleFrame = useCallback(async (dataUrl) => {
    const sessionId = sessionRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setAnalyzing(true);
    try {
      const result = await analyzeFrame(dataUrl, controller.signal);
      if (controller.signal.aborted || sessionId !== sessionRef.current || !activeRef.current) return;

      const a = result.analysis ?? {};
      setAnalysis(a);
      setStatus(a.overall_wellness === "poor" ? "warning" : "safe");
      onAnalysis?.({
        analysis: a,
        timeAlerts: result.time_based_alerts ?? [],
        sessionStats: result.session_stats ?? {},
        incident: result.incident ?? null,
        coach: result.coach ?? null,
      });
    } catch (err) {
      if (err?.name === "AbortError" || sessionId !== sessionRef.current) return;
      setStatus("error");
      onAnalysis?.({ networkError: true });
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
      setAnalysis(null);
      setAnalyzing(false);
      onAnalysis?.(null);
    } else {
      sessionRef.current += 1;
      startCamera(handleFrame);
    }
  };

  const posture       = currentAnalysis?.posture        ?? {};
  const eyeStrain     = currentAnalysis?.eye_strain     ?? {};
  const hydration     = currentAnalysis?.hydration      ?? {};
  const focusState    = currentAnalysis?.focus_state    ?? {};
  const wellness      = currentAnalysis?.overall_wellness ?? "good";
  const presence      = currentAnalysis?.presence       ?? false;
  const proximity     = currentAnalysis?.screen_proximity ?? {};
  const eyeOpenness   = currentAnalysis?.eye_openness   ?? {};

  const postureStatus  = posture.status ?? "good";
  const postureBar     = POSTURE_BAR[postureStatus] ?? POSTURE_BAR.good;
  const showFeed       = isActive || !!demoAnalysis;
  const isDrowsy       = focusState.state === "drowsy";

  // Border styling — amber beats red so proximity takes precedence visually
  const proxStatus     = proximity.status ?? "safe";
  const eyeRing        = eyeStrain.detected && eyeStrain.severity !== "none";
  const proxRing       = proxStatus === "too_close";
  const proxSubtle     = proxStatus === "close";

  const opennessPct    = eyeOpenness.openness_percent ?? 80;
  const eyeSore        = eyeOpenness.sore_eyes_likely ?? false;

  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border flex flex-col">
      <div className="relative">
        {/* Video with conditional border rings */}
        <video
          ref={videoRef}
          className={cn(
            "w-full aspect-video object-cover bg-black",
            proxRing  && "outline outline-2 outline-offset-[-2px]",
            !proxRing && eyeRing && "outline outline-2 outline-offset-[-2px] outline-red-500"
          )}
          style={
            proxRing
              ? { outline: "2px solid #EF9F27", outlineOffset: "-2px", animation: "borderPulse 1s ease-in-out infinite" }
              : proxSubtle
              ? { outline: "2px solid #EF9F2766", outlineOffset: "-2px" }
              : eyeRing
              ? { outline: "2px solid #ef4444", outlineOffset: "-2px", animation: "borderPulse 1s ease-in-out infinite" }
              : undefined
          }
          muted
          playsInline
        />

        {/* ── Overlays ── */}

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
            <p className="text-white text-sm font-medium">Demo Mode</p>
            <p className="text-gray-300 text-xs text-center px-4">{demoAnalysis.frame_summary}</p>
          </div>
        )}

        {/* Screen proximity top banner */}
        {showFeed && proxRing && (
          <div
            className="absolute top-0 left-0 right-0 z-30 flex items-center justify-center"
            style={{
              height: "32px",
              background: "rgba(239,159,39,0.85)",
              transition: "opacity 0.3s",
            }}
          >
            <span style={{ color: "#fff", fontSize: "13px", fontWeight: 500 }}>
              Move back from screen
            </span>
          </div>
        )}

        {/* Posture bar — left edge */}
        {showFeed && (
          <div className="absolute left-0 top-0 bottom-0 w-5 flex flex-col z-10">
            <span
              className="text-white text-[9px] font-bold py-1 px-0.5 bg-black/50 text-center"
              style={{ writingMode: "vertical-rl" }}
            >
              {postureBar.label}
            </span>
            <div className={cn("flex-1", postureBar.bg, "opacity-80")} />
          </div>
        )}

        {/* Eye openness meter — bottom left */}
        {showFeed && (
          <div className="absolute bottom-10 left-7 z-10" style={{ width: 120 }}>
            <p style={{ color: "#fff", fontSize: 10, marginBottom: 2 }}>
              Eye openness
              {eyeSore && (
                <span style={{ color: "#E24B4A", marginLeft: 4, fontSize: 10, fontWeight: 600 }}>
                  Sore
                </span>
              )}
            </p>
            <div style={{ width: 120, height: 8, borderRadius: 4, background: "rgba(0,0,0,0.4)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${(opennessPct / 100) * 120}px`,
                  background: eyeMeterColor(opennessPct),
                  borderRadius: 4,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* LIVE indicator */}
        {isActive && (
          <div className="absolute top-2 left-7 z-10">
            <Badge variant="outline" className="bg-black/60 border-border text-white gap-1.5">
              <span className={cn(
                "h-2 w-2 rounded-full",
                analyzing ? "bg-yellow-400 animate-pulse" : "bg-red-500 animate-ping"
              )} />
              Lance · 1 frame / 3s
            </Badge>
          </div>
        )}

        {/* Wellness badge — top right */}
        {showFeed && (
          <div className="absolute top-2 right-2 z-10">
            <WellnessBadge wellness={wellness} />
          </div>
        )}

        {/* DROWSY overlay */}
        {showFeed && isDrowsy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
            <div className="text-white text-2xl font-bold drop-shadow-lg select-none">
              Wake up! 😴
            </div>
          </div>
        )}

        {/* Hydration badge — bottom right */}
        {showFeed && (
          <div className="absolute bottom-2 right-2 z-10">
            {hydration.water_visible ? (
              <Badge variant="outline" className="bg-black/60 text-green-400 border-green-500 gap-1">
                💧 Hydrated
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-black/60 text-amber-400 border-amber-500 gap-1">
                💧 No water
              </Badge>
            )}
          </div>
        )}

        {/* Empty seat */}
        {showFeed && !presence && !isDrowsy && (
          <div className="absolute bottom-2 left-7 right-20 z-10">
            <Badge variant="outline" className="bg-black/60 text-muted-foreground border-border">
              No person detected
            </Badge>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="absolute bottom-2 left-7 z-10">
            <Badge variant="destructive">Analysis failed — retrying…</Badge>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-2 left-7 z-20">
          {showFeed && status !== "error" && (
            <Card className="shadow-none overflow-hidden" style={{ maxWidth: "180px" }}>
              <button
                className="w-full px-2 py-1 text-xs text-muted-foreground flex items-center justify-between gap-1 hover:bg-muted"
                onClick={() => setLegendOpen(o => !o)}
              >
                <span>Legend</span>
                <span>{legendOpen ? "▲" : "▼"}</span>
              </button>
              {legendOpen && (
                <CardContent className="px-2 pb-2 pt-0 flex flex-col gap-1">
                  {[
                    { color: "#22c55e", label: "Good posture bar" },
                    { color: "#eab308", label: "Warning posture bar" },
                    { color: "#ef4444", label: "Poor posture / eye strain ring" },
                    { color: "#EF9F27", label: "Too close to screen (amber ring)" },
                    { color: "#22c55e", label: "Hydrated" },
                    { color: "#f59e0b", label: "No water seen" },
                    { color: "#639922", label: "Eye meter — open" },
                    { color: "#EF9F27", label: "Eye meter — partial" },
                    { color: "#E24B4A", label: "Eye meter — low / sore" },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}
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
