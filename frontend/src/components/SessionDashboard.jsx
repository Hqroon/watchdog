import { useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import ActivityLog from "./ActivityLog.jsx";
import { API_BASE } from "../config.js";

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function postureBarColor(score) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function postureTextColor(score) {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-destructive";
}

function severityBadge(severity) {
  if (severity === "high") return <Badge variant="destructive" className="capitalize">{severity}</Badge>;
  if (severity === "medium") return <Badge variant="outline" className="text-yellow-600 border-yellow-500 capitalize">{severity}</Badge>;
  return <Badge variant="outline" className="text-green-600 border-green-500 capitalize">{severity}</Badge>;
}

export default function SessionDashboard({ incidents, stats, sessionStats = {}, postureHistory = [], onResetSession }) {
  const waterReminders = incidents.filter(i => i.category === "hydration").length;
  const collapseAlerts = incidents.filter(i => i.category === "collapse_risk").length;

  const handleReset = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/reset-session`, { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      onResetSession?.();
      toast.success("Session reset");
    } catch {
      toast.error("Could not reset session");
    }
  }, [onResetSession]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Session</h2>
        <Button variant="outline" size="sm" onClick={handleReset}>
          Reset Session
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-none">
          <CardContent className="px-4 py-4 text-center">
            <p className="text-2xl font-semibold text-foreground">
              {formatDuration(sessionStats.session_duration_minutes ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Session Time</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="px-4 py-4 text-center">
            <p className={cn("text-2xl font-semibold", postureTextColor(sessionStats.avg_posture_score ?? 0))}>
              {Math.round(sessionStats.avg_posture_score ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Avg Posture</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="px-4 py-4 text-center">
            <p className="text-2xl font-semibold text-blue-600">{waterReminders}</p>
            <p className="text-sm text-muted-foreground mt-1">Water Reminders</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="px-4 py-4 text-center">
            <p className={cn("text-2xl font-semibold", collapseAlerts > 0 ? "text-destructive" : "text-foreground")}>
              {collapseAlerts}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Collapse Alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Posture timeline */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Posture over last 2 minutes</p>
        </CardHeader>
        <CardContent>
          {postureHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No data yet</p>
          ) : (
            <div className="flex items-end gap-0.5 h-20">
              {postureHistory.map((score, i) => (
                <div
                  key={i}
                  className={cn("flex-1 rounded-t-sm min-w-0 transition-all", postureBarColor(score))}
                  style={{ height: `${Math.max(4, score)}%` }}
                  title={`${score}`}
                />
              ))}
            </div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>2m ago</span>
            <span>now</span>
          </div>
        </CardContent>
      </Card>

      {/* Alert history */}
      <Card className="shadow-none overflow-hidden">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Alert History</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.slice(0, 20).map((inc) => (
                  <TableRow key={inc.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(inc.timestamp * 1000).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="capitalize text-xs text-muted-foreground">
                      {inc.category?.replace("_", " ")}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{inc.description}</TableCell>
                    <TableCell>{severityBadge(inc.severity)}</TableCell>
                  </TableRow>
                ))}
                {incidents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No alerts recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Session activity log */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Session activity</p>
        </CardHeader>
        <CardContent>
          <ActivityLog />
        </CardContent>
      </Card>
    </div>
  );
}
