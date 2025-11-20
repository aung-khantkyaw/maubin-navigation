import { useEffect, useMemo, useState } from "react";
import type { LatLngTuple } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { cn, computeSegmentLengths, formatDistanceMeters } from "../lib/utils";

type IntersectionPoint = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

export type RoadPolyline = {
  id: string;
  name: string;
  positions: LatLngTuple[];
  lengthMeters?: number;
};

type RoadIntersectionMapProps = {
  intersections: IntersectionPoint[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  disabled?: boolean;
  existingRoads?: RoadPolyline[];
  cityCenter?: { lon: number; lat: number } | null;
};

type MapViewControllerProps = {
  bounds: LatLngTuple[] | null;
  focusPositions: LatLngTuple[] | null;
  fallbackCenter: LatLngTuple;
  fallbackZoom: number;
};

type MarkerLayerProps = {
  intersections: IntersectionPoint[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
};

const DEFAULT_CENTER: LatLngTuple = [19.747039, 96.0678096];
const DEFAULT_ZOOM = 6;
const CITY_ZOOM = 18;
const ACTIVE_ZOOM = 20;

type BaseLayerKey = "imagery" | "streets";

const BASE_LAYERS: Record<
  BaseLayerKey,
  { name: string; url: string; attribution: string }
> = {
  imagery: {
    name: "Satellite",
    attribution: "",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  },
  streets: {
    name: "Street",
    attribution: "© OpenStreetMap contributors",
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
  },
};

// Ensure Leaflet icons load correctly with Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LeafletIconPrototype = L.Icon.Default.prototype as any;
if (LeafletIconPrototype && LeafletIconPrototype._getIconUrl) {
  delete LeafletIconPrototype._getIconUrl;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapViewController({
  bounds,
  focusPositions,
  fallbackCenter,
  fallbackZoom,
}: MapViewControllerProps) {
  const map = useMap();

  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };

    map.whenReady(() => {
      map.invalidateSize();
    });

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (focusPositions && focusPositions.length > 0) {
      if (focusPositions.length === 1) {
        map.setView(focusPositions[0], ACTIVE_ZOOM, { animate: true });
      } else {
        const focusBounds = L.latLngBounds(focusPositions);
        map.fitBounds(focusBounds, { padding: [36, 36], maxZoom: ACTIVE_ZOOM });
      }
    } else if (bounds && bounds.length > 0) {
      const derivedBounds = L.latLngBounds(bounds);
      map.fitBounds(derivedBounds, { padding: [48, 48], maxZoom: CITY_ZOOM });
    } else {
      map.setView(fallbackCenter, fallbackZoom, { animate: true });
    }
    map.invalidateSize();
  }, [bounds, focusPositions, fallbackCenter, fallbackZoom, map]);

  return null;
}

function MarkerLayer({
  intersections,
  selectedIds,
  onToggle,
  disabled,
}: MarkerLayerProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <>
      {intersections.map((intersection) => {
        const isSelected = selectedSet.has(intersection.id);
        const stepIndex = selectedIds.indexOf(intersection.id);
        const isEndpoint =
          stepIndex === 0 || stepIndex === selectedIds.length - 1;

        return (
          <CircleMarker
            key={intersection.id}
            center={[intersection.lat, intersection.lon]}
            radius={isSelected ? 9 : 6}
            pathOptions={{
              color: isSelected
                ? isEndpoint
                  ? "#2563eb"
                  : "#38bdf8"
                : "#00ff73ff",
              weight: isSelected ? 3 : 1,
              fillOpacity: isSelected ? 0.7 : 0.45,
              fillColor: isSelected
                ? isEndpoint
                  ? "#2563eb"
                  : "#38bdf8"
                : "#00ff73ff",
            }}
            eventHandlers={{
              click: () => {
                if (disabled) return;
                onToggle(intersection.id);
              },
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -4]}
              opacity={1}
              permanent={false}
            >
              <div className="text-xs font-medium text-slate-700 bg-white">
                {stepIndex >= 0 ? `${stepIndex + 1}. ` : ""}
                {intersection.name}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

export default function RoadIntersectionMap({
  intersections,
  selectedIds,
  onChange,
  disabled,
  existingRoads,
  cityCenter,
}: RoadIntersectionMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [baseLayerKey, setBaseLayerKey] = useState<BaseLayerKey>("imagery");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const intersectionLookup = useMemo(() => {
    const lookup: Record<string, IntersectionPoint> = {};
    intersections.forEach((intersection) => {
      lookup[intersection.id] = intersection;
    });
    return lookup;
  }, [intersections]);

  const existingRoadPositions = useMemo(() => {
    if (!existingRoads?.length) return [] as LatLngTuple[];
    return existingRoads.flatMap((road) => road.positions);
  }, [existingRoads]);

  const mapBounds = useMemo(() => {
    const points: LatLngTuple[] = [];

    intersections.forEach((intersection) => {
      points.push([intersection.lat, intersection.lon]);
    });

    existingRoadPositions.forEach((position) => {
      points.push(position);
    });

    return points.length ? points : null;
  }, [existingRoadPositions, intersections]);

  const selectedPositions = useMemo(() => {
    return selectedIds
      .map((id) => intersectionLookup[id])
      .filter((value): value is IntersectionPoint => Boolean(value))
      .map((point) => [point.lat, point.lon] as LatLngTuple);
  }, [intersectionLookup, selectedIds]);

  const segmentLengths = useMemo(() => {
    if (selectedIds.length < 2) return [] as number[];

    const coordinatePairs = selectedIds
      .map((id) => intersectionLookup[id])
      .filter((point): point is IntersectionPoint => Boolean(point))
      .map((point) => [point.lon, point.lat] as [number, number]);

    if (coordinatePairs.length < 2) return [];
    return computeSegmentLengths(coordinatePairs);
  }, [intersectionLookup, selectedIds]);

  const totalLength = useMemo(() => {
    if (!segmentLengths.length) return 0;
    return segmentLengths.reduce(
      (sum: number, segment: number) => sum + segment,
      0
    );
  }, [segmentLengths]);

  const fallbackCenter = useMemo<LatLngTuple>(() => {
    if (selectedPositions.length) {
      return selectedPositions[selectedPositions.length - 1];
    }
    if (cityCenter) {
      return [cityCenter.lat, cityCenter.lon];
    }
    if (mapBounds && mapBounds.length) {
      return mapBounds[0];
    }
    return DEFAULT_CENTER;
  }, [cityCenter, mapBounds, selectedPositions]);

  const fallbackZoom = selectedPositions.length
    ? ACTIVE_ZOOM
    : mapBounds
    ? CITY_ZOOM
    : DEFAULT_ZOOM;

  const handleToggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((existingId) => existingId !== id)
        : [...selectedIds, id]
    );
  };

  if (!isClient) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 text-xs text-slate-400">
        Preparing map…
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-3 top-3 z-[500] flex gap-2 text-xs">
        {Object.entries(BASE_LAYERS).map(([key, config]) => {
          const typedKey = key as BaseLayerKey;
          const isActive = baseLayerKey === typedKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setBaseLayerKey(typedKey)}
              className={cn(
                "pointer-events-auto inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium transition",
                isActive
                  ? "border-blue-500 bg-blue-500/90 text-white shadow"
                  : "border-slate-200 bg-white/80 text-slate-700 hover:border-blue-400 hover:text-blue-600"
              )}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-current" />
              {config.name}
            </button>
          );
        })}
      </div>
      {disabled ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm">
          <p className="px-4 text-center text-xs text-slate-600">
            Select a city with intersection data to enable the road map.
          </p>
        </div>
      ) : null}
      <MapContainer
        center={fallbackCenter}
        zoom={fallbackZoom}
        className="h-[500px] w-full rounded-xl"
        attributionControl={false}
      >
        <MapViewController
          bounds={mapBounds}
          focusPositions={selectedPositions}
          fallbackCenter={fallbackCenter}
          fallbackZoom={fallbackZoom}
        />
        <TileLayer
          attribution={BASE_LAYERS[baseLayerKey].attribution}
          url={BASE_LAYERS[baseLayerKey].url}
        />
        {existingRoads?.map((road) =>
          road.positions.length >= 2 ? (
            <Polyline
              key={`existing-${road.id}`}
              positions={road.positions}
              pathOptions={{
                color: "#006affff",
                weight: 3,
                opacity: 0.55,
                dashArray: "6 8",
              }}
            >
              {(road.name || typeof road.lengthMeters === "number") && (
                <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                  <div className="space-y-1 text-xs text-slate-500 bg-green">
                    {road.name ? (
                      <div className="font-semibold tracking-wide">
                        {road.name}
                      </div>
                    ) : null}
                    {typeof road.lengthMeters === "number" ? (
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        {formatDistanceMeters(road.lengthMeters)}
                      </div>
                    ) : null}
                  </div>
                </Tooltip>
              )}
            </Polyline>
          ) : null
        )}
        {selectedPositions.length >= 2 ? (
          <Polyline
            positions={selectedPositions}
            pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.8 }}
          />
        ) : null}
        <MarkerLayer
          intersections={intersections}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          disabled={disabled}
        />
      </MapContainer>
      {segmentLengths.length ? (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-700">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold uppercase tracking-wide text-[11px] text-blue-600">
              Total Distance
            </span>
            <span className="font-semibold text-blue-800">
              {formatDistanceMeters(totalLength)}
            </span>
          </div>
          <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {segmentLengths.map((segment: number, index: number) => (
              <span key={index} className="text-[11px] text-blue-600">
                Segment {index + 1}: {formatDistanceMeters(segment)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
