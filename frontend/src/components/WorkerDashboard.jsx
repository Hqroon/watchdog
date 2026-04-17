import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const PIE_COLORS = { low: "#22c55e", medium: "#eab308", high: "#ef4444" };
const CATEGORY_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#94a3b8"];

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

export default function WorkerDashboard({ incidents, stats }) {
  const pieData = Object.entries(stats.by_severity ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const categoryData = groupByCategory(incidents);
  const hourData     = groupByHour(incidents);
  const repeatedIssues = getRepeatedIssues(incidents);

  const kpis = [
    { label: "Total Incidents", value: stats.total },
    { label: "Unresolved",      value: stats.unresolved },
    { label: "High Severity",   value: stats.by_severity?.high ?? 0 },
    { label: "Low Severity",    value: stats.by_severity?.low  ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Worker Dashboard</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-none">
            <CardContent className="px-4 py-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{kpi.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pattern alerts */}
      {repeatedIssues.length > 0 && (
        <div className="space-y-2">
          {repeatedIssues.map(({ category, count }) => (
            <Alert key={category} variant="destructive">
              <AlertTitle className="capitalize">{category} — Repeated Issue</AlertTitle>
              <AlertDescription>
                {count} unresolved incidents in this category. Immediate attention recommended.
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <p className="text-sm font-medium text-muted-foreground">By Severity</p>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <p className="text-sm font-medium text-muted-foreground">By Category</p>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Incidents by hour */}
      {hourData.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <p className="text-sm font-medium text-muted-foreground">Incidents by Hour (today)</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={hourData}>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent incidents table */}
      <Card className="shadow-none overflow-hidden">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Recent Incidents</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.slice(0, 20).map((inc) => (
                  <TableRow key={inc.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(inc.timestamp * 1000).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={inc.severity === "high" ? "destructive" : "secondary"}
                        className="capitalize text-xs"
                      >
                        {inc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground text-xs">{inc.category}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{inc.description}</TableCell>
                    <TableCell className="text-xs">
                      {inc.resolved ? (
                        <Badge variant="outline" className="text-green-600 border-green-500">Resolved</Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-500">Open</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {incidents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No incidents recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
