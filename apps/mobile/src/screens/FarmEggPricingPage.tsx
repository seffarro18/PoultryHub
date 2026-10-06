import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Egg, Pencil, ShieldAlert } from "lucide-react";
import { listEggPriceHistory, listEggPrices } from "@poultryhub/shared/services/eggPricingService";
import PageBackButton from "../components/PageBackButton";
import EggPriceFormDrawer from "../components/finance/EggPriceFormDrawer";
import Button from "@poultryhub/shared/components/ui/Button";
import { SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import { StaggerGroup, StaggerItem } from "@poultryhub/shared/components/motion/Stagger";
import EmptyState from "@poultryhub/shared/components/ui/EmptyState";
import ErrorState from "@poultryhub/shared/components/ui/ErrorState";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import type { EggPrice, EggPriceHistoryEntry } from "@poultryhub/shared/types/eggPricing";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

export default function FarmEggPricingPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [prices, setPrices] = useState<EggPrice[]>([]);
  const [history, setHistory] = useState<EggPriceHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [priceRows, historyRows] = await Promise.all([listEggPrices(), listEggPriceHistory()]);
      setPrices(priceRows);
      setHistory(historyRows);
    } catch (err) {
      console.error("[FarmEggPricingPage] failed to load egg pricing:", err);
      setLoadError(getErrorMessage(err, "Unable to load egg prices."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Staff has no Egg Pricing access — skip the fetch entirely rather than
    // relying on RLS to just return empty rows.
    if (user?.farmId && user.role !== "Staff") void refresh();
    else setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.farmId, user?.role]);

  if (user?.role === "Staff") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Access Restricted</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">Egg Pricing contains confidential farm financial information and is available to Farm Admin and Manager accounts only.</p>
        </div>
      </div>
    );
  }

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Not assigned to a farm yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Ask your Super Admin to assign your account to a farm before you can manage egg pricing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <PageBackButton />
            <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Egg Pricing</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Manage current egg selling prices.</p>
        </div>
        {!isLoading && !loadError && (
          <Button variant="primary" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
            Edit Prices
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <ErrorState message={loadError} onRetry={refresh} />
        </div>
      ) : (
        <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {prices.map((price) => (
            <StaggerItem key={price.eggSize} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <p className="text-sm font-semibold text-[var(--color-foreground)]">{price.eggSize}</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Full Tray</p>
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">₱{price.fullTrayPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Half Tray</p>
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">₱{price.halfTrayPrice.toLocaleString()}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Last Updated {new Date(price.updatedAt).toLocaleDateString()}
                {price.updatedByName ? ` by ${price.updatedByName}` : ""}
              </p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}

      <div>
        <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Price History</h2>
        <div className="mt-3">
          {isLoading ? null : history.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <EmptyState icon={Egg} title="No price changes yet" description="Any edits to egg prices will be logged here." />
            </div>
          ) : (
            <StaggerGroup className="flex flex-col gap-2">
              {history.map((entry) => (
                <StaggerItem key={entry.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-foreground)]">
                      {entry.eggSize} — {entry.unitType === "full_tray" ? "Full Tray" : "Half Tray"}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">{new Date(entry.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    ₱{entry.previousPrice.toLocaleString()} → ₱{entry.newPrice.toLocaleString()}
                    {entry.updatedByName ? ` · Updated by ${entry.updatedByName}` : ""}
                  </p>
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <EggPriceFormDrawer
            farmId={user.farmId}
            prices={prices}
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              toast.success("Egg prices updated successfully.");
              void refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
