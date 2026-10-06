import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ChevronRight, History } from "lucide-react";
import { Link } from "react-router-dom";
import KpiCard from "@poultryhub/shared/components/dashboard/KpiCard";
import NeedsAttentionSection from "@poultryhub/shared/components/dashboard/attention/NeedsAttentionSection";
import Button from "@poultryhub/shared/components/ui/Button";
import { Skeleton, SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import FadeIn from "@poultryhub/shared/components/motion/FadeIn";
import { StaggerGroup, StaggerItem } from "@poultryhub/shared/components/motion/Stagger";
import SeverityBadge from "@poultryhub/shared/components/audit/SeverityBadge";
import FarmEggProductionChart from "../components/dashboard/charts/FarmEggProductionChart";
import {
  fetchStaffDashboardData,
  getStaffEggProductionTrend,
  getStaffKpiCards,
  getStaffOverview,
  hasStaffDataGap,
  type StaffDashboardData,
} from "@poultryhub/shared/services/farmDashboardService";
import { listMyRecentAuditLogs } from "@poultryhub/shared/services/auditLogService";
import { formatAuditAction, type AuditLogEntry } from "@poultryhub/shared/types/auditLog";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { useNeedsAttention } from "../hooks/useNeedsAttention";
import { useFarmDashboardRealtime, STAFF_SCOPED_TABLES } from "../hooks/useFarmDashboardRealtime";
import { attentionModulePath } from "../lib/attentionRoutes";
import {
  FARM_AUDIT_LOGS_PATH,
  FARM_EGG_PRODUCTION_PATH,
  FARM_FEED_PATH,
  FARM_POULTRY_INVENTORY_PATH,
  FARM_TASKS_PATH,
} from "../config/farmNavigation";
import type { AttentionItem } from "@poultryhub/shared/types/attention";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";
import MobileEggHeroCard from "../components/dashboard/MobileEggHeroCard";
import MobileQuickActions, { type MobileQuickAction } from "../components/dashboard/MobileQuickActions";
import { Egg as EggIcon, ListChecks, Wheat, Bird as BirdIcon } from "lucide-react";

const STAFF_QUICK_ACTIONS: MobileQuickAction[] = [
  { label: "Egg Production", path: FARM_EGG_PRODUCTION_PATH, icon: EggIcon },
  { label: "Tasks", path: FARM_TASKS_PATH, icon: ListChecks },
  { label: "Feed/Vitamins", path: FARM_FEED_PATH, icon: Wheat },
  { label: "Poultry Inventory", path: FARM_POULTRY_INVENTORY_PATH, icon: BirdIcon },
  { label: "My Activity", path: FARM_AUDIT_LOGS_PATH, icon: History },
];

/**
 * Staff's own Dashboard — strictly operational (see AGENTS.md's Staff
 * confidentiality notes). Deliberately a separate component/data-fetch from
 * FarmDashboardPage rather than the same page with cards hidden by CSS:
 * fetchStaffDashboardData() never calls listSales()/listExpenses() at all,
 * so there's nothing financial to leak even if a future edit forgot to
 * filter a card out.
 */
export default function StaffDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const attention = useNeedsAttention();
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);
  const dataRef = useRef<StaffDashboardData | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const handleAttentionAction = (item: AttentionItem) => {
    void attention.markRead(item);
    navigate(attentionModulePath(item.module));
  };

  const refresh = useCallback(
    (showSpinner = false) => {
      if (!user?.farmId) {
        setIsLoading(false);
        return;
      }
      if (showSpinner) setIsLoading(true);
      Promise.all([fetchStaffDashboardData(user.farmId), listMyRecentAuditLogs(5)])
        .then(([result, recent]) => {
          if (!cancelledRef.current) {
            setData(result);
            setActivity(recent);
            setLoadError(null);
          }
        })
        .catch((err: unknown) => {
          console.error("[StaffDashboardPage] failed to load dashboard data:", err);
          if (!cancelledRef.current && dataRef.current === null) {
            setLoadError(getErrorMessage(err, "Failed to load dashboard data."));
          }
        })
        .finally(() => {
          if (!cancelledRef.current) setIsLoading(false);
        });
    },
    [user?.farmId]
  );

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  useFarmDashboardRealtime(user?.farmId, user?.id, () => refresh(false), STAFF_SCOPED_TABLES);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Here's what's happening on the farm today.</p>
      </div>

      <NeedsAttentionSection
        items={attention.items}
        isLoading={attention.isLoading}
        error={attention.error}
        onRetry={() => void attention.refresh()}
        onAction={handleAttentionAction}
        onDismiss={(item) => void attention.dismiss(item)}
        dismissingId={attention.dismissingId}
      />

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : loadError || !data ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-foreground)]">Unable to load</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{loadError ?? "Couldn't load dashboard data."}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh(true)}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {hasStaffDataGap(data) && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-4 py-3">
              <p className="text-sm text-[var(--color-danger)]">Some stock data couldn't be loaded.</p>
              <Button variant="outline" size="sm" onClick={() => refresh(true)}>
                Retry
              </Button>
            </div>
          )}

          {/* Mobile (<768px) — hero card + quick actions, matching the dedicated mobile redesign. */}
          <div className="flex flex-col gap-6 md:hidden">
            <MobileEggHeroCard
              today={getStaffOverview(data).todaysEggProduction}
              weekly={getStaffOverview(data).weeklyEggProduction}
              monthly={getStaffOverview(data).monthlyEggProduction}
            />
            <MobileQuickActions actions={STAFF_QUICK_ACTIONS} />
          </div>

          {/* Tablet/desktop (>=768px) — existing KPI grid + chart + activity, unchanged. */}
          <div className="hidden md:flex md:flex-col md:gap-6">
            <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {getStaffKpiCards(data).map((kpi) => (
                <StaggerItem key={kpi.id}>
                  <KpiCard data={kpi} />
                </StaggerItem>
              ))}
            </StaggerGroup>

            <FadeIn delay={0.1}>
              <FarmEggProductionChart data={getStaffEggProductionTrend(data)} />
            </FadeIn>

            <FadeIn delay={0.16} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">My Activity</h2>
                <Link to={FARM_AUDIT_LOGS_PATH} className="flex items-center gap-0.5 text-xs font-medium text-[var(--color-primary)]">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              {activity.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <History size={18} className="text-[var(--color-muted)]" />
                  <p className="text-sm text-[var(--color-muted)]">No activity recorded yet.</p>
                </div>
              ) : (
                <ol className="mt-3 flex flex-col gap-2">
                  {activity.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-foreground)]">{formatAuditAction(l.action)}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-muted)]">{l.module} · {new Date(l.createdAt).toLocaleString()}</p>
                      </div>
                      <SeverityBadge severity={l.severity} />
                    </li>
                  ))}
                </ol>
              )}
            </FadeIn>
          </div>
        </>
      )}
    </div>
  );
}
