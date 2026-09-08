import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { createManagedFarm, updateManagedFarm } from "@poultryhub/shared/services/farmService";
import { AURORA_MUNICIPALITIES, AURORA_PROVINCE, AURORA_REGION, findCityByName } from "../../lib/phLocations";
import FarmLocationPicker from "./FarmLocationPicker";
import { FARM_TYPE_SUGGESTIONS, type FarmInput, type ManagedFarm } from "@poultryhub/shared/types/farm";

interface FarmFormDrawerProps {
  /** null = register mode */
  farm: ManagedFarm | null;
  onClose: () => void;
  onSaved: () => void;
}

// PoultryHub only operates in Aurora province — region/province are fixed,
// not user-selectable, and only Aurora's 8 municipalities are offered.
function toInputState(farm: ManagedFarm | null): FarmInput {
  if (farm) {
    return {
      name: farm.name,
      owner: farm.owner,
      address: farm.address,
      region: AURORA_REGION.name,
      province: AURORA_PROVINCE.name,
      city: farm.city,
      contactNumber: farm.contactNumber,
      email: farm.email,
      farmType: farm.farmType,
      capacity: farm.capacity,
      farmCode: farm.farmCode,
      latitude: farm.latitude,
      longitude: farm.longitude,
    };
  }
  return {
    name: "",
    owner: null,
    address: null,
    region: AURORA_REGION.name,
    province: AURORA_PROVINCE.name,
    city: null,
    contactNumber: null,
    email: null,
    farmType: null,
    capacity: null,
    farmCode: null,
    latitude: null,
    longitude: null,
  };
}

export default function FarmFormDrawer({ farm, onClose, onSaved }: FarmFormDrawerProps) {
  const isEdit = farm !== null;
  const [input, setInput] = useState<FarmInput>(() => toInputState(farm));
  const [cityCode, setCityCode] = useState(
    () => (farm?.city ? findCityByName(AURORA_PROVINCE.code, farm.city)?.code : undefined) ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCityChange = (code: string) => {
    const city = AURORA_MUNICIPALITIES.find((c) => c.code === code);
    setCityCode(code);
    setInput((prev) => ({ ...prev, city: city?.name ?? null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.name.trim()) {
      setError("Farm name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: FarmInput = { ...input, name: input.name.trim() };
      if (isEdit) {
        await updateManagedFarm(farm.id, payload);
      } else {
        await createManagedFarm(payload);
      }
      onSaved();
    } catch (err) {
      console.error("[FarmFormDrawer] save failed:", err);
      setError("Couldn't save this farm. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">
            {isEdit ? "Edit Farm" : "Register Farm"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label htmlFor="farm-name" className="text-sm font-medium text-[var(--color-foreground)]">
                  Farm Name
                </label>
                <input
                  id="farm-name"
                  value={input.name}
                  onChange={(e) => setInput((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Sunrise Poultry Farm"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="farm-code" className="text-sm font-medium text-[var(--color-foreground)]">
                  Farm Code
                </label>
                <input
                  id="farm-code"
                  value={input.farmCode ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, farmCode: e.target.value || null }))}
                  placeholder="Optional"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="farm-owner" className="text-sm font-medium text-[var(--color-foreground)]">
                  Owner
                </label>
                <input
                  id="farm-owner"
                  value={input.owner ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, owner: e.target.value || null }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="farm-type" className="text-sm font-medium text-[var(--color-foreground)]">
                  Farm Type
                </label>
                <input
                  id="farm-type"
                  list="farm-type-suggestions"
                  value={input.farmType ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, farmType: e.target.value || null }))}
                  placeholder="e.g. Layer Farm"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
                <datalist id="farm-type-suggestions">
                  {FARM_TYPE_SUGGESTIONS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--color-foreground)]">Region</label>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2 text-sm text-[var(--color-muted)]">
                  {AURORA_REGION.name}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--color-foreground)]">Province</label>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2 text-sm text-[var(--color-muted)]">
                  {AURORA_PROVINCE.name}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="farm-city" className="text-sm font-medium text-[var(--color-foreground)]">
                  Municipality
                </label>
                <select
                  id="farm-city"
                  value={cityCode}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                >
                  <option value="">Select…</option>
                  {AURORA_MUNICIPALITIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="farm-address" className="text-sm font-medium text-[var(--color-foreground)]">
                Street / Barangay / Details
              </label>
              <input
                id="farm-address"
                value={input.address ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, address: e.target.value || null }))}
                placeholder="e.g. Brgy. San Juan, Purok 3"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-foreground)]">
                Map Coordinates <span className="font-normal text-[var(--color-muted)]">(click to pin, or enter manually)</span>
              </label>
              <FarmLocationPicker
                latitude={input.latitude}
                longitude={input.longitude}
                onPick={(lat, lng) => setInput((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  value={input.latitude ?? ""}
                  onChange={(e) =>
                    setInput((prev) => ({ ...prev, latitude: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  placeholder="Latitude"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={input.longitude ?? ""}
                  onChange={(e) =>
                    setInput((prev) => ({ ...prev, longitude: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  placeholder="Longitude"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="farm-contact" className="text-sm font-medium text-[var(--color-foreground)]">
                  Contact Number
                </label>
                <input
                  id="farm-contact"
                  value={input.contactNumber ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, contactNumber: e.target.value || null }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="farm-email" className="text-sm font-medium text-[var(--color-foreground)]">
                  Email
                </label>
                <input
                  id="farm-email"
                  type="email"
                  value={input.email ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, email: e.target.value || null }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="farm-capacity" className="text-sm font-medium text-[var(--color-foreground)]">
                Capacity (birds)
              </label>
              <input
                id="farm-capacity"
                type="number"
                min={0}
                value={input.capacity ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, capacity: e.target.value === "" ? null : Number(e.target.value) }))}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving && <Loader2 size={14} className="spinner" />}
              {isEdit ? "Save changes" : "Register farm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
