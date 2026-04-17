import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useState } from "react";
import { CHART, SEVERITY, SURFACE } from "../ui/tokens.js";
import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import StatusDot from "../ui/StatusDot.jsx";

function groupByCategory(incidents) {
  const map = {};
  for (const inc of incidents) {
    if (!inc.category || inc.category === "none") continue;
    map[inc.category] = (map[inc.category] || 0) + 1;
  }
  return Object.entries(map).map(([name, count]) => ({ name, count }));
}

function groupByHour(incidents) {
  const map = {};
  for (const inc of incidents) {
    const h = new Date(inc.timestamp * 1000).getHours();
    const label = `${h}:00`;
    map[label] = (map[label] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([hour, count]) => ({ hour, count }));
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp * 1000);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 365) return `${days} day${days === 1 ? "" : "s"} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function formatExactTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function WorkerDashboard({ incidents, stats }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const pieData = Object.entries(stats.by_severity ?? {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  const categoryData = groupByCategory(incidents);
  const hourData = groupByHour(incidents);
  const recentIncidents = incidents.slice(0, 20);

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Worker Dashboard"
        subtitle="Monitor safety volume, severity distribution, and recent incident history."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Incidents", value: stats.total, color: "text-white" },
          { label: "Unresolved", value: stats.unresolved, color: "text-yellow-400" },
          { label: "High Severity", value: stats.by_severity?.high ?? 0, color: SEVERITY.high.text },
          { label: "Low Severity", value: stats.by_severity?.low ?? 0, color: SEVERITY.low.text },
        ].map((kpi) => (
          <Card key={kpi.label} className="px-4 py-4 text-center">
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className={`text-xs mt-1 ${SURFACE.mutedText}`}>{kpi.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionHeader title="By Severity" className="mb-3" />
          {pieData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY[entry.name]?.chart ?? CHART.fallback} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeader title="By Category" className="mb-3" />
          {categoryData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData}>
                <XAxis dataKey="name" tick={CHART.axisTick} />
                <YAxis tick={CHART.axisTick} allowDecimals={false} />
                <Tooltip contentStyle={CHART.tooltipContent} labelStyle={CHART.tooltipLabel} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryData.map((_, index) => (
                    <Cell key={index} fill={CHART.categoryColors[index % CHART.categoryColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {hourData.length > 0 && (
        <Card className="p-4">
          <SectionHeader title="Incidents by Hour" subtitle="Today" className="mb-3" />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourData}>
              <XAxis dataKey="hour" tick={CHART.axisTick} />
              <YAxis tick={CHART.axisTick} allowDecimals={false} />
              <Tooltip contentStyle={CHART.tooltipContent} labelStyle={CHART.tooltipLabel} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className={`px-4 py-3 border-b ${SURFACE.sectionBorder}`}>
          <SectionHeader title="Recent Incidents" />
        </div>

        <div className="md:hidden">
          {recentIncidents.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No incidents recorded yet.
            </div>
          ) : (
            <div className={`divide-y ${SURFACE.sectionBorder}`}>
              {recentIncidents.map((inc) => {
                const isExpanded = expandedIds.has(inc.id);
                const severity = SEVERITY[inc.severity] ?? SEVERITY.low;
                const panelId = `incident-panel-${inc.id}`;

                return (
                  <div
                    key={inc.id}
                    className={`px-4 py-3 transition-colors ${SURFACE.hoverRow}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(inc.id)}
                      className="block w-full text-left"
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className={severity.pill}>{inc.severity}</Badge>
                            <span className="text-sm capitalize text-white">
                              {inc.category}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <StatusDot className={inc.resolved ? "bg-green-500" : "bg-yellow-500"} />
                              <span className={`text-xs ${inc.resolved ? "text-green-400" : "text-yellow-400"}`}>
                                {inc.resolved ? "Resolved" : "Open"}
                              </span>
                            </div>
                          </div>
                          {!isExpanded && (
                            <div className="mt-1">
                              <span className={`text-xs ${SURFACE.mutedText}`}>
                                {formatRelativeTime(inc.timestamp)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pt-0.5">
                          <span className={`text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                            ▼
                          </span>
                        </div>
                      </div>
                    </button>

                    <div
                      id={panelId}
                      className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out ${
                        isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="min-h-0">
                        <div className="border-t border-gray-800 pt-3 mt-3">
                          <p className="text-xs text-gray-300">
                            <span className="font-semibold text-white">{formatRelativeTime(inc.timestamp)}</span>
                            <span className={`mx-2 ${SURFACE.mutedText}`}>•</span>
                            <span className={SURFACE.mutedText}>{formatExactTime(inc.timestamp)}</span>
                          </p>
                          <p className="mt-3 text-sm leading-relaxed text-gray-200">
                            {inc.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs text-gray-300">
            <thead className={SURFACE.tableHeader}>
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${SURFACE.sectionBorder}`}>
              {recentIncidents.map((inc) => (
                <tr key={inc.id} className={SURFACE.hoverRow}>
                  <td className={`px-4 py-2 whitespace-nowrap ${SURFACE.mutedText}`}>
                    {new Date(inc.timestamp * 1000).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2 capitalize">
                    <Badge className={SEVERITY[inc.severity]?.pill ?? SEVERITY.low.pill}>
                      {inc.severity}
                    </Badge>
                  </td>
                  <td className={`px-4 py-2 capitalize ${SURFACE.mutedText}`}>{inc.category}</td>
                  <td className="px-4 py-2 max-w-xs truncate">{inc.description}</td>
                  <td className="px-4 py-2">
                    {inc.resolved ? (
                      <span className="text-green-400">Resolved</span>
                    ) : (
                      <span className="text-yellow-400">Open</span>
                    )}
                  </td>
                </tr>
              ))}
              {recentIncidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No incidents recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
