import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PROFILE_PATH } from "../../config/navigation";

interface ProfilePageHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * Shared header for every screen reached from the Profile menu — back arrow
 * + title (+ optional subtitle). Super Admin's topbar never shows an
 * automatic back button (that's the mobile bottom-nav app's mechanism —
 * desktop relies on the always-visible sidebar instead), so unlike the
 * mobile version of this component, drill-down pages need their own way
 * back. Falls back to the Profile menu itself if there's no real
 * navigation history (e.g. opened directly via URL).
 */
export default function ProfilePageHeader({ title, subtitle }: ProfilePageHeaderProps) {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (window.history.length > 2 ? navigate(-1) : navigate(PROFILE_PATH))}
          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
          aria-label="Back to Profile"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">{title}</h1>
      </div>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>}
    </div>
  );
}
