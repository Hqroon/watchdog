export const SURFACE = {
  app: "bg-background text-foreground",
  card: "rounded-xl border border-border bg-card text-card-foreground shadow-none",
  cardOverflow: "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-none",
  mutedText: "text-muted-foreground",
  sectionBorder: "border-border",
  hoverRow: "transition-colors hover:bg-muted/50",
  tableHeader: "bg-muted text-muted-foreground uppercase tracking-wide",
};

export const BUTTON = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/85",
  primaryGhost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-destructive/15 text-destructive hover:bg-destructive/20",
  link: "text-primary transition-colors hover:text-primary/80",
  tabActive: "bg-[#A362C9] text-white hover:bg-[#8f52b3]",
  tabInactive: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

export const STATUS = {
  liveDot: "bg-green-500",
  connectingDot: "bg-muted-foreground animate-pulse",
  openBadge: "bg-destructive text-white",
};

export const SEVERITY = {
  low: {
    border: "border-green-500",
    badge: "bg-green-600 text-white",
    pill: "border border-green-500/30 bg-green-500/15 text-green-600",
    text: "text-green-600",
    chart: "#22c55e",
  },
  medium: {
    border: "border-yellow-500",
    badge: "bg-yellow-500 text-black",
    pill: "border border-yellow-500/30 bg-yellow-500/15 text-yellow-600",
    text: "text-yellow-600",
    chart: "#eab308",
  },
  high: {
    border: "border-red-500",
    badge: "bg-destructive text-white",
    pill: "border border-destructive/30 bg-destructive/15 text-destructive",
    text: "text-destructive",
    chart: "#ef4444",
  },
};

export const CHART = {
  fallback: "#94a3b8",
  categoryColors: ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#94a3b8"],
  tooltipContent: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 },
  tooltipLabel: { color: "var(--foreground)" },
  axisTick: { fontSize: 11, fill: "#9ca3af" },
};
