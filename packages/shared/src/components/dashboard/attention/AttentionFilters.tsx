export type AttentionStatusFilter = "all" | "high" | "medium" | "low" | "unread" | "dismissed";

const STATUS_OPTIONS: { value: AttentionStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "unread", label: "Unread" },
  { value: "dismissed", label: "Dismissed" },
];

interface CategoryOption {
  value: string;
  label: string;
}

interface AttentionFiltersProps {
  status: AttentionStatusFilter;
  onStatusChange: (status: AttentionStatusFilter) => void;
  /** Omitted entirely for Staff — category filtering only makes sense once there's more than one module to filter across. */
  categories?: CategoryOption[];
  category?: string;
  onCategoryChange?: (category: string) => void;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-white"
          : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function AttentionFilters({ status, onStatusChange, categories, category, onCategoryChange }: AttentionFiltersProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {STATUS_OPTIONS.map((option) => (
          <Pill key={option.value} active={status === option.value} onClick={() => onStatusChange(option.value)}>
            {option.label}
          </Pill>
        ))}
      </div>
      {categories && categories.length > 0 && onCategoryChange && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {categories.map((option) => (
            <Pill key={option.value} active={category === option.value} onClick={() => onCategoryChange(option.value)}>
              {option.label}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}
