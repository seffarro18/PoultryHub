/** Shimmer placeholder block — Tailwind's built-in animate-pulse, no custom CSS needed. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--color-muted-bg)] ${className}`} aria-hidden="true" />;
}

/** Loading placeholder shaped like a record card (header row + a 2-column stat grid) — swap in wherever a list of record cards is still loading. */
export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
