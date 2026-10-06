import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { FARM_OPERATIONS_PATH } from "../config/farmNavigation";

/**
 * Back button rendered directly in a page's own title row, for the
 * Operations hub's sub-pages specifically — DashboardLayout's
 * pageOwnsBackButtonPaths suppresses the topbar's automatic back button on
 * these exact paths so there's exactly one, not two.
 */
export default function PageBackButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 2 ? navigate(-1) : navigate(FARM_OPERATIONS_PATH))}
      className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
      aria-label="Back"
    >
      <ArrowLeft size={20} />
    </button>
  );
}
