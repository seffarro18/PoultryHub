import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import BottomNav from "./BottomNav";
import PageTransition from "../motion/PageTransition";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { NotificationCountProvider } from "../../context/NotificationCountContext";
import type { NavEntry, NavLink } from "../../config/navTypes";

interface DashboardLayoutProps {
  navigation: NavEntry[];
  homePath: string;
  accountPath: string;
  accountLabel: string;
  portalLabel?: string;
  notificationsPath: string;
  /** When provided, mobile (<768px) replaces the sidebar with a fixed bottom tab bar instead of a drawer. */
  bottomNavItems?: NavLink[];
  /** Paths whose page renders its own back button inline (see PageBackButton) rather than relying on the topbar's automatic one — the topbar suppresses its back button on exactly these paths so there's never two. */
  pageOwnsBackButtonPaths?: string[];
  /** Forwarded to NotificationCountProvider — see its own doc comment. Only the mobile app passes this. */
  onNewNotifications?: (newCount: number, previousCount: number) => void;
}

export default function DashboardLayout({
  navigation,
  homePath,
  accountPath,
  accountLabel,
  portalLabel,
  notificationsPath,
  bottomNavItems,
  pageOwnsBackButtonPaths,
  onNewNotifications,
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
  // Every bottom-nav tab is a root-level screen, not just the home tab — a
  // hub landing page like Operations (reached by tapping its own tab) is
  // just as much a root as Home is. Only pages reached by drilling into a
  // hub (or otherwise not directly on a tab) get a back button.
  const isBottomNavRoot = bottomNavItems?.some((item) => item.path === location.pathname) ?? false;
  const pageOwnsBackButton = pageOwnsBackButtonPaths?.includes(location.pathname) ?? false;
  const showBackButton = useBottomNav && !isBottomNavRoot && !pageOwnsBackButton;

  return (
    <NotificationCountProvider onNewNotifications={onNewNotifications}>
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
            notificationsPath={notificationsPath}
            onOpenMobileSidebar={() => setMobileOpen(true)}
            showMobileMenuButton={!useBottomNav}
            showBackButton={showBackButton}
          />
          <main className={`px-4 py-6 sm:px-6 lg:px-8 ${useBottomNav ? "pb-24" : ""}`}>
            <PageTransition />
          </main>
        </div>

        {useBottomNav && bottomNavItems && <BottomNav items={bottomNavItems} homePath={homePath} />}
      </div>
    </NotificationCountProvider>
  );
}
