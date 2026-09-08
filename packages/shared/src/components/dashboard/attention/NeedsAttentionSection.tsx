import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import AttentionCard from "./AttentionCard";
import AttentionSummary from "./AttentionSummary";
import AttentionFilters, { type AttentionStatusFilter } from "./AttentionFilters";
import AttentionEmptyState from "./AttentionEmptyState";
import { Skeleton, SkeletonCard } from "../../ui/Skeleton";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import { StaggerGroup, StaggerItem } from "../../motion/Stagger";
import { PRIORITY_ORDER, type AttentionItem, type AttentionPriority } from "../../../types/attention";

interface CategoryOption {
  value: string;
  label: string;
}

interface NeedsAttentionSectionProps {
  items: AttentionItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onAction: (item: AttentionItem) => void;
  onDismiss: (item: AttentionItem) => void;
  dismissingId?: string | null;
  /** Module-based filter row — Farm Admin/Super Admin pass this, Staff doesn't (nothing to categorize across for a personal task list). */
  categories?: CategoryOption[];
  /** Maps a category filter value to whether an item belongs to it — required whenever `categories` is passed. */
  matchesCategory?: (item: AttentionItem, category: string) => boolean;
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
  categories,
  matchesCategory,
}: NeedsAttentionSectionProps) {
  const [status, setStatus] = useState<AttentionStatusFilter>("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const active = useMemo(() => items.filter((i) => !i.dismissed), [items]);

  const counts = useMemo(() => {
    const result = { ...EMPTY_COUNTS };
    for (const item of active) result[item.priority] += 1;
    return result;
  }, [active]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (status === "dismissed") return item.dismissed;
        if (item.dismissed) return false;
        if (status === "unread") return !item.isRead;
        if (status === "high" || status === "medium" || status === "low") return item.priority === status;
        return true;
      })
      .filter((item) => (category === "all" || !matchesCategory ? true : matchesCategory(item, category)))
      .filter((item) => !term || item.title.toLowerCase().includes(term) || item.description.toLowerCase().includes(term))
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.createdAt.localeCompare(a.createdAt));
  }, [items, status, category, search, matchesCategory]);

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
        <ErrorState message="Unable to load Needs Attention." onRetry={onRetry} />
      </div>
    );
  }

  // Only the true "nothing has ever needed attention" case gets the full-page
  // empty state. If everything is merely dismissed (active.length === 0 but
  // items.length > 0), fall through to the normal view so the Dismissed
  // filter tab stays reachable instead of hiding that history entirely.
  if (items.length === 0) {
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

      <AttentionFilters
        status={status}
        onStatusChange={setStatus}
        categories={categories}
        category={category}
        onCategoryChange={setCategory}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching items" description="Try a different filter or search term." />
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
