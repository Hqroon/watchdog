import { useState } from "react";
import { useActivityLog } from "../stores/activityLog.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const FILTER_OPTIONS = [
  { label: "All",             value: "" },
  { label: "Posture",         value: "POSTURE" },
  { label: "Eye strain",      value: "EYE_STRAIN" },
  { label: "Eye health",      value: "EYE_HEALTH" },
  { label: "Screen distance", value: "SCREEN_DISTANCE" },
  { label: "Hydration",       value: "HYDRATION" },
  { label: "Drowsiness",      value: "DROWSINESS" },
  { label: "Focus",           value: "FOCUS" },
  { label: "Wellness",        value: "WELLNESS" },
  { label: "System",          value: "SYSTEM" },
];

const DOT_COLOR = {
  critical: "#E24B4A",
  warning:  "#EF9F27",
  info:     "#378ADD",
  good:     "#639922",
};

function formatCategory(cat) {
  return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function ActivityLog() {
  const { logs, clearLogs } = useActivityLog();
  const [filter, setFilter] = useState("");

  const filtered = filter ? logs.filter(e => e.category === filter) : logs;

  const critical = logs.filter(e => e.severity === "critical").length;
  const warnings = logs.filter(e => e.severity === "warning").length;
  const good     = logs.filter(e => e.severity === "good").length;

  const handleExport = () => {
    const rows = [
      ["Timestamp", "Category", "Severity", "Title", "Detail"],
      ...filtered.map(e => [
        e.timestamp,
        e.category,
        e.severity,
        e.title,
        `"${(e.detail ?? "").replace(/"/g, '""')}"`,
      ]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lance-session-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium">Activity log</span>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs}>
            Clear log
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <span>{logs.length} total</span>
        <span>·</span>
        <span className="text-[#E24B4A] font-medium">{critical} critical</span>
        <span>·</span>
        <span className="text-[#EF9F27] font-medium">{warnings} warnings</span>
        <span>·</span>
        <span className="text-[#639922] font-medium">{good} good</span>
      </div>

      {/* Log list */}
      <ScrollArea className="h-96 rounded-md border border-border">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12 px-4 text-center">
            <p className="text-xs text-muted-foreground">
              No activity yet — session log will appear here as Lance monitors you
            </p>
          </div>
        ) : (
          <div className="px-3 py-1">
            {filtered.map((entry, idx) => (
              <div
                key={entry.id}
                className="flex items-start gap-2.5 py-1.5 hover:bg-muted/40 rounded-sm px-1"
                style={{
                  borderBottom: idx < filtered.length - 1 ? "0.5px solid var(--border)" : "none",
                }}
              >
                {/* Timestamp */}
                <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5 w-16">
                  {new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                </span>

                {/* Dot */}
                <span
                  className="shrink-0 mt-[5px]"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: DOT_COLOR[entry.severity] ?? "#888",
                    flexShrink: 0,
                  }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">{entry.title}</p>
                  {entry.detail && (
                    <p className="text-xs text-muted-foreground truncate">{entry.detail}</p>
                  )}
                  <Badge variant="outline" className="text-xs mt-0.5 h-4 px-1">
                    {formatCategory(entry.category)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
