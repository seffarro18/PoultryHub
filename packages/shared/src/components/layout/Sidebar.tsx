import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, CircleUserRound, LogOut, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import type { NavEntry } from "../../config/navTypes";
import { useAuth } from "../../context/AuthContext";
import { useSystemSettings } from "../../context/SystemSettingsContext";
import ConfirmDialog from "./ConfirmDialog";

interface SidebarProps {
  navigation: NavEntry[];
  homePath: string;
  accountPath: string;
  accountLabel: string;
  portalLabel?: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function Logo({ collapsed, portalLabel }: { collapsed: boolean; portalLabel?: string }) {
  const { settings } = useSystemSettings();
  const systemName = settings?.systemName || "PoultryHub";

  return (
    <div className="flex items-center gap-2.5 px-1">
      {settings?.logoUrl ? (
        <img
          src={settings.logoUrl}
          alt={systemName}
          className="h-8 w-8 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "linear-gradient(135deg, #2E7D32, #66BB6A)" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.95)" />
            <path d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z" fill="#FFC107" />
          </svg>
        </div>
      )}
      {!collapsed && (
        <div className="min-w-0">
          <span className="font-display block truncate text-base font-semibold leading-tight text-[var(--color-primary)]">
            {systemName}
          </span>
          {portalLabel && (
            <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {portalLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function LinkRow({
  label,
  path,
  icon: Icon,
  collapsed,
  indent,
  end,
  onNavigate,
}: {
  label: string;
  path: string;
  icon: LucideIcon;
  collapsed: boolean;
  indent?: boolean;
  end?: boolean;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={path}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
          indent && !collapsed ? "ml-4" : "",
          isActive
            ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
            : "text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]",
        ].join(" ")
      }
    >
      <Icon size={17} strokeWidth={2} className="shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

function GroupRow({
  entry,
  collapsed,
  isOpen,
  onToggle,
  isActive,
  onNavigate,
}: {
  entry: Extract<NavEntry, { type: "group" }>;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const Icon = entry.icon;

  if (collapsed) {
    return (
      <div className="group relative">
        <button
          type="button"
          title={entry.label}
          className={[
            "flex w-full items-center justify-center rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]",
          ].join(" ")}
        >
          <Icon size={17} strokeWidth={2} aria-hidden="true" />
        </button>
        {/* Flyout on hover for collapsed desktop rail */}
        <div className="pointer-events-none absolute left-full top-0 z-20 ml-2 hidden min-w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 lg:block">
          <p className="px-2 py-1 text-xs font-semibold text-[var(--color-muted)]">{entry.label}</p>
          {entry.children.map((child) => (
            <LinkRow
              key={child.path}
              label={child.label}
              path={child.path}
              icon={child.icon}
              collapsed={false}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={[
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
          isActive ? "text-[var(--color-primary)]" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
        ].join(" ")}
      >
        <Icon size={17} strokeWidth={2} className="shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">{entry.label}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 py-0.5">
            {entry.children.map((child) => (
              <LinkRow
                key={child.path}
                label={child.label}
                path={child.path}
                icon={child.icon}
                collapsed={false}
                indent
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  navigation,
  homePath,
  accountPath,
  accountLabel,
  portalLabel,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    const activeGroup = navigation.find(
      (entry) => entry.type === "group" && entry.children.some((child) => location.pathname === child.path)
    );
    if (activeGroup) {
      setOpenGroups((prev) => new Set(prev).add(activeGroup.label));
    }
  }, [location.pathname, navigation]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <>
      {/* Mobile backdrop — tablet+ the sidebar is always visible, so there's nothing to back-drop there */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] transition-transform duration-200 md:translate-x-0",
          collapsed ? "w-[76px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
          <Logo collapsed={collapsed} portalLabel={portalLabel} />
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] md:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-1">
            {navigation.map((entry) =>
              entry.type === "link" ? (
                <LinkRow
                  key={entry.path}
                  label={entry.label}
                  path={entry.path}
                  icon={entry.icon}
                  collapsed={collapsed}
                  end={entry.path === homePath}
                  onNavigate={onCloseMobile}
                />
              ) : (
                <GroupRow
                  key={entry.label}
                  entry={entry}
                  collapsed={collapsed}
                  isOpen={openGroups.has(entry.label)}
                  onToggle={() => toggleGroup(entry.label)}
                  isActive={entry.children.some((c) => location.pathname === c.path)}
                  onNavigate={onCloseMobile}
                />
              )
            )}
          </div>
        </nav>

        <div className="shrink-0 border-t border-[var(--color-border)] px-3 py-3">
          <div className="flex flex-col gap-0.5">
            <LinkRow
              label={accountLabel}
              path={accountPath}
              icon={CircleUserRound}
              collapsed={collapsed}
              onNavigate={onCloseMobile}
            />
            <button
              type="button"
              onClick={() => setConfirmingLogout(true)}
              title={collapsed ? "Logout" : undefined}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
            >
              <LogOut size={17} strokeWidth={2} className="shrink-0" aria-hidden="true" />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            className="mt-2 hidden w-full items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)] md:flex"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {confirmingLogout && (
        <ConfirmDialog
          title="Log out"
          message="Are you sure you want to logout?"
          confirmLabel="Logout"
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={() => {
            setConfirmingLogout(false);
            void signOut();
          }}
        />
      )}
    </>
  );
}
