import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { createFarmMarkerIcon } from "../../lib/leafletIcons";
import { AURORA_MAP_CENTER, AURORA_MAP_ZOOM } from "../../lib/phLocations";

interface FarmLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (lat: number, lng: number) => void;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

/** Click-to-pin mini map for setting a farm's coordinates — the Locations module itself is read-only, so this is the only place they can be set. */
export default function FarmLocationPicker({ latitude, longitude, onPick }: FarmLocationPickerProps) {
  const hasCoords = latitude !== null && longitude !== null;
  const center: [number, number] = hasCoords ? [latitude, longitude] : AURORA_MAP_CENTER;

  return (
    <div className="h-48 w-full overflow-hidden rounded-lg border border-[var(--color-border)]">
      <MapContainer center={center} zoom={hasCoords ? 13 : AURORA_MAP_ZOOM} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ClickHandler onPick={onPick} />
        {hasCoords && <Marker position={[latitude, longitude]} icon={createFarmMarkerIcon("active")} />}
      </MapContainer>
    </div>
  );
}
