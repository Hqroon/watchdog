export const SURFACE = {
  app: "bg-gray-950 text-white",
  card: "bg-gray-900 rounded-xl border border-gray-800",
  cardOverflow: "bg-gray-900 rounded-xl border border-gray-800 overflow-hidden",
  mutedText: "text-gray-400",
  sectionBorder: "border-gray-800",
  hoverRow: "hover:bg-gray-800/50 transition-colors",
  tableHeader: "bg-gray-800 text-gray-400 uppercase tracking-wide",
};

export const BUTTON = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  primaryGhost: "text-gray-400 hover:text-white hover:bg-gray-800",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  link: "text-blue-400 hover:text-blue-300 transition-colors",
  tabActive: "bg-blue-600 text-white",
  tabInactive: "text-gray-400 hover:bg-gray-800",
};

export const STATUS = {
  liveDot: "bg-green-500",
  connectingDot: "bg-gray-600 animate-pulse",
  openBadge: "bg-red-600 text-white",
};

export const SEVERITY = {
  low: {
    border: "border-green-500",
    badge: "bg-green-600 text-white",
    pill: "bg-green-800 text-green-200",
    text: "text-green-400",
    chart: "#22c55e",
  },
  medium: {
    border: "border-yellow-500",
    badge: "bg-yellow-600 text-white",
    pill: "bg-yellow-800 text-yellow-200",
    text: "text-yellow-400",
    chart: "#eab308",
  },
  high: {
    border: "border-red-500",
    badge: "bg-red-600 text-white",
    pill: "bg-red-800 text-red-200",
    text: "text-red-400",
    chart: "#ef4444",
  },
};

export const CHART = {
  fallback: "#94a3b8",
  categoryColors: ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#94a3b8"],
  tooltipContent: { background: "#1f2937", border: "none", borderRadius: 8 },
  tooltipLabel: { color: "#e5e7eb" },
  axisTick: { fontSize: 11, fill: "#9ca3af" },
};
