import { SURFACE } from "./tokens.js";

export default function SectionHeader({ title, subtitle, action, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-200">{title}</h2>
        {subtitle && <p className={`mt-1 text-xs ${SURFACE.mutedText}`}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
