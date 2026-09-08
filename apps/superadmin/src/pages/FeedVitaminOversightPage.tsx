import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Download,
  Loader2,
  Monitor,
  Search,
  Syringe,
  Wheat,
} from "lucide-react";
import {
  expiringVitamins,
  formatUnitSummary,
  listFeedBatches,
  listFeedDistributionRecords,
  listVitaminAdministrationRecords,
  listVitaminBatches,
  lowStockFeeds,
  lowStockVitamins,
} from "@poultryhub/shared/services/feedVitaminService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import FeedVitaminAnalytics from "../components/feeds/FeedVitaminAnalytics";
import InventoryStatusBadge from "@poultryhub/shared/components/feeds/InventoryStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useBreakpoint } from "@poultryhub/shared/hooks/useBreakpoint";
import type { FeedBatch, FeedDistributionRecord, VitaminAdministrationRecord, VitaminBatch } from "@poultryhub/shared/types/feedVitamin";

type MonitorTab = "feed" | "vitamins";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function FeedVitaminOversightPage() {
  const breakpoint = useBreakpoint();
  const [feedBatches, setFeedBatches] = useState<FeedBatch[]>([]);
  const [vitaminBatches, setVitaminBatches] = useState<VitaminBatch[]>([]);
  const [feedDistribution, setFeedDistribution] = useState<FeedDistributionRecord[]>([]);
  const [vitaminAdministration, setVitaminAdministration] = useState<VitaminAdministrationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [monitorTab, setMonitorTab] = useState<MonitorTab>("feed");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listFeedBatches(), listVitaminBatches(), listFeedDistributionRecords(), listVitaminAdministrationRecords()])
      .then(([feeds, vitamins, distribution, administration]) => {
        if (cancelled) return;
        setFeedBatches(feeds);
        setVitaminBatches(vitamins);
        setFeedDistribution(distribution);
        setVitaminAdministration(administration);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load feed & vitamin data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lowFeed = useMemo(() => lowStockFeeds(feedBatches), [feedBatches]);
  const lowVitamin = useMemo(() => lowStockVitamins(vitaminBatches), [vitaminBatches]);
  const expiring = useMemo(() => expiringVitamins(vitaminBatches), [vitaminBatches]);

  const today = todayIso();
  const feedToday = useMemo(
    () => feedDistribution.filter((r) => r.status === "approved" && r.distributionDate === today).reduce((sum, r) => sum + r.quantityUsed, 0),
    [feedDistribution, today]
  );
  const vitaminToday = useMemo(
    () => vitaminAdministration.filter((r) => r.status === "approved" && r.administrationDate === today).reduce((sum, r) => sum + r.quantityUsed, 0),
    [vitaminAdministration, today]
  );

  const farmsWithLowFeed = useMemo(() => new Set(lowFeed.map((f) => f.farmId)).size, [lowFeed]);
  const farmsWithLowVitamin = useMemo(() => new Set(lowVitamin.map((v) => v.farmId)).size, [lowVitamin]);

  const filteredFeed = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return feedBatches;
    return feedBatches.filter((f) => f.farmName.toLowerCase().includes(term) || f.feedName.toLowerCase().includes(term));
  }, [feedBatches, search]);

  const filteredVitamins = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vitaminBatches;
    return vitaminBatches.filter((v) => v.farmName.toLowerCase().includes(term) || v.vitaminName.toLowerCase().includes(term));
  }, [vitaminBatches, search]);

  const handleExportFeedInventory = () => {
    downloadCsv(
      `feed-inventory-${today}.csv`,
      feedBatches.map((f) => ({
        Farm: f.farmName,
        Feed: f.feedName,
        Category: f.category ?? "",
        Batch: f.batchNumber ?? "",
        Remaining: f.remainingStock,
        Unit: f.unit,
        "Minimum Level": f.minimumStockLevel,
        "Purchase Date": f.purchaseDate,
        "Expiration Date": f.expirationDate ?? "",
      }))
    );
  };

  const handleExportVitaminInventory = () => {
    downloadCsv(
      `vitamin-inventory-${today}.csv`,
      vitaminBatches.map((v) => ({
        Farm: v.farmName,
        Vitamin: v.vitaminName,
        Category: v.category ?? "",
        Batch: v.batchNumber ?? "",
        Remaining: v.remainingStock,
        Unit: v.unit,
        "Minimum Level": v.minimumStockLevel,
        "Purchase Date": v.purchaseDate,
        "Expiration Date": v.expirationDate,
      }))
    );
  };

  const handleExportConsumption = () => {
    const approvedFeed = feedDistribution.filter((r) => r.status === "approved");
    const approvedVitamin = vitaminAdministration.filter((r) => r.status === "approved");
    downloadCsv(`consumption-report-${today}.csv`, [
      ...approvedFeed.map((r) => ({
        Type: "Feed",
        Farm: r.farmName,
        Item: r.feedName,
        Date: r.distributionDate,
        Quantity: r.quantityUsed,
        Unit: r.unit,
      })),
      ...approvedVitamin.map((r) => ({
        Type: "Vitamin",
        Farm: r.farmName,
        Item: r.vitaminName,
        Date: r.administrationDate,
        Quantity: r.quantityUsed,
        Unit: r.unit,
      })),
    ]);
  };

  const handleExportFarmComparison = () => {
    const farmTotals = new Map<string, { farmName: string; feed: number; vitamin: number }>();
    for (const r of feedDistribution) {
      if (r.status !== "approved") continue;
      const entry = farmTotals.get(r.farmId) ?? { farmName: r.farmName, feed: 0, vitamin: 0 };
      entry.feed += r.quantityUsed;
      farmTotals.set(r.farmId, entry);
    }
    for (const r of vitaminAdministration) {
      if (r.status !== "approved") continue;
      const entry = farmTotals.get(r.farmId) ?? { farmName: r.farmName, feed: 0, vitamin: 0 };
      entry.vitamin += r.quantityUsed;
      farmTotals.set(r.farmId, entry);
    }
    downloadCsv(
      `farm-comparison-${today}.csv`,
      [...farmTotals.values()].map((f) => ({ Farm: f.farmName, "Feed Used": f.feed, "Vitamin Used": f.vitamin }))
    );
  };

  const handleExportMonthlyInventory = () => {
    downloadCsv(`monthly-inventory-${today}.csv`, [
      ...feedBatches.map((f) => ({ Type: "Feed", Farm: f.farmName, Item: f.feedName, "Purchase Date": f.purchaseDate, Quantity: f.quantity, Remaining: f.remainingStock, Unit: f.unit })),
      ...vitaminBatches.map((v) => ({ Type: "Vitamin", Farm: v.farmName, Item: v.vitaminName, "Purchase Date": v.purchaseDate, Quantity: v.quantity, Remaining: v.remainingStock, Unit: v.unit })),
    ]);
  };

  if (breakpoint !== "desktop") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Monitor size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Best viewed on a larger screen</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Feeds & Vitamins supervision is designed for desktop. Please switch to a larger screen.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="spinner" /> Loading feed & vitamin data…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
        <AlertCircle size={20} className="text-[var(--color-danger)]" />
        <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
      </div>
    );
  }

  const alerts = [
    ...lowFeed.map((f) => ({ key: `feed-${f.id}`, label: `${f.farmName} · ${f.feedName}`, detail: `${f.remainingStock} ${f.unit} left (min ${f.minimumStockLevel})`, severity: "warning" as const })),
    ...lowVitamin.map((v) => ({ key: `vitamin-${v.id}`, label: `${v.farmName} · ${v.vitaminName}`, detail: `${v.remainingStock} ${v.unit} left (min ${v.minimumStockLevel})`, severity: "warning" as const })),
    ...expiring.map((e) => ({
      key: `expiring-${e.vitamin.id}`,
      label: `${e.vitamin.farmName} · ${e.vitamin.vitaminName}`,
      detail: e.isExpired ? `Expired ${Math.abs(e.daysUntilExpiry)} day(s) ago` : `Expires in ${e.daysUntilExpiry} day(s)`,
      severity: e.isExpired ? ("critical" as const) : ("warning" as const),
    })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Feeds & Vitamins</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          System-wide supervision — read-only. Inventory management happens in each farm's own portal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Wheat} label="Total Feed Inventory" value={formatUnitSummary(feedBatches)} />
        <StatTile icon={Syringe} label="Total Vitamin Inventory" value={formatUnitSummary(vitaminBatches)} />
        <StatTile icon={AlertTriangle} label="Farms w/ Low Feed" value={farmsWithLowFeed} />
        <StatTile icon={AlertTriangle} label="Farms w/ Low Vitamin" value={farmsWithLowVitamin} />
        <StatTile icon={Wheat} label="Feed Used Today" value={feedToday} />
        <StatTile icon={Syringe} label="Vitamin Used Today" value={vitaminToday} />
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Alerts</h2>
          <div className="mt-3 flex flex-col divide-y divide-[var(--color-border)]">
            {alerts.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className={a.severity === "critical" ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"} />
                  <span className="text-[var(--color-foreground)]">{a.label}</span>
                </div>
                <span className="text-xs text-[var(--color-muted)]">{a.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Inventory Monitoring</h2>
          <div className="relative sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search farm or item…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="mt-3 flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium" style={{ width: "fit-content" }}>
          {(["feed", "vitamins"] as MonitorTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMonitorTab(tab)}
              className={`rounded-md px-3 py-1.5 capitalize transition-colors ${
                monitorTab === tab ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {tab === "feed" ? "Feed" : "Vitamins"}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {monitorTab === "feed" ? (
            filteredFeed.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--color-muted)]">No feed batches match that search.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                      <th className="px-4 py-3 font-medium">Farm</th>
                      <th className="px-4 py-3 font-medium">Feed</th>
                      <th className="px-4 py-3 font-medium">Available Stock</th>
                      <th className="px-4 py-3 font-medium">Last Updated</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeed.map((f) => (
                      <tr key={f.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{f.farmName}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{f.feedName}</td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{f.remainingStock.toLocaleString()} {f.unit}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(f.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <InventoryStatusBadge remainingStock={f.remainingStock} minimumStockLevel={f.minimumStockLevel} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredVitamins.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No vitamin batches match that search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Farm</th>
                    <th className="px-4 py-3 font-medium">Vitamin</th>
                    <th className="px-4 py-3 font-medium">Available Stock</th>
                    <th className="px-4 py-3 font-medium">Last Updated</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVitamins.map((v) => (
                    <tr key={v.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{v.farmName}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{v.vitaminName}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{v.remainingStock.toLocaleString()} {v.unit}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(v.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <InventoryStatusBadge remainingStock={v.remainingStock} minimumStockLevel={v.minimumStockLevel} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <FeedVitaminAnalytics
        feedBatches={feedBatches}
        vitaminBatches={vitaminBatches}
        feedDistributionRecords={feedDistribution}
        vitaminAdministrationRecords={vitaminAdministration}
      />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Reports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={handleExportFeedInventory} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Feed Inventory Report
          </button>
          <button type="button" onClick={handleExportVitaminInventory} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Vitamin Inventory Report
          </button>
          <button type="button" onClick={handleExportConsumption} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Consumption Report
          </button>
          <button type="button" onClick={handleExportFarmComparison} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Building2 size={13} /> Farm Comparison Report
          </button>
          <button type="button" onClick={handleExportMonthlyInventory} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Monthly Inventory Report
          </button>
        </div>
      </div>
    </div>
  );
}
