import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { getStaffCanDeleteInventory, listInventoryEvents } from "@poultryhub/shared/services/poultryInventoryService";
import { listFeedBatches, listFeedDistributionRecords, listVitaminAdministrationRecords, listVitaminBatches } from "@poultryhub/shared/services/feedVitaminService";
import { listMortalityRecords } from "@poultryhub/shared/services/mortalityRecordService";
import StaffPoultryStockPanel from "../components/inventory/StaffPoultryStockPanel";
import StaffFeedsVitaminsPanel from "../components/inventory/StaffFeedsVitaminsPanel";
import StaffMortalityPanel from "../components/inventory/StaffMortalityPanel";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import type { PoultryEvent } from "@poultryhub/shared/types/poultryInventory";
import type { FeedBatch, FeedDistributionRecord, VitaminAdministrationRecord, VitaminBatch } from "@poultryhub/shared/types/feedVitamin";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";

type Tab = "stock" | "feeds" | "mortality";

function initialTabFromPath(pathname: string): Tab {
  if (pathname.endsWith("/feed") || pathname.endsWith("/vitamins")) return "feeds";
  if (pathname.endsWith("/mortality")) return "mortality";
  return "stock";
}

export default function StaffPoultryInventoryPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => initialTabFromPath(location.pathname));

  const [events, setEvents] = useState<PoultryEvent[]>([]);
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>([]);
  const [feedBatches, setFeedBatches] = useState<FeedBatch[]>([]);
  const [vitaminBatches, setVitaminBatches] = useState<VitaminBatch[]>([]);
  const [feedDistribution, setFeedDistribution] = useState<FeedDistributionRecord[]>([]);
  const [vitaminAdministration, setVitaminAdministration] = useState<VitaminAdministrationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [evts, mortality, feeds, vitamins, feedDist, vitaminAdmin] = await Promise.all([
        listInventoryEvents(),
        listMortalityRecords(),
        listFeedBatches(),
        listVitaminBatches(),
        listFeedDistributionRecords(),
        listVitaminAdministrationRecords(),
      ]);
      setEvents(evts);
      setMortalityRecords(mortality);
      setFeedBatches(feeds);
      setVitaminBatches(vitamins);
      setFeedDistribution(feedDist);
      setVitaminAdministration(vitaminAdmin);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load inventory data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.farmId) {
      setIsLoading(false);
      return;
    }
    void refresh();
    getStaffCanDeleteInventory(user.farmId)
      .then(setCanDelete)
      .catch((err) => console.error("[StaffPoultryInventoryPage] failed to load delete permission:", err));
  }, [user?.farmId]);

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Not assigned to a farm yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Ask your Super Admin to assign your account to a farm before you can record inventory changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Poultry Inventory</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Record stock, feed & vitamin usage, and mortality for your farm.</p>
      </div>

      <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium" style={{ width: "fit-content" }}>
        {([
          ["stock", "Poultry Stock"],
          ["feeds", "Feeds & Vitamins"],
          ["mortality", "Mortality"],
        ] as [Tab, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1.5 transition-colors ${tab === value ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading…
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
        </div>
      ) : (
        <>
          {tab === "stock" && (
            <StaffPoultryStockPanel
              farmId={user.farmId}
              userId={user.id}
              events={events}
              mortalityRecords={mortalityRecords}
              canDelete={canDelete}
              refresh={refresh}
            />
          )}
          {tab === "feeds" && (
            <StaffFeedsVitaminsPanel
              farmId={user.farmId}
              userId={user.id}
              feedBatches={feedBatches}
              vitaminBatches={vitaminBatches}
              feedDistribution={feedDistribution}
              vitaminAdministration={vitaminAdministration}
              refresh={refresh}
            />
          )}
          {tab === "mortality" && (
            <StaffMortalityPanel farmId={user.farmId} userId={user.id} records={mortalityRecords} refresh={refresh} />
          )}
        </>
      )}
    </div>
  );
}
