import { useState } from "react";
import { BUTTON, SEVERITY, SURFACE } from "../ui/tokens.js";
import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";

function formatTime(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
    } catch (resolveError) {
      setError(resolveError.message || "Could not resolve incident.");
    } finally {
      setPendingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  const filtered = incidents.filter((incident) => {
    if (filter === "unresolved") return !incident.resolved;
    if (filter === "high") return incident.severity === "high";
    return true;
  });

  return (
    <Card className="flex h-full max-h-[80vh] min-h-[20rem] flex-col xl:sticky xl:top-4">
      <div className={`border-b px-4 pt-4 pb-2 ${SURFACE.sectionBorder}`}>
        <SectionHeader
          title="Incidents"
          subtitle="Track live issues and resolve them as the workstation changes."
          className="mb-3"
        />
        {error && (
          <p className="mb-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{error}</p>
        )}
        <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted py-2">
            <p className="text-lg font-semibold text-foreground">{stats.total}</p>
            <p className={SURFACE.mutedText}>Total</p>
          </div>
          <div className="rounded-lg bg-yellow-500/10 py-2">
            <p className="text-lg font-semibold text-yellow-600">{stats.unresolved}</p>
            <p className={SURFACE.mutedText}>Open</p>
          </div>
          <div className="rounded-lg bg-destructive/10 py-2">
            <p className="text-lg font-semibold text-destructive">{stats.by_severity?.high ?? 0}</p>
            <p className={SURFACE.mutedText}>High</p>
          </div>
        </div>

        <div className="flex gap-1">
          {["all", "unresolved", "high"].map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`flex-1 rounded px-2 py-1 text-xs capitalize transition-colors ${
                filter === value ? BUTTON.tabActive : BUTTON.tabInactive
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="incident-scroll flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No incidents.</p>
        ) : (
          <div className={`divide-y ${SURFACE.sectionBorder}`}>
            {filtered.map((inc) => (
              <div
                key={inc.id}
                className={`px-4 py-3 ${SURFACE.hoverRow} ${inc.resolved ? "opacity-40" : ""}`}
              >
                <div className="border-l-4 border-l-border pl-3">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge className={SEVERITY[inc.severity]?.pill ?? SEVERITY.low.pill}>
                      {inc.severity}
                    </Badge>
                    <span className={`text-xs capitalize ${SURFACE.mutedText}`}>{inc.category}</span>
                    <span className={`ml-auto text-xs ${SURFACE.mutedText}`}>{formatTime(inc.timestamp)}</span>
                  </div>
                  <p className="break-words text-xs text-foreground md:truncate">
                    {inc.description}
                  </p>
                </div>
                {!inc.resolved && (
                  <button
                    onClick={() => handleResolve(inc.id)}
                    disabled={!!pendingIds[inc.id]}
                    className={`mt-1.5 text-xs disabled:cursor-not-allowed disabled:text-muted-foreground/60 ${BUTTON.link}`}
                  >
                    {pendingIds[inc.id] ? "Resolving..." : "Mark resolved"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
