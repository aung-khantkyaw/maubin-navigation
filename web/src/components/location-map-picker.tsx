import { useEffect, useMemo, useState } from "react";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DEFAULT_CENTER: LatLngTuple = [19.747039, 96.0678096];
const DEFAULT_ZOOM = 6;
const CITY_ZOOM = 14;
const LOCATION_ZOOM = 15;

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

type LocationMapPickerProps = {
  value: {
    lon: string;
    lat: string;
  };
  cityCenter?: {
    lon: number;
    lat: number;
  } | null;
  onChange: (value: { lon: string; lat: string }) => void;
  disabled?: boolean;
};

type ClickHandlerProps = {
  disabled?: boolean;
  onSelect: (coords: { lat: number; lng: number }) => void;
};

function ClickHandler({ disabled, onSelect }: ClickHandlerProps) {
  useMapEvents({
    click(event) {
      if (disabled) return;
      onSelect(event.latlng);
    },
  });

  return null;
}

type MapViewControllerProps = {
  center: LatLngExpression;
  zoom: number;
};

function MapViewController({ center, zoom }: MapViewControllerProps) {
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
    map.flyTo(center, zoom, { duration: 0.35 });
    map.invalidateSize();
  }, [center, map, zoom]);

  return null;
}

function parsePoint(value: { lon: string; lat: string }) {
  const lonText = value.lon?.trim?.() ?? "";
  const latText = value.lat?.trim?.() ?? "";
  if (!lonText || !latText) {
    return null;
  }
  const lon = Number(lonText);
  const lat = Number(latText);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null;
  }
  return { lon, lat };
}

function formatCoord(value: number): string {
  return value.toFixed(6);
}

export function LocationMapPicker({
  value,
  cityCenter,
  onChange,
  disabled,
}: LocationMapPickerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const parsedValue = useMemo(() => parsePoint(value), [value]);

  const derivedCenter = useMemo(() => {
    if (parsedValue) {
      return [parsedValue.lat, parsedValue.lon] as LatLngTuple;
    }
    if (
      cityCenter &&
      Number.isFinite(cityCenter.lat) &&
      Number.isFinite(cityCenter.lon)
    ) {
      return [cityCenter.lat, cityCenter.lon] as LatLngTuple;
    }
    return DEFAULT_CENTER;
  }, [cityCenter, parsedValue]);

  const derivedZoom = parsedValue
    ? LOCATION_ZOOM
    : cityCenter
    ? CITY_ZOOM
    : DEFAULT_ZOOM;

  const handleSelect = (coords: { lat: number; lng: number }) => {
    onChange({ lon: formatCoord(coords.lng), lat: formatCoord(coords.lat) });
  };

  if (!isClient) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 text-xs text-slate-400">
        Initializing map...
      </div>
    );
  }

  return (
    <div className="relative">
      {disabled ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm">
          <p className="px-4 text-center text-xs text-slate-600">
            Select a city or enter coordinates to enable the picker.
          </p>
        </div>
      ) : null}
      <MapContainer
        center={derivedCenter}
        zoom={derivedZoom}
        className="h-[500px] w-full rounded-xl"
        // scrollWheelZoom={!disabled}
        // zoomControl={!disabled}
        // doubleClickZoom={!disabled}
      >
        <MapViewController center={derivedCenter} zoom={derivedZoom} />
        <TileLayer
          attribution=""
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <ClickHandler disabled={disabled} onSelect={handleSelect} />
        {parsedValue ? (
          <Marker position={[parsedValue.lat, parsedValue.lon]} />
        ) : null}
      </MapContainer>
    </div>
  );
}

export default LocationMapPicker;
