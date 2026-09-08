import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, Download, Loader2, Printer, ShieldAlert } from "lucide-react";
import { listInventoryEvents, getStaffCanDeleteInventory } from "@poultryhub/shared/services/poultryInventoryService";
import { listFeedBatches, listFeedDistributionRecords, listVitaminAdministrationRecords, listVitaminBatches } from "@poultryhub/shared/services/feedVitaminService";
import { listMortalityRecords } from "@poultryhub/shared/services/mortalityRecordService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import PoultryStockPanel from "../components/inventory/PoultryStockPanel";
import PageBackButton from "../components/PageBackButton";
import FeedsVitaminsPanel from "../components/inventory/FeedsVitaminsPanel";
import MortalityPanel from "../components/inventory/MortalityPanel";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import type { PoultryEvent, PoultryEventType } from "@poultryhub/shared/types/poultryInventory";
import type { FeedBatch, FeedDistributionRecord, VitaminAdministrationRecord, VitaminBatch } from "@poultryhub/shared/types/feedVitamin";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";

type Tab = "stock" | "feeds" | "mortality";

const EVENT_TYPE_LABELS: Record<PoultryEventType, string> = {
  arrival: "New Arrival",
  transfer: "Transfer",
  sale: "Sale",
  mortality: "Mortality",
  count_update: "Count Update",
};

function initialTabFromPath(pathname: string): Tab {
  if (pathname.endsWith("/feed") || pathname.endsWith("/vitamins")) return "feeds";
  if (pathname.endsWith("/mortality")) return "mortality";
  return "stock";
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function FarmPoultryInventoryPage() {
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
  const [staffCanDelete, setStaffCanDelete] = useState(false);

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
    if (user.role === "Farm Admin") {
      getStaffCanDeleteInventory(user.farmId)
        .then(setStaffCanDelete)
        .catch((err) => console.error("[FarmPoultryInventoryPage] failed to load staff permission:", err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.farmId, user?.role]);

  const today = todayIso();

  const handleExportPoultryStock = () =>
    downloadCsv(
      `poultry-stock-report-${today}.csv`,
      events.map((e) => ({
        Date: e.eventDate,
        "Bird Type": e.birdType,
        Event: EVENT_TYPE_LABELS[e.eventType],
        Quantity: e.quantity,
        Breed: e.breed ?? "",
        Age: e.ageLabel ?? "",
        Source: e.source ?? "",
        "From/To": [e.fromHousePen, e.toHousePen].filter(Boolean).join(" → "),
        "Recorded By": e.recordedByName ?? "",
      }))
    );

  const handleExportFeedConsumption = (period: "Daily" | "Weekly" | "Monthly") =>
    downloadCsv(
      `feed-consumption-${period.toLowerCase()}-${today}.csv`,
      feedDistribution
        .filter((r) => r.status === "approved")
        .map((r) => ({ Date: r.distributionDate, Feed: r.feedName, "House/Pen": r.housePen, Quantity: r.quantityUsed, Unit: r.unit, Chickens: r.numberOfChickens }))
    );

  const handleExportVitaminUsage = () =>
    downloadCsv(
      `vitamin-usage-${today}.csv`,
      vitaminAdministration
        .filter((r) => r.status === "approved")
        .map((r) => ({ Date: r.administrationDate, Vitamin: r.vitaminName, "House/Pen": r.housePen, Dosage: r.dosage ?? "", Quantity: r.quantityUsed, Unit: r.unit, Purpose: r.purpose ?? "" }))
    );

  const handleExportMortality = () =>
    downloadCsv(
      `mortality-report-${today}.csv`,
      mortalityRecords.map((r) => ({
        Date: r.recordDate,
        "House/Pen": r.housePen,
        "Poultry Type": r.birdType ?? "",
        "Dead Birds": r.deadBirds,
        "Cause of Death": r.causeOfDeath,
        "Disposal Method": r.disposalMethod ?? "",
        "Recorded By": r.recordedByName ?? "",
        Status: r.status,
      }))
    );

  const handleExportInventoryMovement = () =>
    downloadCsv(`inventory-movement-report-${today}.csv`, [
      ...feedBatches.map((f) => ({ Type: "Feed batch added", Item: f.feedName, Date: f.purchaseDate, Quantity: f.quantity, Unit: f.unit })),
      ...vitaminBatches.map((v) => ({ Type: "Vitamin batch added", Item: v.vitaminName, Date: v.purchaseDate, Quantity: v.quantity, Unit: v.unit })),
      ...feedDistribution.filter((r) => r.status === "approved").map((r) => ({ Type: "Feed distributed", Item: r.feedName, Date: r.distributionDate, Quantity: -r.quantityUsed, Unit: r.unit })),
      ...vitaminAdministration.filter((r) => r.status === "approved").map((r) => ({ Type: "Vitamin administered", Item: r.vitaminName, Date: r.administrationDate, Quantity: -r.quantityUsed, Unit: r.unit })),
    ]);

  const handleExportMonthlyInventory = () => {
    const monthPrefix = today.slice(0, 7);
    downloadCsv(`monthly-inventory-report-${monthPrefix}.csv`, [
      ...events
        .filter((e) => e.eventDate.slice(0, 7) === monthPrefix)
        .map((e) => ({ Module: "Poultry", Date: e.eventDate, Detail: `${EVENT_TYPE_LABELS[e.eventType]} — ${e.birdType}`, Quantity: e.quantity })),
      ...feedDistribution
        .filter((r) => r.status === "approved" && r.distributionDate.slice(0, 7) === monthPrefix)
        .map((r) => ({ Module: "Feed", Date: r.distributionDate, Detail: r.feedName, Quantity: -r.quantityUsed })),
      ...vitaminAdministration
        .filter((r) => r.status === "approved" && r.administrationDate.slice(0, 7) === monthPrefix)
        .map((r) => ({ Module: "Vitamins", Date: r.administrationDate, Detail: r.vitaminName, Quantity: -r.quantityUsed })),
      ...mortalityRecords
        .filter((r) => r.status === "approved" && r.recordDate.slice(0, 7) === monthPrefix)
        .map((r) => ({ Module: "Mortality", Date: r.recordDate, Detail: r.causeOfDeath, Quantity: -r.deadBirds })),
    ]);
  };

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Not assigned to a farm yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Ask your Super Admin to assign your account to a farm before you can manage inventory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <PageBackButton />
            <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Poultry Inventory</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Manage poultry stock, feeds & vitamins, and mortality for your farm.</p>
        </div>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium print:hidden" style={{ width: "fit-content" }}>
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
            <PoultryStockPanel
              farmId={user.farmId}
              isFarmAdmin={user.role === "Farm Admin"}
              events={events}
              mortalityRecords={mortalityRecords}
              staffCanDelete={staffCanDelete}
              onStaffCanDeleteChange={setStaffCanDelete}
              refresh={refresh}
            />
          )}
          {tab === "feeds" && (
            <FeedsVitaminsPanel
              farmId={user.farmId}
              feedBatches={feedBatches}
              vitaminBatches={vitaminBatches}
              feedDistribution={feedDistribution}
              vitaminAdministration={vitaminAdministration}
              refresh={refresh}
              initialTab={location.pathname.endsWith("/vitamins") ? "vitamins" : "feed"}
            />
          )}
          {tab === "mortality" && <MortalityPanel farmId={user.farmId} records={mortalityRecords} refresh={refresh} />}
        </>
      )}

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Reports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={handleExportPoultryStock} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Poultry Stock Report
          </button>
          <button type="button" onClick={() => handleExportFeedConsumption("Daily")} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Daily Feed Consumption
          </button>
          <button type="button" onClick={() => handleExportFeedConsumption("Weekly")} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Weekly Feed Consumption
          </button>
          <button type="button" onClick={() => handleExportFeedConsumption("Monthly")} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Monthly Feed Consumption
          </button>
          <button type="button" onClick={handleExportVitaminUsage} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Vitamin Usage Report
          </button>
          <button type="button" onClick={handleExportMortality} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Mortality Report
          </button>
          <button type="button" onClick={handleExportInventoryMovement} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Stock Movement Report
          </button>
          <button type="button" onClick={handleExportMonthlyInventory} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Monthly Inventory Report
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Printer size={13} /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
