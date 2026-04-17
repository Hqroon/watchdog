import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatTime(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function SeverityBadge({ severity }) {
  const cls = {
    high:   "text-destructive border-destructive",
    medium: "text-yellow-600 border-yellow-500",
    low:    "text-green-600 border-green-500",
  }[severity] ?? "text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("text-xs", cls)}>
      {severity}
    </Badge>
  );
}

export default function AlertPanel({ incidents, stats, onResolveIncident }) {
  const [filter, setFilter] = useState("all");
  const [pendingIds, setPendingIds] = useState({});
  const [error, setError] = useState("");

  async function handleResolve(id) {
    setError("");
    setPendingIds((prev) => ({ ...prev, [id]: true }));
    try {
      await onResolveIncident?.(id);
    } catch (e) {
      setError(e.message || "Could not resolve incident.");
    } finally {
      setPendingIds((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  const filtered = incidents.filter((i) => {
    if (filter === "unresolved") return !i.resolved;
    if (filter === "high") return i.severity === "high";
    return true;
  });

  return (
    <div className="bg-card rounded-xl border border-border flex flex-col h-full max-h-[80vh]">
      {/* Stats */}
      <div className="px-4 pt-4 pb-2 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Incidents</p>

        {error && (
          <p className="mb-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{error}</p>
        )}

        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
          <div className="bg-muted rounded-lg py-2">
            <p className="text-lg font-semibold text-foreground">{stats.total}</p>
            <p className="text-muted-foreground">Total</p>
          </div>
          <div className="bg-yellow-500/10 rounded-lg py-2">
            <p className="text-lg font-semibold text-yellow-600">{stats.unresolved}</p>
            <p className="text-muted-foreground">Open</p>
          </div>
          <div className="bg-destructive/10 rounded-lg py-2">
            <p className="text-lg font-semibold text-destructive">{stats.by_severity?.high ?? 0}</p>
            <p className="text-muted-foreground">High</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {["all", "unresolved", "high"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 text-xs py-1 rounded transition-colors capitalize",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Incident list */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-muted-foreground text-sm">No incidents.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((inc) => (
              <div
                key={inc.id}
                className={cn(
                  "px-4 py-3 transition-colors hover:bg-muted/50",
                  inc.resolved && "opacity-40"
                )}
              >
                <div
                  className={cn(
                    "border-l-4 pl-3",
                    inc.severity === "high"   ? "border-l-destructive" :
                    inc.severity === "medium" ? "border-l-yellow-500"  : "border-l-green-500"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <SeverityBadge severity={inc.severity} />
                    <span className="text-xs text-muted-foreground capitalize">{inc.category}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatTime(inc.timestamp)}</span>
                  </div>
                  <p className="text-xs text-foreground truncate">{inc.description}</p>
                </div>
                {!inc.resolved && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto p-0 text-xs"
                    onClick={() => handleResolve(inc.id)}
                    disabled={!!pendingIds[inc.id]}
                  >
                    {pendingIds[inc.id] ? "Resolving…" : "Mark resolved"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
