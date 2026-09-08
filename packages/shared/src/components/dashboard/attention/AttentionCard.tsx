import { X } from "lucide-react";
import Button from "../../ui/Button";
import { MODULE_META, PRIORITY_META } from "./attentionDisplay";
import type { AttentionItem } from "../../../types/attention";

interface AttentionCardProps {
  item: AttentionItem;
  onAction: (item: AttentionItem) => void;
  onDismiss: (item: AttentionItem) => void;
  dismissing?: boolean;
}

export default function AttentionCard({ item, onAction, onDismiss, dismissing }: AttentionCardProps) {
  const priority = PRIORITY_META[item.priority];
  const module = MODULE_META[item.module];
  const PriorityIcon = priority.icon;
  const ModuleIcon = module.icon;

  return (
    <div
      className={`relative rounded-2xl border bg-[var(--color-card)] p-4 ${
        item.isRead ? "border-[var(--color-border)]" : "border-[var(--color-primary)]/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: priority.color, backgroundColor: `color-mix(in srgb, ${priority.color} 14%, transparent)` }}
          >
            <PriorityIcon size={12} /> {priority.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-muted)]">
            <ModuleIcon size={12} /> {module.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(item)}
          disabled={dismissing}
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)] disabled:opacity-50"
        >
          <X size={14} />
        </button>
      </div>

      <p className="mt-2 text-sm font-semibold text-[var(--color-foreground)]">{item.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{item.description}</p>

      <Button variant="outline" size="sm" onClick={() => onAction(item)} className="mt-3">
        {item.actionLabel}
      </Button>
    </div>
  );
}
