import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import AttentionCard from "./AttentionCard";
import AttentionSummary from "./AttentionSummary";
import AttentionEmptyState from "./AttentionEmptyState";
import { Skeleton, SkeletonCard } from "../../ui/Skeleton";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import { StaggerGroup, StaggerItem } from "../../motion/Stagger";
import { PRIORITY_ORDER, type AttentionItem, type AttentionPriority } from "../../../types/attention";

interface NeedsAttentionSectionProps {
  items: AttentionItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onAction: (item: AttentionItem) => void;
  onDismiss: (item: AttentionItem) => void;
  dismissingId?: string | null;
}

const EMPTY_COUNTS: Record<AttentionPriority, number> = { high: 0, medium: 0, low: 0 };

export default function NeedsAttentionSection({
  items,
  isLoading,
  error,
  onRetry,
  onAction,
  onDismiss,
  dismissingId,
}: NeedsAttentionSectionProps) {
  const [search, setSearch] = useState("");

  // No status/category filter tabs — this always shows the live, active
  // (non-dismissed) queue, sorted by priority then recency. Search is the
  // only remaining way to narrow it down.
  const active = useMemo(() => items.filter((i) => !i.dismissed), [items]);

  const counts = useMemo(() => {
    const result = { ...EMPTY_COUNTS };
    for (const item of active) result[item.priority] += 1;
    return result;
  }, [active]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return active
      .filter((item) => !term || item.title.toLowerCase().includes(term) || item.description.toLowerCase().includes(term))
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.createdAt.localeCompare(a.createdAt));
  }, [active, search]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  // Dismissed items have no filter tab to reveal them anymore, so "nothing
  // active" and "nothing has ever needed attention" are the same case now —
  // both get the friendly empty state instead of a blank list.
  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <AttentionEmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AttentionSummary total={active.length} counts={counts} />

      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search needs attention…"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching items" description="Try a different search term." />
      ) : (
        <StaggerGroup className="flex flex-col gap-3">
          {filtered.map((item) => (
            <StaggerItem key={item.id}>
              <AttentionCard item={item} onAction={onAction} onDismiss={onDismiss} dismissing={dismissingId === item.id} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  );
}
