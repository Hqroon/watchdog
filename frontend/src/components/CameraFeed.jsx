import { useState, useCallback } from "react";
import { useCamera } from "../hooks/useCamera.js";
import { analyzeFrame } from "../api/gemini.js";

const INTERVAL_MS = 3000; // capture every 3 seconds

const severityColor = {
  low: "border-green-500",
  medium: "border-yellow-500",
  high: "border-red-500",
};

export default function CameraFeed({ onAnalysis }) {
  const [status, setStatus] = useState("idle"); // idle | analyzing | safe | warning | error
  const [lastSeverity, setLastSeverity] = useState("low");
  const [fps, setFps] = useState(null);
  const lastFrameTime = { current: null };

  const handleFrame = useCallback(
    async (dataUrl) => {
      const now = Date.now();
      if (lastFrameTime.current) {
        setFps(Math.round(1000 / (now - lastFrameTime.current)));
      }
      lastFrameTime.current = now;

      setStatus("analyzing");
      try {
        const result = await analyzeFrame(dataUrl);
        const sev = result.analysis?.severity ?? "low";
        setLastSeverity(sev);
        setStatus(result.analysis?.safe ? "safe" : "warning");
        onAnalysis?.(result);
      } catch {
        setStatus("error");
      }
    },
    [onAnalysis]
  );

  const { videoRef, isActive, error, startCamera, stopCamera } = useCamera(INTERVAL_MS);

  const toggle = () => {
    if (isActive) {
      stopCamera();
      setStatus("idle");
    } else {
      startCamera(handleFrame);
    }
  };

  const borderClass = isActive ? (severityColor[lastSeverity] ?? "border-green-500") : "border-gray-700";

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
      {/* Video */}
      <div className={`relative border-4 ${borderClass} transition-colors duration-500`}>
        <video
          ref={videoRef}
          className="w-full aspect-video object-cover bg-black"
          muted
          playsInline
        />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-gray-400 text-sm">Camera is off</p>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              status === "analyzing"
                ? "bg-yellow-400 animate-pulse"
                : status === "warning"
                ? "bg-red-500 animate-ping"
                : status === "safe"
                ? "bg-green-500"
                : "bg-gray-500"
            }`}
          />
          <span className="text-xs font-medium text-white bg-black/50 px-1.5 py-0.5 rounded">
            {status === "analyzing"
              ? "Analyzing…"
              : status === "warning"
              ? "HAZARD DETECTED"
              : status === "safe"
              ? "Safe"
              : "Standby"}
          </span>
        </div>

        {fps && (
          <span className="absolute top-2 right-2 text-xs text-gray-400 bg-black/50 px-1.5 py-0.5 rounded">
            {fps} fps
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs text-gray-400">
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : isActive ? (
            `Capturing every ${INTERVAL_MS / 1000}s`
          ) : (
            "Click Start to begin monitoring"
          )}
        </p>
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
      </div>
    </div>
  );
}
