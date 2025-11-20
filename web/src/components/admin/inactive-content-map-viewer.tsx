import { useMemo } from "react";
import type { LatLngTuple } from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { X } from "lucide-react";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Ensure Leaflet icons load correctly
const LeafletIconPrototype = L.Icon.Default.prototype as any;
if (LeafletIconPrototype && LeafletIconPrototype._getIconUrl) {
  delete LeafletIconPrototype._getIconUrl;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type InactiveCity = {
  id: string;
  name_mm: string | null;
  name_en: string | null;
  address_mm: string | null;
  address_en: string | null;
  description_mm: string | null;
  description_en: string | null;
  geometry: string | null;
  user_id: string | null;
};

type InactiveLocation = {
  id: string;
  name_mm: string | null;
  name_en: string | null;
  address_mm: string | null;
  address_en: string | null;
  description_mm: string | null;
  description_en: string | null;
  location_type: string | null;
  geometry: string | null;
  city_id: string | null;
  user_id: string | null;
};

type InactiveRoad = {
  id: string;
  name_mm: string | null;
  name_en: string | null;
  road_type: string | null;
  is_oneway: boolean | null;
  length_m: number[] | null;
  geometry: string | null;
  city_id: string | null;
  user_id: string | null;
};

type UserInfo = {
  id: string;
  username: string | null;
  email: string | null;
};

type InactiveContentMapViewerProps = {
  content: InactiveCity | InactiveLocation | InactiveRoad;
  type: "city" | "location" | "road";
  submitter: UserInfo | null;
  onClose: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  cityName?: string;
};

function extractPointFromWkt(
  wkt: string | null
): { lon: number; lat: number } | null {
  if (!wkt) return null;
  const match = /POINT\s*\(([-+0-9.eE]+)\s+([-+0-9.eE]+)\)/i.exec(wkt);
  if (!match) return null;
  return { lon: Number(match[1]), lat: Number(match[2]) };
}

function extractLineStringCoordinates(
  wkt: string | null
): Array<[number, number]> {
  if (!wkt) return [];
  const match = /LINESTRING\s*\(([^)]+)\)/i.exec(wkt);
  if (!match) return [];

  const segments = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const coordinates: Array<[number, number]> = [];

  segments.forEach((segment) => {
    const parts = segment.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        coordinates.push([lon, lat]);
      }
    }
  });

  return coordinates;
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDistance(lengthArray: number[] | null): string {
  if (!lengthArray || lengthArray.length === 0) return "N/A";
  const total = lengthArray.reduce((sum, len) => sum + len, 0);
  if (total < 1000) return `${total.toFixed(0)} m`;
  return `${(total / 1000).toFixed(2)} km`;
}

export function InactiveContentMapViewer({
  content,
  type,
  submitter,
  onClose,
  onAccept,
  onReject,
  cityName,
}: InactiveContentMapViewerProps) {
  const mapData = useMemo(() => {
    if (type === "road") {
      const road = content as InactiveRoad;
      const coordinates = extractLineStringCoordinates(road.geometry);
      if (coordinates.length < 2) return null;

      const positions: LatLngTuple[] = coordinates.map(([lon, lat]) => [
        lat,
        lon,
      ]);
      const center = positions[Math.floor(positions.length / 2)];

      return {
        center,
        zoom: 14,
        positions,
        type: "road" as const,
      };
    } else {
      // city or location
      const point = extractPointFromWkt(content.geometry);
      if (!point) return null;

      return {
        center: [point.lat, point.lon] as LatLngTuple,
        zoom: type === "city" ? 12 : 15,
        point,
        type: type as "city" | "location",
      };
    }
  }, [content, type]);

  if (!mapData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur">
        <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="text-center text-slate-700">
            <p className="text-lg font-semibold text-slate-900">
              No Location Data
            </p>
            <p className="mt-2 text-sm text-slate-500">
              This {type} does not have valid geometry information.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const name =
    (content as any).name_en || (content as any).name_mm || "Unnamed";
  const address =
    (content as any).address_en || (content as any).address_mm || "";
  const description =
    (content as any).description_en || (content as any).description_mm || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur p-4">
      <div className="relative w-full max-w-7xl h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex">
        {/* Map Section */}
        <div className="flex-1 relative">
          <MapContainer
            center={mapData.center}
            zoom={mapData.zoom}
            className="h-full w-full"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution="© OpenStreetMap contributors"
              url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
            />
            {mapData.type === "road" && mapData.positions && (
              <>
                <Polyline
                  positions={mapData.positions}
                  color="#10b981"
                  weight={4}
                  opacity={0.8}
                />
                {mapData.positions.map((pos, idx) => (
                  <CircleMarker
                    key={idx}
                    center={pos}
                    radius={6}
                    fillColor={
                      idx === 0
                        ? "#22c55e"
                        : idx === mapData.positions!.length - 1
                        ? "#ef4444"
                        : "#3b82f6"
                    }
                    fillOpacity={0.9}
                    color="#fff"
                    weight={2}
                  >
                    <Tooltip>
                      {idx === 0
                        ? "Start"
                        : idx === mapData.positions!.length - 1
                        ? "End"
                        : `Point ${idx + 1}`}
                    </Tooltip>
                  </CircleMarker>
                ))}
              </>
            )}

            {(mapData.type === "city" || mapData.type === "location") &&
              mapData.point && (
                <Marker position={[mapData.point.lat, mapData.point.lon]}>
                  <Tooltip permanent>{name}</Tooltip>
                </Marker>
              )}
          </MapContainer>
        </div>

        {/* Details Section */}
        <div className="w-96 bg-white/90 border-l border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {type === "city"
                ? "City Details"
                : type === "location"
                ? "Location Details"
                : "Road Details"}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Name
              </label>
              <p className="text-sm text-slate-900 font-medium">{name}</p>
            </div>

            {/* Type-specific fields */}
            {type === "location" && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Type
                </label>
                <p className="text-sm text-slate-800">
                  {humanizeKey(
                    (content as InactiveLocation).location_type || "N/A"
                  )}
                </p>
              </div>
            )}

            {type === "road" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Road Type
                  </label>
                  <p className="text-sm text-slate-800">
                    {humanizeKey((content as InactiveRoad).road_type || "N/A")}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Direction
                  </label>
                  <p className="text-sm text-slate-800">
                    {(content as InactiveRoad).is_oneway
                      ? "One-way"
                      : "Two-way"}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Length
                  </label>
                  <p className="text-sm text-slate-800">
                    {formatDistance((content as InactiveRoad).length_m)}
                  </p>
                </div>
              </>
            )}

            {/* City (for locations and roads) */}
            {(type === "location" || type === "road") && cityName && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  City
                </label>
                <p className="text-sm text-slate-800">{cityName}</p>
              </div>
            )}

            {/* Address */}
            {address && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Address
                </label>
                <p className="text-sm text-slate-800">{address}</p>
              </div>
            )}

            {/* Description */}
            {description && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Description
                </label>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {description}
                </p>
              </div>
            )}

            {/* Submitter Info */}
            {submitter && (
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Submitted By
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Username:</span>
                    <span className="text-sm text-slate-800 font-medium">
                      {submitter.username || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Email:</span>
                    <span className="text-sm text-slate-800">
                      {submitter.email || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {(onAccept || onReject) && (
            <div className="p-6 border-t border-slate-200 space-y-3">
              {onAccept && (
                <button
                  onClick={onAccept}
                  className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-emerald-500/30"
                >
                  Accept & Activate
                </button>
              )}
              {onReject && (
                <button
                  onClick={onReject}
                  className="w-full rounded-lg bg-gradient-to-r from-rose-500 to-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-rose-500/30"
                >
                  Reject & Delete
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-emerald-50"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
