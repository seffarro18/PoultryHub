import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import BottomNav from "./BottomNav";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import type { NavEntry, NavLink } from "../../config/navTypes";

interface DashboardLayoutProps {
  navigation: NavEntry[];
  homePath: string;
  accountPath: string;
  accountLabel: string;
  portalLabel?: string;
  notificationCount: number;
  /** When provided, mobile (<768px) replaces the sidebar with a fixed bottom tab bar instead of a drawer. */
  bottomNavItems?: NavLink[];
}

export default function DashboardLayout({
  navigation,
  homePath,
  accountPath,
  accountLabel,
  portalLabel,
  notificationCount,
  bottomNavItems,
}: DashboardLayoutProps) {
  const breakpoint = useBreakpoint();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(breakpoint === "tablet");

  // Tablet defaults to the collapsed icon rail, desktop to expanded — but stays
  // user-toggleable within a breakpoint. Re-derive whenever the breakpoint itself
  // changes so resizing the window updates it live.
  useEffect(() => {
    setCollapsed(breakpoint === "tablet");
  }, [breakpoint]);

  // Prevent background scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const useBottomNav = breakpoint === "mobile" && Boolean(bottomNavItems?.length);
  const location = useLocation();
  const showBackButton = useBottomNav && location.pathname !== homePath;

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {!useBottomNav && (
        <Sidebar
          navigation={navigation}
          homePath={homePath}
          accountPath={accountPath}
          accountLabel={accountLabel}
          portalLabel={portalLabel}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
        />
      )}

      <div className={useBottomNav ? "" : collapsed ? "md:pl-[76px]" : "md:pl-64"}>
        <Topbar
          accountPath={accountPath}
          accountLabel={accountLabel}
          homePath={homePath}
          onOpenMobileSidebar={() => setMobileOpen(true)}
          notificationCount={notificationCount}
          showMobileMenuButton={!useBottomNav}
          showBackButton={showBackButton}
        />
        <main className={`px-4 py-6 sm:px-6 lg:px-8 ${useBottomNav ? "pb-24" : ""}`}>
          <Outlet />
        </main>
      </div>

      {useBottomNav && bottomNavItems && (
        <BottomNav items={bottomNavItems} homePath={homePath} notificationCount={notificationCount} />
      )}
    </div>
  );
}
