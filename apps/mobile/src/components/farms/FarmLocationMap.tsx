import { useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Loader2 } from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { getLocationStatus, openAppSettings, requestLocationPermission } from "../../lib/permissions";

// Philippines-wide default view when a farm has no coordinates set yet.
const DEFAULT_CENTER: [number, number] = [12.8797, 121.774];
const DEFAULT_ZOOM = 6;
const PINNED_ZOOM = 15;

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

/** Recenters the map imperatively when coordinates change from outside a click (e.g. "Use My Current Location"), since MapContainer's own `center` prop only applies on first mount. */
function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  map.setView([latitude, longitude], PINNED_ZOOM);
  return null;
}

interface FarmLocationMapProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (lat: number, lng: number) => void;
}

/**
 * Single-marker click-to-pin map — the mobile equivalent of Super Admin's
 * FarmLocationPicker.tsx, without the multi-farm clustering dependencies
 * that page needs and this one doesn't. Tapping the map or "Use My Current
 * Location" both just set a point; nothing here runs unless the user
 * explicitly interacts with it — no background/continuous tracking.
 */
export default function FarmLocationMap({ latitude, longitude, onPick }: FarmLocationMapProps) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const hasCoords = latitude !== null && longitude !== null;

  const handleUseCurrentLocation = async () => {
    setLocationError(null);
    setPermissionBlocked(false);
    const current = await getLocationStatus();
    const status = current === "granted" ? current : await requestLocationPermission();
    if (status !== "granted") {
      setLocationError("Location access is off for PoultryHub.");
      setPermissionBlocked(true);
      return;
    }
    setLocating(true);
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      onPick(Number(position.coords.latitude.toFixed(6)), Number(position.coords.longitude.toFixed(6)));
    } catch (err) {
      console.error("[FarmLocationMap] failed to get current position:", err);
      setLocationError("Couldn't get your current location. You can still tap the map to set a point.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="h-56 w-full overflow-hidden rounded-lg border border-[var(--color-border)]">
        <MapContainer
          center={hasCoords ? [latitude, longitude] : DEFAULT_CENTER}
          zoom={hasCoords ? PINNED_ZOOM : DEFAULT_ZOOM}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ClickHandler onPick={onPick} />
          {hasCoords && (
            <>
              <Marker position={[latitude, longitude]} icon={markerIcon} />
              <Recenter latitude={latitude} longitude={longitude} />
            </>
          )}
        </MapContainer>
      </div>

      <button
        type="button"
        onClick={() => void handleUseCurrentLocation()}
        disabled={locating}
        className="flex w-fit items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)] disabled:opacity-60"
      >
        {locating ? <Loader2 size={14} className="spinner" /> : <Crosshair size={14} />}
        Use My Current Location
      </button>

      {locationError && (
        <div className="flex flex-col items-start gap-1 rounded-lg bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
          <p>{locationError}</p>
          {permissionBlocked && (
            <button type="button" onClick={() => void openAppSettings()} className="font-semibold underline underline-offset-2">
              Open Settings
            </button>
          )}
        </div>
      )}
    </div>
  );
}
