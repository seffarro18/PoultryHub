import { useEffect, useRef } from "react";
import type L from "leaflet";
import { LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Crosshair, Expand } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { createFarmMarkerIcon } from "../../lib/leafletIcons";
import { AURORA_MAP_CENTER, AURORA_MAP_ZOOM } from "../../lib/phLocations";
import FarmMarkerPopup from "./FarmMarkerPopup";
import type { ManagedFarm } from "@poultryhub/shared/types/farm";

interface FarmMapProps {
  /** Already filtered to farms with valid coordinates and passing the current filters. */
  farms: ManagedFarm[];
  populationByFarm: Map<string, number>;
  selectedFarmId: string | null;
  /** Bumped whenever the map should re-center on the selected farm (search result, "Locate" click) — a plain state change wouldn't retrigger if the same farm is picked twice in a row. */
  focusToken: number;
  onSelectFarm: (farm: ManagedFarm) => void;
  onViewDetails: (farm: ManagedFarm) => void;
}

function hasCoords(farm: ManagedFarm): farm is ManagedFarm & { latitude: number; longitude: number } {
  return farm.latitude !== null && farm.longitude !== null;
}

/** Lives inside MapContainer so it can reach the Leaflet map instance via useMap(). */
function MapController({
  farms,
  selectedFarmId,
  focusToken,
}: {
  farms: (ManagedFarm & { latitude: number; longitude: number })[];
  selectedFarmId: string | null;
  focusToken: number;
}) {
  const map = useMap();
  const didInitialFit = useRef(false);

  // Auto Fit All — once on first load, and again whenever the filtered set changes.
  useEffect(() => {
    if (farms.length === 0) return;
    const bounds = farms.map((f) => [f.latitude, f.longitude] as [number, number]);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    didInitialFit.current = true;
  }, [farms, map]);

  // Locate Farm — flies to the selected farm whenever focusToken changes.
  useEffect(() => {
    if (!selectedFarmId || focusToken === 0) return;
    const farm = farms.find((f) => f.id === selectedFarmId);
    if (farm) map.flyTo([farm.latitude, farm.longitude], 15, { duration: 0.75 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  return null;
}

function MapControls({ onCenterAll }: { onCenterAll: () => void }) {
  const map = useMap();

  const handleFullscreen = () => {
    const el = map.getContainer();
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 60 }}>
      <div className="leaflet-control leaflet-bar flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-md">
        <button
          type="button"
          onClick={onCenterAll}
          title="Fit all farms"
          className="flex h-8 w-8 items-center justify-center text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          <Crosshair size={15} />
        </button>
        <button
          type="button"
          onClick={handleFullscreen}
          title="Fullscreen"
          className="flex h-8 w-8 items-center justify-center border-t border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          <Expand size={15} />
        </button>
      </div>
    </div>
  );
}

export default function FarmMap({
  farms,
  populationByFarm,
  selectedFarmId,
  focusToken,
  onSelectFarm,
  onViewDetails,
}: FarmMapProps) {
  const mappable = farms.filter(hasCoords);
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div className="h-full w-full overflow-hidden rounded-2xl border border-[var(--color-border)]">
      <MapContainer
        center={AURORA_MAP_CENTER}
        zoom={AURORA_MAP_ZOOM}
        className="h-full w-full"
        ref={mapRef}
        zoomControl
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Road Map">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MarkerClusterGroup chunkedLoading>
          {mappable.map((farm) => (
            <Marker
              key={farm.id}
              position={[farm.latitude, farm.longitude]}
              icon={createFarmMarkerIcon(farm.status, farm.id === selectedFarmId)}
              eventHandlers={{ click: () => onSelectFarm(farm) }}
            >
              <Popup minWidth={260}>
                <FarmMarkerPopup
                  farm={farm}
                  population={populationByFarm.get(farm.id) ?? 0}
                  onViewDetails={() => onViewDetails(farm)}
                />
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        <MapController farms={mappable} selectedFarmId={selectedFarmId} focusToken={focusToken} />
        <MapControls
          onCenterAll={() => {
            if (mappable.length === 0 || !mapRef.current) return;
            mapRef.current.fitBounds(
              mappable.map((f) => [f.latitude, f.longitude]),
              { padding: [48, 48], maxZoom: 14 }
            );
          }}
        />
      </MapContainer>
    </div>
  );
}
