import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const ALERT_CATEGORY_COLOR = {
  HYDRATION:     "border-l-blue-500",
  MOVEMENT:      "border-l-green-500",
  OVERWORK:      "border-l-amber-500",
  POSTURE:       "border-l-orange-500",
  COLLAPSE_RISK: "border-l-destructive",
  EYE_HEALTH:    "border-l-teal-500",
};

const ALERT_BADGE_COLOR = {
  HYDRATION:     "text-blue-600 border-blue-500",
  MOVEMENT:      "text-green-600 border-green-500",
  OVERWORK:      "text-amber-600 border-amber-500",
  POSTURE:       "text-orange-600 border-orange-500",
  COLLAPSE_RISK: "text-destructive border-destructive",
  EYE_HEALTH:    "border-[#1D9E75]",
};

function postureColor(score) {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-destructive";
}

function postureBarColor(score) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function focusColor(state) {
  return { focused: "text-green-600", drowsy: "text-destructive", distracted: "text-amber-600", away: "text-muted-foreground" }[state] ?? "text-muted-foreground";
}

function wellnessColor(w) {
  return { good: "text-green-600", fair: "text-yellow-600", poor: "text-destructive" }[w] ?? "text-muted-foreground";
}

function eyeColor(sev) {
  return { none: "text-green-600", mild: "text-yellow-600", severe: "text-destructive" }[sev] ?? "text-muted-foreground";
}

function proxColor(status) {
  return { safe: "text-green-600", close: "text-amber-600", too_close: "text-destructive" }[status] ?? "text-muted-foreground";
}

function proxLabel(status) {
  return { safe: "Good", close: "A bit close", too_close: "Too close" }[status] ?? "Unknown";
}

function opennessColor(pct) {
  if (pct >= 80) return "text-green-600";
  if (pct >= 50) return "text-amber-600";
  return "text-destructive";
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function WellnessPanel({ analysis, timeAlerts = [], sessionStats = {} }) {
  const [statsOpen, setStatsOpen] = useState(false);

  const posture      = analysis?.posture           ?? { score: 0, status: "good", issues: [], description: "" };
  const eyeStrain    = analysis?.eye_strain        ?? { detected: false, severity: "none", description: "" };
  const hydration    = analysis?.hydration         ?? { water_visible: false, container_type: "none" };
  const focus        = analysis?.focus_state       ?? { state: "away", confidence: 0 };
  const wellness     = analysis?.overall_wellness  ?? "good";
  const proximity    = analysis?.screen_proximity  ?? { status: "safe" };
  const eyeOpenness  = analysis?.eye_openness      ?? { openness_percent: 80, sore_eyes_likely: false };

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Section 1: Posture score ── */}
      <Card className="shadow-none">
        <CardHeader className="pb-1 pt-3 px-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Posture</p>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-semibold", postureColor(posture.score))}>
              {posture.score}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", postureBarColor(posture.score))}
              style={{ width: `${posture.score}%` }}
            />
          </div>
          {posture.issues.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {posture.issues.map((issue) => (
                <Badge key={issue} variant="outline" className="text-xs text-orange-600 border-orange-400">
                  {issue}
                </Badge>
              ))}
            </div>
          )}
          {posture.description && (
            <p className="text-xs text-muted-foreground">{posture.description}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: State grid ── */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="shadow-none">
          <CardContent className="px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Eye Strain</p>
            <p className={cn("text-sm font-medium capitalize", eyeColor(eyeStrain.severity))}>
              {eyeStrain.severity}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Hydration</p>
            <p className={cn("text-sm font-medium", hydration.water_visible ? "text-green-600" : "text-amber-600")}>
              {hydration.water_visible ? "Visible" : "Not seen"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Focus</p>
            <p className={cn("text-sm font-medium capitalize", focusColor(focus.state))}>
              {focus.state}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Wellness</p>
            <p className={cn("text-sm font-medium capitalize", wellnessColor(wellness))}>
              {wellness}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Screen Distance</p>
            <p className={cn("text-sm font-medium", proxColor(proximity.status))}>
              {proxLabel(proximity.status)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Eye Openness</p>
            <p className={cn("text-sm font-medium", opennessColor(eyeOpenness.openness_percent ?? 80))}>
              {eyeOpenness.openness_percent ?? 80}%
              {eyeOpenness.sore_eyes_likely && (
                <span className="text-destructive text-xs ml-1">Sore</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 3: Time-based alerts ── */}
      <Card className="shadow-none flex-1 min-h-0">
        <CardHeader className="pb-1 pt-3 px-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reminders</p>
        </CardHeader>
        <CardContent className="px-4 pb-3 p-0">
          <ScrollArea className="h-40 px-4">
            {timeAlerts.length === 0 ? (
              <p className="py-4 text-xs text-green-600">All good — no reminders right now</p>
            ) : (
              <div className="space-y-2 pb-2">
                {timeAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className={cn(
                      "border-l-4 pl-3 py-2",
                      ALERT_CATEGORY_COLOR[alert.category] ?? "border-l-border"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", ALERT_BADGE_COLOR[alert.category] ?? "")}
                      >
                        {alert.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground leading-snug">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── Section 4: Session stats (collapsible) ── */}
      <Card className="shadow-none">
        <button
          className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-muted transition-colors rounded-xl"
          onClick={() => setStatsOpen(o => !o)}
        >
          <span className="uppercase tracking-wide">Session Stats</span>
          <span>{statsOpen ? "▲" : "▼"}</span>
        </button>
        {statsOpen && (
          <CardContent className="px-4 pb-3 space-y-1.5 pt-0">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{formatDuration(sessionStats.session_duration_minutes ?? 0)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Avg posture</span>
              <span className={cn("font-medium", postureColor(sessionStats.avg_posture_score ?? 0))}>
                {Math.round(sessionStats.avg_posture_score ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Last water</span>
              <span className="font-medium">
                {sessionStats.time_since_water_minutes != null
                  ? `${Math.round(sessionStats.time_since_water_minutes)}m ago`
                  : "Not seen"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Presence</span>
              <span className="font-medium">
                {Math.round((sessionStats.presence_ratio ?? 0) * 100)}%
              </span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
