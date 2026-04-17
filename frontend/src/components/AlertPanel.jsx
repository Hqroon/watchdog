import { useState } from "react";
import { BUTTON, SEVERITY, SURFACE } from "../ui/tokens.js";
import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";

function formatTime(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

async function resolveIncident(id) {
  await fetch(`/incidents/${id}/resolve`, { method: "POST" });
}

export default function AlertPanel({ incidents, stats }) {
  const [filter, setFilter] = useState("all"); // all | unresolved | high

  const filtered = incidents.filter((i) => {
    if (filter === "unresolved") return !i.resolved;
    if (filter === "high") return i.severity === "high";
    return true;
  });

  return (
    <Card className="flex h-full max-h-[80vh] min-h-[20rem] flex-col xl:sticky xl:top-4">
      {/* Stats */}
      <div className={`px-4 pt-4 pb-2 border-b ${SURFACE.sectionBorder}`}>
        <SectionHeader
          title="Incidents"
          subtitle="Track live issues and resolve them as the workstation changes."
          className="mb-3"
        />
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-gray-800 rounded-lg py-2">
            <p className="text-lg font-bold text-white">{stats.total}</p>
            <p className={SURFACE.mutedText}>Total</p>
          </div>
          <div className="bg-yellow-900/50 rounded-lg py-2">
            <p className="text-lg font-bold text-yellow-300">{stats.unresolved}</p>
            <p className={SURFACE.mutedText}>Open</p>
          </div>
          <div className="bg-red-900/50 rounded-lg py-2">
            <p className="text-lg font-bold text-red-400">{stats.by_severity?.high ?? 0}</p>
            <p className={SURFACE.mutedText}>High</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-2">
          {["all", "unresolved", "high"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-xs py-1 rounded transition-colors capitalize ${
                filter === f ? BUTTON.tabActive : BUTTON.tabInactive
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Incident list */}
      <ul className={`flex-1 overflow-y-auto incident-scroll divide-y ${SURFACE.sectionBorder}`}>
        {filtered.length === 0 ? (
          <li className="px-4 py-8 text-center text-gray-500 text-sm">No incidents.</li>
        ) : (
          filtered.map((inc) => (
            <li
              key={inc.id}
              className={`px-4 py-3 ${SURFACE.hoverRow} ${
                inc.resolved ? "opacity-40" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge className={SEVERITY[inc.severity]?.pill ?? SEVERITY.low.pill}>
                      {inc.severity}
                    </Badge>
                    <span className={`text-xs capitalize ${SURFACE.mutedText}`}>{inc.category}</span>
                    <span className="ml-auto text-xs text-gray-500">{formatTime(inc.timestamp)}</span>
                  </div>
                  <p className="text-xs text-gray-300 truncate">{inc.description}</p>
                </div>
              </div>
              {!inc.resolved && (
                <button
                  onClick={() => resolveIncident(inc.id)}
                  className={`mt-1.5 text-xs ${BUTTON.link}`}
                >
                  Mark resolved
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
