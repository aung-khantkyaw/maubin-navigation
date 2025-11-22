import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Bus,
  Church,
  Factory,
  Fuel,
  Hospital,
  Hotel,
  Landmark,
  Sailboat,
  School,
  Store,
  Theater,
  TowerControl,
  TrainFront,
  University,
  ShipWheel,
} from "lucide-react";
import { Header } from "@/components/header";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  normalizeLocalizedField,
  normalizeLocalizedNames,
  pickLocalizedText,
} from "@/utils/localized";
import type { LocalizedTextPair } from "@/utils/localized";

interface City {
  id: string;
  english_name: string;
  burmese_name: string | null;
  geometry: string | null;
  address: LocalizedTextPair;
  description: LocalizedTextPair;
  image_urls?: string[] | null;
}

interface CityLocation {
  id: string;
  english_name: string;
  burmese_name: string | null;
  geometry: string | null;
  address: LocalizedTextPair;
  description: LocalizedTextPair;
  location_type: string | null;
  is_active: boolean;
  image_urls?: string[] | null;
}

type LocationEntry = {
  location: CityLocation;
  position: LatLngTuple;
  category: LocationCategory;
  addressText: string;
  descriptionText: string;
};

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000";

const LOCATION_CATEGORIES: Record<string, string[]> = {
  public_and_civic: [
    "hospital",
    "police_station",
    "fire_station",
    "post_office",
    "government_office",
    "embassy",
  ],
  transportation: [
    "bus_stop",
    "train_station",
    "airport",
    "parking_lot",
    "gas_station",
    "harbor",
  ],
  entertainment_and_leisure: [
    "restaurant",
    "cafe",
    "bar",
    "cinema",
    "stadium",
    "sports_center",
    "park",
    "zoo",
    "amusement_park",
  ],
  commerce: [
    "store",
    "market",
    "mall",
    "supermarket",
    "bank",
    "hotel",
    "pharmacy",
    "beauty_salon",
    "laundry",
  ],
  education_and_culture: ["school", "university", "library", "museum"],
  religious: ["pagoda", "monastery", "temple", "church", "mosque"],
  residential_and_industrial: [
    "apartment",
    "residential_area",
    "factory",
    "warehouse",
    "farm",
    "cemetery",
  ],
  other: ["landmark", "intersection", "office", "other"],
};

type LocationCategory = keyof typeof LOCATION_CATEGORIES;
type CategoryKey = LocationCategory | "all";
const CATEGORY_ORDER = [
  "all",
  ...Object.keys(LOCATION_CATEGORIES),
] as CategoryKey[];

const LOCATION_TYPE_ICONS: Record<string, LucideIcon> = {
  hospital: Hospital,
  clinic: Hospital,
  fire_station: Hospital,
  church: Church,
  temple: Church,
  mosque: Church,
  hotel: Hotel,
  landmark: Landmark,
  monument: Landmark,
  school: School,
  university: University,
  library: School,
  museum: Landmark,
  store: Store,
  market: Store,
  mall: Store,
  supermarket: Store,
  pharmacy: Store,
  bank: Building2,
  beauty_salon: Store,
  laundry: Store,
  office: Building2,
  government_office: Building2,
  embassy: Building2,
  residential_area: Building2,
  apartment: Building2,
  warehouse: Factory,
  factory: Factory,
  farm: Factory,
  bus_stop: Bus,
  train_station: TrainFront,
  airport: TowerControl,
  parking_lot: Bus,
  gas_station: Fuel,
  harbor: Sailboat,
  port: Sailboat,
  amusement_park: Theater,
  cinema: Theater,
  stadium: Theater,
  sports_center: Theater,
  park: Landmark,
  zoo: Landmark,
  pagoda: ShipWheel,
  monastery: ShipWheel,
  restaurant: Store,
  cafe: Store,
  bar: Store,
  other: Building2,
};

function iconForLocationType(type?: string | null): LucideIcon {
  if (!type) return Building2;
  const normalized = type.toLowerCase();
  return LOCATION_TYPE_ICONS[normalized] ?? Building2;
}

function normalizeImageUrls(source: unknown): string[] | null {
  if (!source) return null;
  if (Array.isArray(source)) {
    return source
      .map((item) => item?.toString().trim())
      .filter((item): item is string => Boolean(item));
  }
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => item?.toString().trim())
          .filter((item): item is string => Boolean(item));
      }
    } catch {
      // Not JSON, fall through to CSV handling
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return null;
}

type CityApiPayload = Partial<{
  id: unknown;
  user_id: unknown;
  burmese_name: unknown;
  english_name: unknown;
  name: unknown;
  name_en: unknown;
  name_mm: unknown;
  address: unknown;
  address_en: unknown;
  address_mm: unknown;
  address_json: unknown;
  description: unknown;
  description_en: unknown;
  description_mm: unknown;
  description_json: unknown;
  english_description: unknown;
  burmese_description: unknown;
  geometry: unknown;
  image_urls: unknown;
}>;

type LocationApiPayload = Partial<{
  id: unknown;
  city_id: unknown;
  user_id: unknown;
  burmese_name: unknown;
  english_name: unknown;
  name: unknown;
  name_en: unknown;
  name_mm: unknown;
  address: unknown;
  address_en: unknown;
  address_mm: unknown;
  address_json: unknown;
  description: unknown;
  description_en: unknown;
  description_mm: unknown;
  description_json: unknown;
  english_description: unknown;
  burmese_description: unknown;
  location_type: unknown;
  geometry: unknown;
  is_active: unknown;
  image_urls: unknown;
}>;

function pickStringValue(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

function parseBooleanish(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return fallback;
}

function normalizeCityPayload(city: unknown): City {
  const payload: CityApiPayload =
    typeof city === "object" && city !== null ? (city as CityApiPayload) : {};

  const address = normalizeLocalizedField({
    value: payload.address,
    value_en: payload.address_en,
    value_mm: payload.address_mm,
    json: payload.address_json,
  });

  const description = normalizeLocalizedField({
    value: payload.description,
    value_en: payload.description_en,
    value_mm: payload.description_mm,
    english: payload.english_description,
    burmese: payload.burmese_description,
    json: payload.description_json,
  });

  return {
    id: payload.id ? String(payload.id) : "",
    english_name:
      pickStringValue(payload.english_name, payload.name_en, payload.name) ??
      "",
    burmese_name:
      pickStringValue(payload.burmese_name, payload.name_mm) ?? null,
    geometry: typeof payload.geometry === "string" ? payload.geometry : null,
    address,
    description,
    image_urls: normalizeImageUrls(payload.image_urls ?? null),
  };
}

function normalizeLocationPayload(location: unknown): CityLocation {
  const payload: LocationApiPayload =
    typeof location === "object" && location !== null
      ? (location as LocationApiPayload)
      : {};

  const address = normalizeLocalizedField({
    value: payload.address,
    value_en: payload.address_en,
    value_mm: payload.address_mm,
    json: payload.address_json,
  });

  const description = normalizeLocalizedField({
    value: payload.description,
    value_en: payload.description_en,
    value_mm: payload.description_mm,
    english: payload.english_description,
    burmese: payload.burmese_description,
    json: payload.description_json,
  });

  const isActive = parseBooleanish(payload.is_active, true);

  return {
    id: payload.id ? String(payload.id) : "",
    english_name:
      pickStringValue(payload.english_name, payload.name_en, payload.name) ??
      "",
    burmese_name:
      pickStringValue(payload.burmese_name, payload.name_mm) ?? null,
    geometry: typeof payload.geometry === "string" ? payload.geometry : null,
    address,
    description,
    location_type:
      typeof payload.location_type === "string" ? payload.location_type : null,
    is_active: isActive,
    image_urls: normalizeImageUrls(payload.image_urls ?? null),
  };
}

const CATEGORY_COLORS: Record<LocationCategory, string> = {
  public_and_civic: "#2563EB",
  transportation: "#0EA5E9",
  entertainment_and_leisure: "#F97316",
  commerce: "#FACC15",
  education_and_culture: "#9333EA",
  religious: "#22C55E",
  residential_and_industrial: "#6B7280",
  other: "#EF4444",
};

const DEFAULT_CENTER: LatLngTuple = [19.747039, 96.0678096];
const DEFAULT_ZOOM = 6;
const SELECTED_ZOOM = 14;
const LOCATION_ZOOM = 16;
const USER_LOCATION_ZOOM = 12;

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

function formatDistance(distance?: number | null): string {
  if (typeof distance !== "number" || Number.isNaN(distance)) {
    return "–";
  }

  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distance)} m`;
}

function formatDuration(seconds?: number | null): string {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "–";
  }

  if (seconds < 60) {
    return `${Math.max(1, Math.round(seconds))} sec`;
  }

  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hoursLabel = `${hours} hr${hours > 1 ? "s" : ""}`;
  return minutes > 0 ? `${hoursLabel} ${minutes} min` : hoursLabel;
}

function geolocationErrorMessage(code?: number): string {
  switch (code) {
    case 1:
      return "Location permission was denied. Please enable it to plan routes.";
    case 2:
      return "Your location is unavailable right now. Try again in a moment.";
    case 3:
      return "We couldn't determine your location quickly enough.";
    default:
      return "We couldn't access your location. Ensure permissions are granted.";
  }
}

// Ensure Leaflet icons load correctly with Vite
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function parsePointGeometry(geometry?: string | null): LatLngTuple | null {
  if (!geometry || !geometry.startsWith("POINT")) return null;
  const coords = geometry
    .replace("POINT(", "")
    .replace(")", "")
    .split(" ")
    .map(Number);

  if (
    coords.length !== 2 ||
    Number.isNaN(coords[0]) ||
    Number.isNaN(coords[1])
  ) {
    return null;
  }

  return [coords[1], coords[0]];
}

function categoryForLocationType(type?: string | null): LocationCategory {
  if (!type) return "other";
  const normalized = type.toLowerCase();
  for (const [category, types] of Object.entries(LOCATION_CATEGORIES)) {
    if (types.includes(normalized)) {
      return category as LocationCategory;
    }
  }
  return "other";
}

function MapFocus({
  position,
  zoom,
}: {
  position: LatLngTuple | null;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, { duration: 0.6 });
    }
  }, [map, position, zoom]);

  return null;
}

function LandmarkMap() {
  const navigate = useNavigate();
  const { cityId } = useParams<{ cityId?: string }>();
  const [searchParams] = useSearchParams();
  const locationIdFromUrl = searchParams.get("location");
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cityLocations, setCityLocations] = useState<CityLocation[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const [userPosition, setUserPosition] = useState<LatLngTuple | null>(null);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const geolocationToastShownRef = useRef(false);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [routePolyline, setRoutePolyline] = useState<LatLngTuple[]>([]);
  const [routeSummary, setRouteSummary] = useState<{
    distance: number | null;
    duration: number | null;
    locationId: string;
  } | null>(null);
  const [baseLayerKey, setBaseLayerKey] = useState<BaseLayerKey>("imagery");
  const [mapFocusPosition, setMapFocusPosition] = useState<LatLngTuple | null>(
    null
  );
  const [mapFocusZoom, setMapFocusZoom] = useState(13);

  const { i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language ?? "en";
  const preferMm = activeLanguage.toLowerCase().startsWith("mm");

  const getLocalizedText = useCallback(
    (pair: LocalizedTextPair | undefined, fallback: string | null = null) =>
      pickLocalizedText(activeLanguage, {
        en: pair?.en ?? null,
        mm: pair?.mm ?? null,
        fallback,
      }),
    [activeLanguage]
  );

  const getNamePair = useCallback(
    (
      source: {
        english_name?: unknown;
        burmese_name?: unknown;
        name?: unknown;
        name_en?: unknown;
        name_mm?: unknown;
      },
      fallback: string
    ) => {
      const names = normalizeLocalizedNames(source);
      const primary = pickLocalizedText(activeLanguage, {
        en: names.en,
        mm: names.mm,
        fallback,
      });
      const secondaryCandidate = preferMm ? names.en : names.mm;
      const secondary =
        secondaryCandidate && secondaryCandidate !== primary
          ? secondaryCandidate
          : null;
      return { primary, secondary };
    },
    [activeLanguage, preferMm]
  );

  const getPrimaryName = useCallback(
    (
      source: {
        english_name?: unknown;
        burmese_name?: unknown;
        name?: unknown;
        name_en?: unknown;
        name_mm?: unknown;
      },
      fallback: string
    ) => getNamePair(source, fallback).primary,
    [getNamePair]
  );

  const getMarkerIcon = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    const pinSize = 28;
    const pointerHeight = 8;

    return (
      category: LocationCategory,
      IconComponent: LucideIcon,
      cacheKey: string
    ) => {
      const key = `${category}-${cacheKey}`;
      const cached = cache.get(key);
      if (cached) return cached;

      const svgMarkup = renderToStaticMarkup(
        <IconComponent size={16} color="#ffffff" strokeWidth={1.75} />
      );
      const color = CATEGORY_COLORS[category];

      const divIcon = L.divIcon({
        className: "location-category-icon",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;gap:0;">
            <span style="display:flex;align-items:center;justify-content:center;width:${pinSize}px;height:${pinSize}px;border-radius:9999px;background:${color};border:2px solid #FFFFFF;box-shadow:0 8px 16px rgba(15,23,42,0.25);">
              ${svgMarkup}
            </span>
            <span style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:${pointerHeight}px solid ${color};margin-top:-2px;"></span>
          </div>
        `,
        iconSize: [pinSize, pinSize + pointerHeight],
        iconAnchor: [pinSize / 2, pinSize + pointerHeight - 2],
        popupAnchor: [0, -(pinSize / 2)],
        tooltipAnchor: [0, -(pinSize / 2)],
      });

      cache.set(key, divIcon);
      return divIcon;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("geolocation" in navigator)) {
      const message = "Geolocation isn't supported in this browser.";
      setGeolocationError(message);
      if (!geolocationToastShownRef.current) {
        toast.error(message);
        geolocationToastShownRef.current = true;
      }
      return;
    }

    let isCancelled = false;
    let watchId: number | null = null;

    const handleSuccess = (position: GeolocationPosition) => {
      if (isCancelled) return;
      const { latitude, longitude } = position.coords;
      setUserPosition([latitude, longitude]);
      setGeolocationError(null);
      geolocationToastShownRef.current = false;
    };

    const handleError = (error: GeolocationPositionError) => {
      if (isCancelled) return;
      const message = geolocationErrorMessage(error.code);
      setGeolocationError(message);
      if (!geolocationToastShownRef.current) {
        toast.error(message);
        geolocationToastShownRef.current = true;
      }
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 60000,
      timeout: 15000,
    });

    return () => {
      isCancelled = true;
      if (
        typeof navigator !== "undefined" &&
        navigator.geolocation &&
        watchId !== null
      ) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/cities`)
      .then((res) => res.json())
      .then((data) => {
        const raw = data?.data;
        const items = Array.isArray(raw)
          ? raw
          : raw && typeof raw === "object"
          ? [raw]
          : [];
        const fetchedCities = items.map(normalizeCityPayload);
        setCities(fetchedCities);
      })
      .catch((err) => console.error(err));
  }, [cityId]);

  useEffect(() => {
    if (!cities.length) {
      if (selectedCity !== null) setSelectedCity(null);
      return;
    }

    if (!cityId) {
      if (selectedCity !== null) setSelectedCity(null);
      return;
    }

    const matchedCity = cities.find((city) => city.id === cityId) ?? null;
    if (matchedCity?.id !== selectedCity?.id) {
      setSelectedCity(matchedCity);
    }
  }, [cities, cityId, selectedCity]);

  const selectedCityAddress = useMemo(() => {
    if (!selectedCity) return "";
    const fallback = selectedCity.address.en ?? selectedCity.address.mm ?? null;
    return getLocalizedText(selectedCity.address, fallback).trim();
  }, [selectedCity, getLocalizedText]);

  const selectedCityDescription = useMemo(() => {
    if (!selectedCity) return "";
    return getLocalizedText(selectedCity.description, "").trim();
  }, [selectedCity, getLocalizedText]);
  useEffect(() => {
    setActiveCategory("all");
    setActiveLocationId(null);
    setRoutePolyline([]);
    setRouteSummary(null);
  }, [selectedCity?.id]);

  const handleSelectCity = (city: City) => {
    setSelectedCity(city);
    setRoutePolyline([]);
    setRouteSummary(null);
    navigate(`/landmark-map/${city.id}`, { replace: true });
  };

  const handleSelectLocation = (locationId: string) => {
    if (activeLocationId === locationId) {
      setActiveLocationId(null);
      setRoutePolyline([]);
      setRouteSummary(null);
      return;
    }

    setActiveLocationId(locationId);
    setRoutePolyline([]);
    setRouteSummary(null);
  };

  const handleCancelSelection = () => {
    markerRefs.current.forEach((marker) => marker.closePopup());
    setActiveLocationId(null);
    setRoutePolyline([]);
    setRouteSummary(null);
    setIsFetchingRoute(false);
  };

  useEffect(() => {
    const selectedId = selectedCity?.id;
    if (!selectedId) {
      setCityLocations([]);
      return;
    }

    const controller = new AbortController();

    fetch(`${API_BASE_URL}/locations?city_id=${selectedId}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        const raw = data?.data;
        const items = Array.isArray(raw)
          ? raw
          : raw && typeof raw === "object"
          ? [raw]
          : [];
        const fetchedLocations = items.map(normalizeLocationPayload);
        setCityLocations(fetchedLocations);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(err);
          setCityLocations([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedCity?.id]);

  const cityEntries = useMemo(() => {
    return cities
      .map((city) => {
        const position = parsePointGeometry(city.geometry);
        if (!position) return null;
        return { city, position };
      })
      .filter(
        (entry): entry is { city: City; position: LatLngTuple } =>
          entry !== null
      );
  }, [cities]);

  const locationEntries = useMemo<LocationEntry[]>(() => {
    return cityLocations
      .map((location) => {
        if (!location.is_active) {
          return null;
        }
        const normalizedType = location.location_type?.toLowerCase() ?? null;
        if (normalizedType === "intersection") {
          return null;
        }

        const position = parsePointGeometry(location.geometry);
        if (!position) return null;
        const fallbackAddress =
          location.address.en ?? location.address.mm ?? null;
        const addressText = getLocalizedText(
          location.address,
          fallbackAddress
        ).trim();
        const descriptionText = getLocalizedText(
          location.description,
          ""
        ).trim();
        return {
          location,
          position,
          category: categoryForLocationType(location.location_type),
          addressText,
          descriptionText,
        };
      })
      .filter((entry): entry is LocationEntry => entry !== null);
  }, [cityLocations, getLocalizedText]);

  // Handle location from URL query parameter
  useEffect(() => {
    if (!locationIdFromUrl || !locationEntries.length) return;

    const locationEntry = locationEntries.find(
      ({ location }) => location.id === locationIdFromUrl
    );

    if (locationEntry) {
      // Set the location as active
      setActiveLocationId(locationIdFromUrl);

      // Center map on the location with higher zoom for detail view
      setMapFocusPosition(locationEntry.position);
      setMapFocusZoom(16);

      // Clear the query parameter after handling it
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("location");
      navigate(
        {
          pathname: `/landmark-map/${cityId}`,
          search: newSearchParams.toString(),
        },
        { replace: true }
      );
    }
  }, [locationIdFromUrl, locationEntries, cityId, navigate, searchParams]);

  // Reset map focus position after it's been applied
  useEffect(() => {
    if (mapFocusPosition) {
      const timer = setTimeout(() => {
        setMapFocusPosition(null);
        setMapFocusZoom(13);
      }, 1000); // Clear after animation completes
      return () => clearTimeout(timer);
    }
  }, [mapFocusPosition]);

  const categoryCounts = useMemo(() => {
    const base = Object.keys(LOCATION_CATEGORIES).reduce(
      (acc, key) => {
        acc[key as keyof typeof LOCATION_CATEGORIES] = 0;
        return acc;
      },
      { all: locationEntries.length } as Record<CategoryKey, number>
    );

    locationEntries.forEach(({ category }) => {
      base[category] = (base[category] ?? 0) + 1;
    });

    return base;
  }, [locationEntries]);

  const filteredLocations = useMemo(
    () =>
      locationEntries.filter(({ category }) =>
        activeCategory === "all" ? true : category === activeCategory
      ),
    [locationEntries, activeCategory]
  );

  useEffect(() => {
    if (!activeLocationId) return;
    const stillVisible = filteredLocations.some(
      ({ location }) => location.id === activeLocationId
    );
    if (!stillVisible) {
      setActiveLocationId(null);
    }
  }, [filteredLocations, activeLocationId]);

  useEffect(() => {
    if (!routeSummary) return;
    if (routeSummary.locationId !== activeLocationId) {
      setRouteSummary(null);
      setRoutePolyline([]);
    }
  }, [activeLocationId, routeSummary]);

  const activeLocation = useMemo(() => {
    if (!activeLocationId) return null;
    return (
      locationEntries.find(
        ({ location }) => location.id === activeLocationId
      ) ?? null
    );
  }, [activeLocationId, locationEntries]);

  const visibleMapLocations = useMemo(() => {
    if (!activeLocationId) {
      return filteredLocations;
    }

    const match = filteredLocations.filter(
      ({ location }) => location.id === activeLocationId
    );

    return match.length > 0 ? match : filteredLocations;
  }, [filteredLocations, activeLocationId]);

  useEffect(() => {
    if (!activeLocationId) {
      markerRefs.current.forEach((marker) => marker.closePopup());
      return;
    }

    const marker = markerRefs.current.get(activeLocationId);
    if (marker) {
      marker.openPopup();
    }
  }, [activeLocationId, visibleMapLocations]);

  const activeLocationTypeLabel = activeLocation?.location.location_type
    ? activeLocation.location.location_type.replaceAll("_", " ")
    : "Unknown";
  const activeLocationColor = activeLocation
    ? CATEGORY_COLORS[activeLocation.category]
    : undefined;
  const ActiveLocationIcon = iconForLocationType(
    activeLocation?.location.location_type ?? null
  );
  const activeLocationImages = useMemo(
    () =>
      activeLocation?.location.image_urls?.filter((url): url is string =>
        Boolean(url?.trim())
      ) ?? [],
    [activeLocation]
  );

  const activePosition = useMemo(
    () => parsePointGeometry(selectedCity?.geometry ?? null),
    [selectedCity]
  );

  const activeLocationPosition = activeLocation?.position ?? null;

  const handlePlanRoute = async (locationId: string) => {
    const target = locationEntries.find(
      ({ location }) => location.id === locationId
    );

    if (!target) {
      toast.error("We couldn't find that location anymore. Please try again.");
      return;
    }

    if (!userPosition) {
      const message =
        geolocationError ??
        "We need your current position to plan a route. Please enable location access.";
      if (!geolocationToastShownRef.current) {
        toast.error(message);
        geolocationToastShownRef.current = true;
      }
      return;
    }

    setActiveLocationId(locationId);
    setRoutePolyline([]);
    setRouteSummary(null);
    setIsFetchingRoute(true);

    try {
      const [startLat, startLon] = userPosition;
      const [endLat, endLon] = target.position;
      const destinationName = getPrimaryName(
        target.location,
        target.location.english_name ||
          target.location.burmese_name ||
          target.location.id
      );

      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("access_token")
          : null;

      const response = await fetch(`${API_BASE_URL}/routes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          start_lon: startLon,
          start_lat: startLat,
          end_lon: endLon,
          end_lat: endLat,
          optimization: "shortest",
          end_name: destinationName,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.is_success) {
        const message = payload?.msg ?? "Unable to plan a route right now.";
        throw new Error(message);
      }

      const routeData = payload.data ?? {};
      const coordinates: unknown = routeData?.route?.geometry?.coordinates;

      const polylineCoordinates: LatLngTuple[] = Array.isArray(coordinates)
        ? (coordinates as unknown[])
            .filter(
              (coord): coord is [number, number] =>
                Array.isArray(coord) && coord.length === 2
            )
            .map(([lon, lat]) => [lat, lon] as LatLngTuple)
        : [];

      if (!polylineCoordinates.length) {
        throw new Error(
          "We couldn't draw this route. Try choosing another destination."
        );
      }

      setRoutePolyline(polylineCoordinates);
      setRouteSummary({
        distance:
          typeof routeData.distance === "number" ? routeData.distance : null,
        duration:
          typeof routeData.estimated_time === "number"
            ? routeData.estimated_time
            : null,
        locationId,
      });
      toast.success("Route is ready. Follow the highlighted path on the map.");
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to plan route.";
      toast.error(message);
    } finally {
      setIsFetchingRoute(false);
    }
  };

  const hasRoute = routePolyline.length > 1;

  const mapCenter =
    mapFocusPosition ??
    activeLocationPosition ??
    activePosition ??
    userPosition ??
    DEFAULT_CENTER;
  const mapZoom = mapFocusPosition
    ? mapFocusZoom
    : activeLocationPosition
    ? LOCATION_ZOOM
    : activePosition
    ? SELECTED_ZOOM
    : userPosition
    ? USER_LOCATION_ZOOM
    : DEFAULT_ZOOM;

  const selectedCityNames = selectedCity
    ? getNamePair(
        selectedCity,
        selectedCity.english_name ||
          selectedCity.burmese_name ||
          selectedCity.id
      )
    : null;

  const activeLocationNames = activeLocation
    ? getNamePair(
        activeLocation.location,
        activeLocation.location.english_name ||
          activeLocation.location.burmese_name ||
          activeLocation.location.id
      )
    : null;

  return (
    <div className="min-h-screen flex flex-col relative">
      <Header />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr_360px] lg:gap-6 items-start pt-4">
        <aside className="order-1 lg:order-1 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cities
            </h2>
          </div>
          <div className="flex flex-col lg:h-[calc(100vh-8rem)]">
            {geolocationError ? (
              <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-xs font-medium text-red-700">
                {geolocationError}
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto">
              {cities.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No cities available yet.
                </div>
              ) : (
                <ul className="divide-y">
                  {cities.map((city) => {
                    const isActive = city.id === selectedCity?.id;
                    const { primary: cityName, secondary: citySecondary } =
                      getNamePair(
                        city,
                        city.english_name || city.burmese_name || city.id
                      );
                    const cityAddress = getLocalizedText(
                      city.address,
                      city.address.en ?? city.address.mm ?? null
                    ).trim();
                    return (
                      <li key={city.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectCity(city)}
                          className={cn(
                            "w-full text-left px-5 py-4 transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary-foreground"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <span className="block text-sm font-semibold text-foreground">
                            {cityName}
                          </span>
                          {citySecondary ? (
                            <span className="block text-xs text-muted-foreground">
                              {citySecondary}
                            </span>
                          ) : null}
                          {cityAddress ? (
                            <span className="block mt-1 text-xs text-muted-foreground">
                              {cityAddress}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t bg-muted/30">
              {selectedCity ? (
                <div className="px-5 py-4 space-y-3 text-sm text-muted-foreground">
                  <div className="flex justify-between items-center gap-3">
                    <div className="items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {selectedCityNames?.primary ?? selectedCity.id}
                      </h3>
                      {selectedCityNames?.secondary ? (
                        <p>{selectedCityNames.secondary}</p>
                      ) : null}
                    </div>
                    <a
                      href={`/${selectedCity.id}/details`}
                      className="text-sm font-medium text-white px-2 py-1 bg-primary rounded"
                    >
                      View Details
                    </a>
                  </div>
                  {selectedCityAddress ? (
                    <p>
                      <span className="font-medium text-foreground">
                        Address:{" "}
                      </span>
                      {selectedCityAddress}
                    </p>
                  ) : null}
                  {selectedCityDescription ? (
                    <p className="leading-relaxed">{selectedCityDescription}</p>
                  ) : (
                    <p className="italic">No description provided.</p>
                  )}
                </div>
              ) : (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Select a city to view its details.
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="order-2 lg:order-2 relative z-0">
          <div className="pointer-events-none absolute right-6 top-6 z-[1000] flex gap-2 text-xs">
            {Object.entries(BASE_LAYERS).map(([key, layer]) => {
              const typedKey = key as BaseLayerKey;
              const isActive = baseLayerKey === typedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBaseLayerKey(typedKey)}
                  className={cn(
                    "pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold transition",
                    isActive
                      ? "border-blue-500 bg-blue-600 text-white shadow"
                      : "border-slate-200 bg-white/85 text-slate-700 hover:border-blue-400 hover:text-blue-600"
                  )}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-current" />
                  {layer.name}
                </button>
              );
            })}
          </div>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom
            style={{ height: "92vh", width: "100%" }}
            className="rounded-xl overflow-hidden shadow"
          >
            <MapFocus position={mapCenter} zoom={mapZoom} />
            <TileLayer
              attribution={BASE_LAYERS[baseLayerKey].attribution}
              url={BASE_LAYERS[baseLayerKey].url}
            />
            {userPosition ? (
              <CircleMarker
                center={userPosition}
                radius={8}
                pathOptions={{
                  color: "#0EA5E9",
                  weight: 2,
                  fillColor: "#38BDF8",
                  fillOpacity: 0.65,
                }}
              >
                <Popup>You are here</Popup>
              </CircleMarker>
            ) : null}

            {hasRoute ? (
              <Polyline
                positions={routePolyline}
                pathOptions={{ color: "#2563EB", weight: 5, opacity: 0.85 }}
              />
            ) : null}
            {!selectedCity
              ? cityEntries.map(({ city, position }) => {
                  const { primary, secondary } = getNamePair(
                    city,
                    city.english_name || city.burmese_name || city.id
                  );
                  const cityAddress = getLocalizedText(
                    city.address,
                    city.address.en ?? city.address.mm ?? null
                  ).trim();
                  return (
                    <Marker
                      key={city.id}
                      position={position}
                      eventHandlers={{
                        click: () => handleSelectCity(city),
                      }}
                    >
                      <Popup>
                        <div className="space-y-1">
                          <strong>{primary}</strong>
                          {secondary ? <div>{secondary}</div> : null}
                          {cityAddress ? <div>{cityAddress}</div> : null}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })
              : null}

            {selectedCity
              ? visibleMapLocations.map(
                  ({
                    location,
                    position,
                    category,
                    addressText,
                    descriptionText,
                  }) => {
                    const markerColor = CATEGORY_COLORS[category];
                    const Icon = iconForLocationType(location.location_type);
                    const typeKey =
                      location.location_type?.toLowerCase() ?? "unknown";
                    const markerIcon = getMarkerIcon(category, Icon, typeKey);
                    const {
                      primary: locationName,
                      secondary: locationSecondary,
                    } = getNamePair(
                      location,
                      location.english_name ||
                        location.burmese_name ||
                        location.id
                    );

                    return (
                      <Marker
                        key={location.id}
                        position={position}
                        icon={markerIcon}
                        eventHandlers={{
                          click: () => handleSelectLocation(location.id),
                        }}
                        ref={(instance) => {
                          if (instance) {
                            markerRefs.current.set(location.id, instance);
                          } else {
                            markerRefs.current.delete(location.id);
                          }
                        }}
                      >
                        <Popup>
                          <div className="space-y-2 text-sm text-slate-700">
                            <div className="flex items-start gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/90 text-white shadow-md">
                                <Icon className="h-4 w-4" color={markerColor} />
                              </div>
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-slate-900">
                                  {locationName}
                                </div>
                                {locationSecondary ? (
                                  <div className="text-xs text-slate-500">
                                    {locationSecondary}
                                  </div>
                                ) : null}
                                {location.location_type ? (
                                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                    {location.location_type.replaceAll(
                                      "_",
                                      " "
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            {addressText ? (
                              <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                                {addressText}
                              </div>
                            ) : null}
                            {descriptionText ? (
                              <div className="line-clamp-3 text-xs text-slate-500">
                                {descriptionText}
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-3 flex flex-col gap-2 text-xs font-medium">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handlePlanRoute(location.id);
                              }}
                              disabled={
                                isFetchingRoute &&
                                activeLocationId === location.id
                              }
                              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isFetchingRoute &&
                              activeLocationId === location.id ? (
                                <span className="inline-flex items-center gap-2 text-xs">
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent" />
                                  Planning…
                                </span>
                              ) : (
                                "Plan route"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleCancelSelection();
                              }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-slate-600 transition hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  }
                )
              : null}
          </MapContainer>
        </section>

        <aside className="order-3 lg:order-3 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Locations
            </h2>
          </div>
          <div className="flex flex-col lg:h-[calc(100vh-8rem)]">
            {selectedCity && locationEntries.length > 0 ? (
              <div className="border-b bg-muted/30 px-5 py-3">
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ORDER.map((category) => {
                    const label =
                      category === "all"
                        ? "All"
                        : category.replaceAll("_", " ");
                    const count = categoryCounts[category] ?? 0;
                    const isActiveCategory = activeCategory === category;
                    const markerColor =
                      category === "all"
                        ? undefined
                        : CATEGORY_COLORS[category as LocationCategory];

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setActiveCategory(category)}
                        className={cn(
                          "inline-flex items-center justify-between gap-3 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                          isActiveCategory
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border text-primary"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-flex h-2.5 w-2.5 rounded-full border border-white/40 shadow-sm"
                            style={{ backgroundColor: markerColor }}
                          />
                          <span>{label}</span>
                        </span>
                        <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto">
              {!selectedCity ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Select a city to explore its locations.
                </div>
              ) : locationEntries.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No locations have been added for{" "}
                  {selectedCityNames?.primary ?? selectedCity.id} yet.
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No locations match the selected category.
                </div>
              ) : (
                <ul className="divide-y">
                  {filteredLocations.map(({ location, category }) => {
                    const isActive = location.id === activeLocationId;
                    const typeLabel = location.location_type
                      ? location.location_type.replaceAll("_", " ")
                      : "Unknown";
                    const markerColor = CATEGORY_COLORS[category];
                    const Icon = iconForLocationType(location.location_type);
                    const { primary: locationName } = getNamePair(
                      location,
                      location.english_name ||
                        location.burmese_name ||
                        location.id
                    );

                    return (
                      <li key={location.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectLocation(location.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Icon className="h-4 w-4" color={markerColor} />
                            <span>{locationName}</span>
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {typeLabel}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t bg-muted/30">
              {!selectedCity ? (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Select a city to view its location details.
                </div>
              ) : activeLocation ? (
                <div className="px-5 py-4 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <ActiveLocationIcon
                        className="h-5 w-5"
                        color={activeLocationColor}
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {activeLocationNames?.primary ??
                          activeLocation.location.id}
                      </h3>
                      {activeLocationNames?.secondary ? (
                        <p>{activeLocationNames.secondary}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Type:
                    </span>
                    <ActiveLocationIcon
                      className="h-4 w-4"
                      color={activeLocationColor}
                    />
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {activeLocationTypeLabel}
                    </span>
                  </div>

                  {routeSummary &&
                  routeSummary.locationId === activeLocation.location.id ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                      <p className="text-sm font-semibold text-foreground">
                        Route summary
                      </p>
                      <div className="mt-2 flex flex-wrap gap-4 text-foreground">
                        <span>
                          Distance: {formatDistance(routeSummary.distance)}
                        </span>
                        <span>
                          Estimated time:{" "}
                          {formatDuration(routeSummary.duration)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {activeLocationImages.length == 1 ? (
                      <div className="overflow-hidden rounded-lg border bg-muted/20">
                        <img
                          src={activeLocationImages[0]}
                          alt={`${
                            activeLocationNames?.primary ??
                            activeLocation.location.id
                          } preview`}
                          className="h-40 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : activeLocationImages.length > 1 ? (
                      <div className="flex gap-2 overflow-x-auto">
                        {activeLocationImages.slice(1).map((url, index) => (
                          <img
                            key={`${activeLocation.location.id}-thumb-${index}`}
                            src={`${API_BASE_URL}/${url}`}
                            alt={`${
                              activeLocationNames?.primary ??
                              activeLocation.location.id
                            } thumbnail ${index + 1}`}
                            className="h-16 w-24 flex-shrink-0 rounded-md object-cover"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    ) : (
                      <p>No images available!</p>
                    )}
                  </div>
                  {activeLocation.addressText ? (
                    <p>
                      <span className="font-medium text-foreground">
                        Address:{" "}
                      </span>
                      {activeLocation.addressText}
                    </p>
                  ) : null}
                  {activeLocation.descriptionText ? (
                    <p className="leading-relaxed">
                      {activeLocation.descriptionText}
                    </p>
                  ) : (
                    <p className="italic">No description provided.</p>
                  )}
                </div>
              ) : (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Select a location to view its details.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default LandmarkMap;
