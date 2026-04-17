import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = { low: "#22c55e", medium: "#eab308", high: "#ef4444" };
const CATEGORY_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#94a3b8"];

function formatRelative(ts) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() / 1000) - ts);
  if (diff < 60)  return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)} hr ago`;
}

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

export default function SupervisorDashboard({ incidents, stats }) {
  const pieData = Object.entries(stats.by_severity ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const categoryData = groupByCategory(incidents);
  const hourData = groupByHour(incidents);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Supervisor Dashboard</h2>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total Incidents",
            value: stats.total,
            color: "text-white",
            sub: `(${incidents.reduce((s, i) => s + (i.occurrence_count ?? 1), 0)} total occurrences)`,
          },
          { label: "Unresolved", value: stats.unresolved, color: "text-yellow-400" },
          { label: "High Severity", value: stats.by_severity?.high ?? 0, color: "text-red-400" },
          { label: "Low Severity", value: stats.by_severity?.low ?? 0, color: "text-green-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-4 text-center">
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.label}</p>
            {kpi.sub && <p className="text-xs text-gray-500 mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Severity pie */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">By Severity</h3>
          {pieData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category bar */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">By Category</h3>
          {categoryData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8 }}
                  labelStyle={{ color: "#e5e7eb" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Hourly trend */}
      {hourData.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Incidents by Hour (today)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourData}>
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8 }}
                labelStyle={{ color: "#e5e7eb" }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent incidents table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <h3 className="text-sm font-semibold text-gray-300 px-4 py-3 border-b border-gray-800">
          Recent Incidents
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead className="bg-gray-800 text-gray-400 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left">Last Seen</th>
                <th className="px-4 py-2 text-left">Count</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {incidents.slice(0, 20).map((inc) => (
                <tr key={inc.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-400">
                    {new Date(inc.timestamp * 1000).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2 capitalize">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                        inc.severity === "high"
                          ? "bg-red-800 text-red-200"
                          : inc.severity === "medium"
                          ? "bg-yellow-800 text-yellow-200"
                          : "bg-green-800 text-green-200"
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2 capitalize text-gray-400">{inc.category}</td>
                  <td className="px-4 py-2 max-w-xs truncate">{inc.description}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-400 text-xs">
                    {formatRelative(inc.last_seen ?? inc.timestamp)}
                  </td>
                  <td className="px-4 py-2">
                    {(inc.occurrence_count ?? 1) > 1 ? (
                      <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-yellow-800 text-yellow-200">
                        ×{inc.occurrence_count}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    {inc.resolved ? (
                      <span className="text-green-400">Resolved</span>
                    ) : (
                      <span className="text-yellow-400">Open</span>
                    )}
                  </td>
                </tr>
              ))}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No incidents recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
