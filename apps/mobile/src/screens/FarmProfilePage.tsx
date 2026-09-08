import { useEffect, useState } from "react";
import { AlertCircle, Building2, Loader2, MapPin, ShieldAlert } from "lucide-react";
import { getMyFarm, updateFarmLocation } from "@poultryhub/shared/services/farmService";
import FarmStatusBadge from "@poultryhub/shared/components/farms/FarmStatusBadge";
import PageBackButton from "../components/PageBackButton";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import type { MyFarmSummary } from "@poultryhub/shared/types/profile";
import FarmLocationMap from "../components/farms/FarmLocationMap";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--color-muted)]">{label}</p>
      <div className="mt-1 text-sm text-[var(--color-foreground)]">{children}</div>
    </div>
  );
}

/** Farm Admin only — matches prevent_farm_field_overreach()'s exact scope (0006_farm_admin_location.sql). Position is read once per tap; nothing runs while this screen isn't open. */
function FarmLocationSection({ farmId, farm }: { farmId: string; farm: MyFarmSummary }) {
  const [latitude, setLatitude] = useState(farm.latitude);
  const [longitude, setLongitude] = useState(farm.longitude);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = latitude !== farm.latitude || longitude !== farm.longitude;

  const handlePick = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setSaved(false);
  };

  const handleSave = async () => {
    if (latitude === null || longitude === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateFarmLocation(farmId, latitude, longitude);
      setSaved(true);
    } catch (err) {
      console.error("[FarmLocationSection] failed to save location:", err);
      setSaveError(err instanceof Error ? err.message : "Couldn't save your farm's location.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="flex items-center gap-2">
        <MapPin size={16} className="text-[var(--color-muted)]" />
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Location</h2>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">Location is used to help identify or update your farm location.</p>

      <div className="mt-4">
        <FarmLocationMap latitude={latitude} longitude={longitude} onPick={handlePick} />
      </div>

      {saveError && <p className="mt-3 text-sm text-[var(--color-danger)]">{saveError}</p>}
      {saved && !dirty && <p className="mt-3 text-sm text-[var(--color-primary)]">Farm location saved.</p>}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!dirty || saving || latitude === null || longitude === null}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="spinner" />}
          Save Location
        </button>
      </div>
    </div>
  );
}

export default function FarmProfilePage() {
  const { user } = useAuth();
  const [farm, setFarm] = useState<MyFarmSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.farmId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    getMyFarm(user.farmId)
      .then((result) => {
        if (!cancelled) setFarm(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load your farm.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.farmId]);

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Not assigned to a farm yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">Ask your Super Admin to assign your account to a farm.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <div className="flex items-center gap-3">
          <PageBackButton />
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">My Farm</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {user.role === "Farm Admin"
            ? "Farm details are managed by your Super Admin — you can update your farm's location below."
            : "Read-only — managed by your Super Admin."}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading…
        </div>
      ) : loadError || !farm ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError ?? "Couldn't load your farm."}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[var(--color-muted)]" />
            <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{farm.name}</h2>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Row label="Farm Name">{farm.name}</Row>
            <Row label="Farm Code">{farm.farmCode ?? "—"}</Row>
            <Row label="Location">{[farm.city, farm.province, farm.region].filter(Boolean).join(", ") || "—"}</Row>
            <Row label="Address">{farm.address ?? "—"}</Row>
            <Row label="Farm Status">
              <FarmStatusBadge status={farm.status} />
            </Row>
          </div>
        </div>
      )}

      {!isLoading && farm && user.role === "Farm Admin" && (
        <FarmLocationSection farmId={user.farmId} farm={farm} />
      )}
    </div>
  );
}
