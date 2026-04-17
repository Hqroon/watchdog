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

function getRepeatedIssues(incidents) {
  const map = {};
  for (const inc of incidents) {
    if (!inc.resolved && inc.category) {
      map[inc.category] = (map[inc.category] || 0) + 1;
    }
  }
  return Object.entries(map)
    .filter(([, count]) => count >= 3)
    .map(([category, count]) => ({ category, count }));
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
  const repeatedIssues = getRepeatedIssues(incidents);
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Incidents", value: stats.total, color: "text-foreground" },
          { label: "Unresolved", value: stats.unresolved, color: "text-yellow-600" },
          { label: "High Severity", value: stats.by_severity?.high ?? 0, color: "text-destructive" },
          { label: "Low Severity", value: stats.by_severity?.low ?? 0, color: "text-green-600" },
        ].map((kpi) => (
          <Card key={kpi.label} className="px-4 py-4 text-center shadow-none">
            <p className={`text-2xl font-semibold ${kpi.color}`}>{kpi.value}</p>
            <p className={`mt-1 text-sm ${SURFACE.mutedText}`}>{kpi.label}</p>
          </Card>
        ))}
      </div>

      {repeatedIssues.length > 0 && (
        <div className="space-y-2">
          {repeatedIssues.map(({ category, count }) => (
            <Card key={category} className="border border-destructive/20 bg-destructive/5 px-4 py-3 shadow-none">
              <p className="text-sm font-medium capitalize text-destructive">{category} — Repeated Issue</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {count} unresolved incidents in this category. Immediate attention recommended.
              </p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-4 shadow-none">
          <SectionHeader title="By Severity" className="mb-3" />
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY[entry.name]?.chart ?? CHART.fallback} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip contentStyle={CHART.tooltipContent} labelStyle={CHART.tooltipLabel} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4 shadow-none">
          <SectionHeader title="By Category" className="mb-3" />
          {categoryData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
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
        <Card className="p-4 shadow-none">
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

      <Card className="overflow-hidden shadow-none">
        <div className={`border-b px-4 py-3 ${SURFACE.sectionBorder}`}>
          <SectionHeader title="Recent Incidents" />
        </div>

        <div className="md:hidden">
          {recentIncidents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
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
                            <span className="text-sm capitalize text-foreground">
                              {inc.category}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <StatusDot className={inc.resolved ? "bg-green-500" : "bg-yellow-500"} />
                              <span className={`text-xs ${inc.resolved ? "text-green-600" : "text-yellow-600"}`}>
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
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{formatRelativeTime(inc.timestamp)}</span>
                            <span className="mx-2 text-muted-foreground">•</span>
                            <span>{formatExactTime(inc.timestamp)}</span>
                          </p>
                          <p className="mt-3 text-sm leading-relaxed text-foreground">
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
          <table className="w-full text-xs text-foreground">
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
                  <td className="max-w-xs truncate px-4 py-2">{inc.description}</td>
                  <td className="px-4 py-2">
                    {inc.resolved ? (
                      <span className="text-green-600">Resolved</span>
                    ) : (
                      <span className="text-yellow-600">Open</span>
                    )}
                  </td>
                </tr>
              ))}
              {recentIncidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
