const SEVERITY_STYLES = {
  low: { bg: "bg-green-950 border-green-700", icon: "✅", label: "Low Risk", text: "text-green-300" },
  medium: { bg: "bg-yellow-950 border-yellow-600", icon: "⚠️", label: "Medium Risk", text: "text-yellow-300" },
  high: { bg: "bg-red-950 border-red-600", icon: "🚨", label: "High Risk", text: "text-red-300" },
};

export default function CoachPanel({ analysis }) {
  if (!analysis) return null;

  const { incident, coach } = analysis;
  const severity = incident?.severity ?? "low";
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low;

  if (incident?.safe || !incident) {
    return (
      <div className="bg-green-950 border border-green-700 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-xl">✅</span>
        <p className="text-green-300 text-sm font-medium">No hazards detected — workstation is safe.</p>
      </div>
    );
  }

  return (
    <div className={`${style.bg} border rounded-xl px-4 py-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{style.icon}</span>
        <span className={`font-bold text-sm ${style.text}`}>{style.label}</span>
        <span className="ml-auto text-xs text-gray-400 capitalize">{incident.category}</span>
      </div>

      <p className="text-sm text-gray-200 mb-3">{incident.description}</p>

      {coach && (
        <div className="bg-black/30 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wide">Coach</p>
          <p className="text-sm text-white leading-relaxed">{coach}</p>
        </div>
      )}
    </div>
  );
}
