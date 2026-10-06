import { SEVERITY_META, type AuditSeverity } from "../../types/auditLog";

export default function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const { label, color } = SEVERITY_META[severity];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
