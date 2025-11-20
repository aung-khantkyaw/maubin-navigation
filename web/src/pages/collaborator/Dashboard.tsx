import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import Sidebar from "@/components/collaborator/Sidebar";
import LocationMapPicker from "@/components/location-map-picker";
import CityTable from "@/components/admin/city-table";
import CityDetailTable from "@/components/admin/city-detail-table";
import LocationTable from "@/components/admin/location-table";
import RoadTable from "@/components/admin/road-table";
import RoadIntersectionMap from "@/components/road-intersection-map";
import { computeSegmentLengths } from "@/lib/utils";

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

type AdminCity = {
  id: string;
  user_id: string | null;
  name_mm: string | null;
  name_en: string | null;
  address_mm: string | null;
  address_en: string | null;
  description_mm: string | null;
  description_en: string | null;
  image_urls: string[] | string | null;
  geometry: string | null;
  coordinates?: string | null;
  is_active?: boolean;
};

type AdminLocation = {
  id: string;
  city_id: string | null;
  user_id: string | null;
  name_en: string | null;
  name_mm: string | null;
  address_mm: string | null;
  address_en: string | null;
  description_mm: string | null;
  description_en: string | null;
  image_urls: string[] | string | null;
  location_type: string | null;
  geometry: string | null;
  coordinates?: string | null;
  is_active?: boolean;
};

type AdminRoad = {
  id: string;
  city_id: string | null;
  user_id: string | null;
  // Backend returns name_mm and name_en for roads (not name_en/name_mm)
  name_mm?: string | null;
  name_en?: string | null;
  intersection_ids: string[] | null;
  road_type?: string | null;
  is_oneway?: boolean | null;
  length_m?: number[] | null;
  geometry?: string | null;
  is_active?: boolean;
};

type AdminCityDetail = {
  id: string;
  city_id: string;
  user_id: string | null;
  predefined_title: string;
  subtitle_burmese: string | null;
  subtitle_english: string | null;
  body_burmese: string | null;
  body_english: string | null;
  image_urls: string[] | string | null;
  created_at: string | null;
  updated_at: string | null;
  is_active?: boolean;
};

type PanelKey =
  | "dashboard"
  | "cities"
  | "city-details"
  | "locations"
  | "roads"
  | "inactive-cities"
  | "inactive-city-details"
  | "inactive-locations"
  | "inactive-roads";

type DashboardResponse = {
  cities: AdminCity[];
  city_details?: AdminCityDetail[];
  locations: AdminLocation[];
  roads: AdminRoad[];
};

type ApiEnvelope<T> = {
  is_success: boolean;
  data?: T;
  msg?: string;
  error?: string;
};

type CityFormState = {
  id: string | null;
  name_en: string;
  name_mm: string;
  address_en: string;
  address_mm: string;
  description_en: string;
  description_mm: string;
  image_urls: string;
  image_files: File[];
  lon: string;
  lat: string;
};

type LocationFormState = {
  id: string | null;
  city_id: string;
  name_en: string;
  name_mm: string;
  address_en: string;
  address_mm: string;
  description_en: string;
  description_mm: string;
  location_type: string;
  image_urls: string;
  image_files: File[];
  lon: string;
  lat: string;
};

type RoadFormState = {
  id: string | null;
  city_id: string;
  user_id: string;
  name_en: string;
  name_mm: string;
  road_type: string;
  is_oneway: boolean;
  intersection_ids: string[];
  coordinates: string;
};

type CityDetailFormState = {
  id: string | null;
  city_id: string;
  predefined_title: string;
  subtitle_burmese: string;
  subtitle_english: string;
  body_burmese: string;
  body_english: string;
  image_urls: string;
  image_files: File[];
};

const initialCityForm: CityFormState = {
  id: null,
  name_en: "",
  name_mm: "",
  address_en: "",
  address_mm: "",
  description_en: "",
  description_mm: "",
  image_urls: "",
  image_files: [],
  lon: "",
  lat: "",
};

const initialLocationForm: LocationFormState = {
  id: null,
  city_id: "",
  name_en: "",
  name_mm: "",
  address_en: "",
  address_mm: "",
  description_en: "",
  description_mm: "",
  location_type: "",
  image_urls: "",
  image_files: [],
  lon: "",
  lat: "",
};

const initialRoadForm: RoadFormState = {
  id: null,
  city_id: "",
  user_id: "",
  name_en: "",
  name_mm: "",
  road_type: "",
  is_oneway: false,
  intersection_ids: [],
  coordinates: "",
};

const initialCityDetailForm: CityDetailFormState = {
  id: null,
  city_id: "",
  predefined_title: "",
  subtitle_burmese: "",
  subtitle_english: "",
  body_burmese: "",
  body_english: "",
  image_urls: "",
  image_files: [],
};

const PREDEFINED_TITLE_OPTIONS = [
  {
    value: "introduction_and_history",
    label_mm: "နိဒါန်း နှင့် ဒေသသမိုင်း",
    label_en: "Introduction and History",
  },
  { value: "geography", label_mm: "ပထဝီဝင်အနေအထား", label_en: "Geography" },
  {
    value: "climate_and_environment",
    label_mm: "ရာသီဥတုနှင့်သဘာဝပတ်ဝန်းကျင်",
    label_en: "Climate and Environment",
  },
  {
    value: "demographics",
    label_mm: "လူဦးရေဆိုင်ရာအချက်အလက်များ",
    label_en: "Demographics",
  },
  {
    value: "administrative_info",
    label_mm: "အုပ်ချုပ်ရေးဆိုင်ရာအချက်အလက်များ",
    label_en: "Administrative Information",
  },
  {
    value: "economic_info",
    label_mm: "စီးပွားရေးဆိုင်ရာ အချက်အလက်များ",
    label_en: "Economic Information",
  },
  {
    value: "social_info",
    label_mm: "လူမှုရေးဆိုင်ရာ အချက်အလက်များ",
    label_en: "Social Information",
  },
  {
    value: "religious_info",
    label_mm: "ဘာသာရေးဆိုင်ရာအချက်အလက်များ",
    label_en: "Religious Information",
  },
  {
    value: "development_info",
    label_mm: "ဒေသဖွံ့ဖြိုးရေးဆိုင်ရာအချက်အလက်များ",
    label_en: "Development Information",
  },
  { value: "general", label_mm: "အထွေထွေ", label_en: "General" },
];

const ROAD_TYPE_OPTIONS = [
  "highway",
  "local_road",
  "residential_road",
  "bridge",
  "tunnel",
];

const CARD_BORDER_CLASS =
  "border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 backdrop-blur-xl shadow-2xl shadow-emerald-500/10";
const FORM_CARD_CLASS = `space-y-6 rounded-2xl ${CARD_BORDER_CLASS} p-8`;
const FORM_SECTION_CLASS =
  "space-y-4 rounded-xl border border-white/5 bg-slate-950/30 p-6";
const PANEL_PILL_CLASS =
  "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 shadow-lg shadow-emerald-500/20";
const FIELD_LABEL_CLASS = "block text-sm font-semibold text-slate-200";
const FIELD_SUBTEXT_CLASS = "mt-1.5 text-xs text-slate-400 leading-relaxed";
const INPUT_BASE_CLASS =
  "mt-2 w-full rounded-lg border border-white/20 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:border-emerald-400/60 focus:outline-none focus:ring-4 focus:ring-emerald-400/20 hover:border-white/30";
const TEXTAREA_BASE_CLASS =
  "mt-2 w-full rounded-lg border border-white/20 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:border-emerald-400/60 focus:outline-none focus:ring-4 focus:ring-emerald-400/20 hover:border-white/30 resize-none min-h-[100px]";
const SELECT_BASE_CLASS =
  "mt-2 w-full rounded-lg border border-white/20 bg-slate-950/60 px-4 py-3 text-sm text-white transition-all duration-200 focus:border-emerald-400/60 focus:outline-none focus:ring-4 focus:ring-emerald-400/20 hover:border-white/30 cursor-pointer";
const SECTION_HEADING_CLASS = "text-3xl font-bold text-white tracking-tight";
const SECTION_DESCRIPTION_CLASS = "text-sm text-slate-400 leading-relaxed";
const SUBSECTION_HEADING_CLASS =
  "text-base font-bold text-white flex items-center gap-2";
const BUTTON_PRIMARY_CLASS =
  "inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";
const BUTTON_SECONDARY_CLASS =
  "inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition-all hover:border-emerald-400/50 hover:bg-emerald-400/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed";

function formatImageValue(value: AdminCity["image_urls"]): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(", ");
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch (error) {
    console.warn("Unable to parse image url string", error);
  }
  return value;
}

function extractPointFromWkt(wkt: string | null | undefined) {
  if (!wkt) return { lon: "", lat: "" };
  const match = /POINT\s*\(([-+0-9.eE]+)\s+([-+0-9.eE]+)\)/i.exec(wkt);
  if (!match) return { lon: "", lat: "" };
  return { lon: match[1], lat: match[2] };
}

function parseCoordinateText(input: string) {
  const coords: Array<[number, number]> = [];
  input
    .replace(/;/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(",").map((value) => value.trim());
      if (parts.length < 2) return;
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        coords.push([lon, lat]);
      }
    });
  return coords;
}

function extractLineStringCoordinates(
  wkt: string | null | undefined
): Array<[number, number]> {
  if (!wkt) return [];
  const match = /LINESTRING\s*\(([^)]+)\)/i.exec(wkt);
  if (!match) return [];

  const segments = match[1]
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const coordinates: Array<[number, number]> = [];
  segments.forEach((segment) => {
    const parts = segment.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      return;
    }
    const lon = Number(parts[0]);
    const lat = Number(parts[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      coordinates.push([lon, lat]);
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

async function requestWithAuth<T>(
  token: string,
  path: string,
  options?: RequestInit
): Promise<ApiEnvelope<T>> {
  const isFormData = options?.body instanceof FormData;
  const headers = new Headers(options?.headers ?? {});

  headers.set("Authorization", `Bearer ${token}`);
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  } else if (isFormData && headers.has("Content-Type")) {
    headers.delete("Content-Type");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...(options ?? {}),
    headers,
  });

  const data = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(data?.msg || data?.error || "Request failed");
  }
  return data;
}

export default function CollaboratorDashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [cityForm, setCityForm] = useState<CityFormState>(initialCityForm);
  const [locationForm, setLocationForm] =
    useState<LocationFormState>(initialLocationForm);
  const [roadForm, setRoadForm] = useState<RoadFormState>(initialRoadForm);
  const [cityDetailForm, setCityDetailForm] = useState<CityDetailFormState>(
    initialCityDetailForm
  );

  // File input keys for reset
  const [cityFileInputKey, setCityFileInputKey] = useState<number>(0);
  const [cityDetailFileInputKey, setCityDetailFileInputKey] =
    useState<number>(0);
  const [locationFileInputKey, setLocationFileInputKey] = useState<number>(0);

  // Submission loading states
  const [isCitySubmitting, setIsCitySubmitting] = useState(false);
  const [isLocationSubmitting, setIsLocationSubmitting] = useState(false);
  const [isRoadSubmitting, setIsRoadSubmitting] = useState(false);
  const [isCityDetailSubmitting, setIsCityDetailSubmitting] = useState(false);

  const [cities, setCities] = useState<AdminCity[]>([]);
  const [cityDetails, setCityDetails] = useState<AdminCityDetail[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [roads, setRoads] = useState<AdminRoad[]>([]);
  const [activePanel, setActivePanel] = useState<PanelKey>("dashboard");

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedUserRaw = localStorage.getItem("user");

    if (!storedToken || !storedUserRaw) {
      toast.error("Please sign in as a collaborator to access the dashboard.");
      navigate("/sign-in", { replace: true });
      return;
    }

    let storedUser: {
      id?: string;
      user_type?: string;
      role?: string;
    } | null = null;
    try {
      storedUser = JSON.parse(storedUserRaw);
      const normalizedType = String(
        storedUser?.user_type ?? storedUser?.role ?? ""
      ).toLowerCase();
      const isCollaborator = normalizedType === "collaborator";

      if (!isCollaborator) {
        toast.error("Collaborator access required.");
        navigate("/", { replace: true });
        return;
      }

      // Store current user ID for ownership checks
      if (storedUser?.id) {
        setCurrentUserId(storedUser.id);
      }
    } catch (error) {
      console.error("Failed to parse stored user", error);
      toast.error("Session data is corrupted. Please sign in again.");
      navigate("/sign-in", { replace: true });
      return;
    }

    setToken(storedToken);
  }, [navigate]);

  useEffect(() => {
    if (!token) return;

    async function loadDashboard(currentToken: string) {
      try {
        setLoading(true);
        // Use the collaborator-specific endpoint
        const { data } = await requestWithAuth<DashboardResponse>(
          currentToken,
          "/collaborator/dashboard"
        );
        if (data) {
          setCities(data.cities ?? []);
          setCityDetails(data.city_details ?? []);
          setLocations(data.locations ?? []);
          setRoads(data.roads ?? []);
        }
      } catch (error) {
        console.error("Failed to load dashboard data", error);
        toast.error(
          error instanceof Error ? error.message : "Unable to load dashboard"
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard(token);
  }, [token]);

  const cityOptions = useMemo(
    () =>
      cities.map((city) => ({
        id: city.id,
        label: city.name_en || city.name_mm || city.id,
      })),
    [cities]
  );

  const baseLocationTypeGroups = useMemo(
    () =>
      Object.entries(LOCATION_CATEGORIES).map(([groupKey, values]) => ({
        key: groupKey,
        label: humanizeKey(groupKey),
        options: values.map((value) => ({
          value,
          label: humanizeKey(value),
        })),
      })),
    []
  );

  const cityLabelById = useMemo(() => {
    const lookup: Record<string, string> = {};
    cities.forEach((city) => {
      const label = city.name_en || city.name_mm || city.id;
      lookup[city.id] = label;
    });
    return lookup;
  }, [cities]);

  // Filter data to only show collaborator's own creations
  const myCities = useMemo(() => {
    if (!currentUserId) return [];
    return cities.filter((c) => c.user_id === currentUserId);
  }, [currentUserId, cities]);

  const myCityDetails = useMemo(() => {
    if (!currentUserId) return [];
    return cityDetails.filter((cd) => cd.user_id === currentUserId);
  }, [currentUserId, cityDetails]);

  const myLocations = useMemo(() => {
    if (!currentUserId) return [];
    return locations.filter((l) => l.user_id === currentUserId);
  }, [currentUserId, locations]);

  const myRoads = useMemo(() => {
    if (!currentUserId) return [];
    return roads.filter((r) => r.user_id === currentUserId);
  }, [currentUserId, roads]);

  // Filter inactive data (is_active = false) for the current user
  const myInactiveCities = useMemo(() => {
    if (!currentUserId) return [];
    return cities.filter(
      (c) => c.user_id === currentUserId && c.is_active === false
    );
  }, [currentUserId, cities]);

  const myInactiveCityDetails = useMemo(() => {
    if (!currentUserId) return [];
    return cityDetails.filter(
      (cd) => cd.user_id === currentUserId && cd.is_active === false
    );
  }, [currentUserId, cityDetails]);

  const myInactiveLocations = useMemo(() => {
    if (!currentUserId) return [];
    return locations.filter(
      (l) => l.user_id === currentUserId && l.is_active === false
    );
  }, [currentUserId, locations]);

  const myInactiveRoads = useMemo(() => {
    if (!currentUserId) return [];
    return roads.filter(
      (r) => r.user_id === currentUserId && r.is_active === false
    );
  }, [currentUserId, roads]);

  // Transform data for table components (they expect old field names)
  const myCitiesForTable = useMemo(() => {
    return myCities.map((city) => ({
      ...city,
      name_en: city.name_en,
      name_mm: city.name_mm,
    }));
  }, [myCities]);

  const myCityDetailsForTable = useMemo(() => {
    return myCityDetails.map((detail) => ({
      ...detail,
      subtitle_en: detail.subtitle_english,
      subtitle_mm: detail.subtitle_burmese,
      body_en: detail.body_english,
      body_mm: detail.body_burmese,
    }));
  }, [myCityDetails]);

  const myLocationsForTable = useMemo(() => {
    return myLocations.map((location) => ({
      ...location,
      name_en: location.name_en,
      name_mm: location.name_mm,
    }));
  }, [myLocations]);

  const myRoadsForTable = useMemo(() => {
    return myRoads.map((road) => ({
      ...road,
      // Backend returns name_mm and name_en directly for roads, not name_en/name_mm
      name_en: road.name_en || road.name_mm,
      name_mm: road.name_mm || road.name_en,
    }));
  }, [myRoads]);

  // Transform inactive data for table components
  const myInactiveCitiesForTable = useMemo(() => {
    return myInactiveCities.map((city) => ({
      ...city,
      name_en: city.name_en,
      name_mm: city.name_mm,
    }));
  }, [myInactiveCities]);

  const myInactiveCityDetailsForTable = useMemo(() => {
    return myInactiveCityDetails.map((detail) => ({
      ...detail,
      subtitle_en: detail.subtitle_english,
      subtitle_mm: detail.subtitle_burmese,
      body_en: detail.body_english,
      body_mm: detail.body_burmese,
    }));
  }, [myInactiveCityDetails]);

  const myInactiveLocationsForTable = useMemo(() => {
    return myInactiveLocations.map((location) => ({
      ...location,
      name_en: location.name_mm,
      name_mm: location.name_en,
    }));
  }, [myInactiveLocations]);

  const myInactiveRoadsForTable = useMemo(() => {
    return myInactiveRoads.map((road) => ({
      ...road,
      // Backend returns name_mm and name_en directly for roads, not name_en/name_mm
      name_en: road.name_en || road.name_mm,
      name_mm: road.name_mm || road.name_en,
    }));
  }, [myInactiveRoads]);

  // Calculate collaborator's own creation counts
  const myCreationCounts = useMemo(() => {
    return {
      cities: myCities.length,
      cityDetails: myCityDetails.length,
      locations: myLocations.length,
      roads: myRoads.length,
    };
  }, [
    myCities.length,
    myCityDetails.length,
    myLocations.length,
    myRoads.length,
  ]);

  const navItems = useMemo(
    () => [
      {
        category: "Overview",
        items: [{ id: "dashboard" as const, label: "Dashboard", count: 0 }],
      },
      {
        category: "Content Management",
        items: [
          { id: "cities" as const, label: "Cities", count: cities.length },
          {
            id: "city-details" as const,
            label: "City Details",
            count: cityDetails.length,
          },
        ],
      },
      {
        category: "Network Management",
        items: [
          {
            id: "locations" as const,
            label: "Locations",
            count: locations.length,
          },
          { id: "roads" as const, label: "Roads", count: roads.length },
        ],
      },
      {
        category: "Inactive Content",
        items: [
          {
            id: "inactive-cities" as const,
            label: "Inactive Cities",
            count: myInactiveCities.length,
          },
          {
            id: "inactive-city-details" as const,
            label: "Inactive City Details",
            count: myInactiveCityDetails.length,
          },
          {
            id: "inactive-locations" as const,
            label: "Inactive Locations",
            count: myInactiveLocations.length,
          },
          {
            id: "inactive-roads" as const,
            label: "Inactive Roads",
            count: myInactiveRoads.length,
          },
        ],
      },
    ],
    [
      cities.length,
      cityDetails.length,
      locations.length,
      roads.length,
      myInactiveCities.length,
      myInactiveCityDetails.length,
      myInactiveLocations.length,
      myInactiveRoads.length,
    ]
  );

  const intersectionLocations = useMemo(
    () =>
      locations.filter((location) => {
        const type = (location.location_type ?? "").toLowerCase();
        return type.includes("intersection");
      }),
    [locations]
  );

  const intersectionLookupById = useMemo(() => {
    const lookup: Record<string, AdminLocation> = {};
    intersectionLocations.forEach((location) => {
      lookup[location.id] = location;
    });
    return lookup;
  }, [intersectionLocations]);

  const selectedLocationCity = useMemo(() => {
    if (!locationForm.city_id) return null;
    return cities.find((city) => city.id === locationForm.city_id) ?? null;
  }, [cities, locationForm.city_id]);

  const selectedCityCenter = useMemo(() => {
    if (!selectedLocationCity) return null;
    const { lon, lat } = extractPointFromWkt(selectedLocationCity.geometry);
    const parsedLon = Number(lon);
    const parsedLat = Number(lat);
    if (!Number.isFinite(parsedLon) || !Number.isFinite(parsedLat)) {
      return null;
    }
    return { lon: parsedLon, lat: parsedLat };
  }, [selectedLocationCity]);

  const hasLocationCoordinates = useMemo(() => {
    const lonText = locationForm.lon.trim();
    const latText = locationForm.lat.trim();
    if (!lonText || !latText) {
      return false;
    }
    const lon = Number(lonText);
    const lat = Number(latText);
    return Number.isFinite(lon) && Number.isFinite(lat);
  }, [locationForm.lat, locationForm.lon]);

  const isLocationMapDisabled =
    !locationForm.city_id && !hasLocationCoordinates;

  const cityIntersections = useMemo(() => {
    if (!roadForm.city_id) return [] as AdminLocation[];
    return intersectionLocations.filter(
      (location) => location.city_id === roadForm.city_id
    );
  }, [intersectionLocations, roadForm.city_id]);

  const selectedRoadCity = useMemo(() => {
    if (!roadForm.city_id) return null;
    return cities.find((city) => city.id === roadForm.city_id) ?? null;
  }, [cities, roadForm.city_id]);

  const selectedRoadCityCenter = useMemo(() => {
    if (!selectedRoadCity) return null;
    const { lon, lat } = extractPointFromWkt(selectedRoadCity.geometry);
    const parsedLon = Number(lon);
    const parsedLat = Number(lat);
    if (!Number.isFinite(parsedLon) || !Number.isFinite(parsedLat)) {
      return null;
    }
    return { lon: parsedLon, lat: parsedLat };
  }, [selectedRoadCity]);

  const cityRoadPolylines = useMemo(() => {
    if (!roadForm.city_id)
      return [] as Array<{
        id: string;
        name: string;
        positions: [number, number][];
        lengthMeters: number;
      }>;

    return roads
      .filter((road) => road.city_id === roadForm.city_id && road.geometry)
      .map((road) => {
        const coordinates = extractLineStringCoordinates(road.geometry);
        if (coordinates.length < 2) {
          return null;
        }

        const positions = coordinates.map(
          ([lon, lat]) => [lat, lon] as [number, number]
        );

        return {
          id: road.id,
          name: road.name_mm || road.name_en || road.id,
          positions,
          lengthMeters: 0,
        };
      })
      .filter(
        (
          road
        ): road is {
          id: string;
          name: string;
          positions: [number, number][];
          lengthMeters: number;
        } => Boolean(road)
      );
  }, [roadForm.city_id, roads]);

  const selectedIntersections = useMemo(() => {
    return roadForm.intersection_ids
      .map((id) => locations.find((l) => l.id === id))
      .filter((location): location is AdminLocation => Boolean(location));
  }, [locations, roadForm.intersection_ids]);

  const toNullable = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const getActiveUserId = (): string | null => {
    if (currentUserId) {
      return currentUserId;
    }

    try {
      const storedToken = localStorage.getItem("access_token");
      const storedUserRaw = localStorage.getItem("user");
      if (!storedToken || !storedUserRaw) {
        return null;
      }
      const parsed = JSON.parse(storedUserRaw);
      if (parsed && typeof parsed === "object" && "id" in parsed) {
        const userId = String(parsed.id);
        setCurrentUserId(userId);
        return userId;
      }
      return null;
    } catch (error) {
      console.error("Unable to derive user id", error);
      return null;
    }
  };

  const buildPointPayload = (lonText: string, latText: string) => {
    const lonTrimmed = lonText.trim();
    const latTrimmed = latText.trim();

    if (!lonTrimmed && !latTrimmed) {
      return { coords: null } as const;
    }

    if (!lonTrimmed || !latTrimmed) {
      return { error: "Please provide both longitude and latitude." } as const;
    }

    const lon = Number(lonTrimmed);
    const lat = Number(latTrimmed);

    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return { error: "Longitude and latitude must be numeric." } as const;
    }

    return { coords: { lon, lat } } as const;
  };

  // Form submission handlers
  async function handleCitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken) return;

    const { coords, error } = buildPointPayload(cityForm.lon, cityForm.lat);

    if (error) {
      toast.error(error);
      return;
    }

    const activeUserId = getActiveUserId();
    if (!activeUserId) {
      toast.error("Unable to determine the current user account.");
      return;
    }

    const formData = new FormData();
    formData.append("name_en", cityForm.name_mm.trim());
    formData.append("name_mm", cityForm.name_en);
    formData.append("user_id", activeUserId);
    formData.append("address_en", cityForm.address_en);
    formData.append("address_mm", cityForm.address_mm);
    formData.append("description_en", cityForm.description_en);
    formData.append("description_mm", cityForm.description_mm);
    formData.append("image_urls", cityForm.image_urls);

    if (coords) {
      formData.append("lon", String(coords.lon));
      formData.append("lat", String(coords.lat));
    } else {
      formData.append("geometry", "");
    }

    if (cityForm.image_files.length) {
      cityForm.image_files.forEach((file) => {
        formData.append("image_files[]", file);
      });
      if (!formData.has("image_file")) {
        formData.append("image_file", cityForm.image_files[0]);
      }
    }

    const cityId = cityForm.id;

    setIsCitySubmitting(true);
    try {
      const { data } = await requestWithAuth<AdminCity>(
        authToken,
        cityId ? `/collaborator/cities/${cityId}` : "/collaborator/cities",
        {
          method: cityId ? "PUT" : "POST",
          body: formData,
        }
      );

      if (data) {
        setCities((prev) =>
          cityId
            ? prev.map((city) => (city.id === data.id ? data : city))
            : [data, ...prev]
        );
        toast.success(cityId ? "City updated." : "City created.");
        setCityForm(initialCityForm);
        setCityFileInputKey((prev: number) => prev + 1);
      }
    } catch (err) {
      console.error("Failed to save city", err);
      toast.error(err instanceof Error ? err.message : "Unable to save city");
    } finally {
      setIsCitySubmitting(false);
    }
  }

  async function handleLocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken) return;

    if (!locationForm.city_id.trim()) {
      toast.error("Please select a city.");
      return;
    }

    const { coords, error } = buildPointPayload(
      locationForm.lon,
      locationForm.lat
    );

    if (error) {
      toast.error(error);
      return;
    }

    const activeUserId = getActiveUserId();
    if (!activeUserId) {
      toast.error("Unable to determine the current user account.");
      return;
    }

    const formData = new FormData();
    formData.append("city_id", locationForm.city_id);
    formData.append("user_id", activeUserId);
    formData.append("name_mm", locationForm.name_en);
    formData.append("name_en", locationForm.name_mm);
    formData.append("address_en", locationForm.address_en);
    formData.append("address_mm", locationForm.address_mm);
    formData.append("description_en", locationForm.description_en);
    formData.append("description_mm", locationForm.description_mm);
    formData.append("location_type", locationForm.location_type);
    formData.append("image_urls", locationForm.image_urls);

    if (coords) {
      formData.append("lon", String(coords.lon));
      formData.append("lat", String(coords.lat));
    } else {
      formData.append("geometry", "");
    }

    if (locationForm.image_files.length) {
      locationForm.image_files.forEach((file) => {
        formData.append("image_files[]", file);
      });
      if (!formData.has("image_file")) {
        formData.append("image_file", locationForm.image_files[0]);
      }
    }

    const locationId = locationForm.id;

    setIsLocationSubmitting(true);
    try {
      const { data } = await requestWithAuth<AdminLocation>(
        authToken,
        locationId
          ? `/collaborator/locations/${locationId}`
          : "/collaborator/locations",
        {
          method: locationId ? "PUT" : "POST",
          body: formData,
        }
      );

      if (data) {
        setLocations((prev) =>
          locationId
            ? prev.map((location) =>
                location.id === data.id ? data : location
              )
            : [data, ...prev]
        );
        toast.success(locationId ? "Location updated." : "Location created.");
        setLocationForm(initialLocationForm);
        setLocationFileInputKey((prev: number) => prev + 1);
      }
    } catch (err) {
      console.error("Failed to save location", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to save location"
      );
    } finally {
      setIsLocationSubmitting(false);
    }
  }

  async function handleRoadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken) return;

    if (!roadForm.city_id.trim()) {
      toast.error("Please select a city.");
      return;
    }

    let coordinatePairs: Array<[number, number]> = [];

    if (roadForm.intersection_ids.length >= 2) {
      const missingIds: string[] = [];
      coordinatePairs = roadForm.intersection_ids
        .map((id) => {
          const location = intersectionLookupById[id];
          if (!location || location.city_id !== roadForm.city_id) {
            missingIds.push(id);
            return null;
          }
          const { lon, lat } = extractPointFromWkt(location.geometry);
          const lonNum = Number(lon);
          const latNum = Number(lat);
          if (!Number.isFinite(lonNum) || !Number.isFinite(latNum)) {
            missingIds.push(id);
            return null;
          }
          return [lonNum, latNum] as [number, number];
        })
        .filter((pair): pair is [number, number] => pair !== null);

      if (missingIds.length) {
        toast.error(
          "Unable to resolve coordinates for all selected intersections."
        );
        return;
      }
    }

    if (coordinatePairs.length < 2) {
      coordinatePairs = parseCoordinateText(roadForm.coordinates);
    }

    if (coordinatePairs.length < 2) {
      toast.error(
        "Please select at least two intersections or provide coordinates."
      );
      return;
    }

    const segmentLengths = computeSegmentLengths(coordinatePairs);

    const payload: Record<string, unknown> = {
      city_id: roadForm.city_id,
      user_id: toNullable(roadForm.user_id),
      name_mm: toNullable(roadForm.name_en),
      name_en: toNullable(roadForm.name_mm),
      road_type: toNullable(roadForm.road_type),
      is_oneway: roadForm.is_oneway,
      coordinates: coordinatePairs,
      length_m: segmentLengths,
    };

    const roadId = roadForm.id;

    setIsRoadSubmitting(true);
    try {
      const { data } = await requestWithAuth<AdminRoad>(
        authToken,
        roadId ? `/collaborator/roads/${roadId}` : "/collaborator/roads",
        {
          method: roadId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (data) {
        setRoads((prev) =>
          roadId
            ? prev.map((road) => (road.id === data.id ? data : road))
            : [data, ...prev]
        );
        toast.success(roadId ? "Road updated." : "Road created.");
        setRoadForm(initialRoadForm);
      }
    } catch (err) {
      console.error("Failed to save road", err);
      toast.error(err instanceof Error ? err.message : "Unable to save road");
    } finally {
      setIsRoadSubmitting(false);
    }
  }

  async function handleCityDetailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken) return;

    if (!cityDetailForm.city_id.trim()) {
      toast.error("Please select a city.");
      return;
    }

    if (!cityDetailForm.predefined_title) {
      toast.error("Please select a title category.");
      return;
    }

    const activeUserId = getActiveUserId();
    if (!activeUserId) {
      toast.error("Unable to determine the current user account.");
      return;
    }

    const formData = new FormData();
    formData.append("city_id", cityDetailForm.city_id);
    formData.append("user_id", activeUserId);
    formData.append("predefined_title", cityDetailForm.predefined_title);
    formData.append("subtitle_en", cityDetailForm.subtitle_english.trim());
    formData.append("subtitle_mm", cityDetailForm.subtitle_burmese);
    formData.append("body_en", cityDetailForm.body_english);
    formData.append("body_mm", cityDetailForm.body_burmese);
    formData.append("image_urls", cityDetailForm.image_urls);

    if (cityDetailForm.image_files.length) {
      cityDetailForm.image_files.forEach((file) => {
        formData.append("image_files[]", file);
      });
      if (!formData.has("image_file")) {
        formData.append("image_file", cityDetailForm.image_files[0]);
      }
    }

    const cityDetailId = cityDetailForm.id;

    setIsCityDetailSubmitting(true);
    try {
      const { data } = await requestWithAuth<AdminCityDetail>(
        authToken,
        cityDetailId
          ? `/collaborator/city-details/${cityDetailId}`
          : "/collaborator/city-details",
        {
          method: cityDetailId ? "PUT" : "POST",
          body: formData,
        }
      );

      if (data) {
        setCityDetails((prev) =>
          cityDetailId
            ? prev.map((detail) => (detail.id === data.id ? data : detail))
            : [data, ...prev]
        );
        toast.success(
          cityDetailId ? "City detail updated." : "City detail created."
        );
        setCityDetailForm(initialCityDetailForm);
        setCityDetailFileInputKey((prev: number) => prev + 1);
      }
    } catch (err) {
      console.error("Failed to save city detail", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to save city detail"
      );
    } finally {
      setIsCityDetailSubmitting(false);
    }
  }

  const handleCityEdit = (city: AdminCity) => {
    // Check ownership before allowing edit
    if (city.user_id !== currentUserId) {
      toast.error("You can only edit cities you created");
      return;
    }

    const { lon, lat } = extractPointFromWkt(city.coordinates);

    setCityForm({
      id: city.id,
      name_en: city.name_mm || "",
      name_mm: city.name_en || "",
      address_en: city.address_en || "",
      address_mm: city.address_mm || "",
      description_en: city.description_en || "",
      description_mm: city.description_mm || "",
      lon: lon ?? "",
      lat: lat ?? "",
      image_files: [],
      image_urls: formatImageValue(city.image_urls),
    });
    setActivePanel("cities");
  };

  const handleCityDelete = async (cityId: string) => {
    if (!token) return;

    const city = cities.find((c) => c.id === cityId);
    if (city && city.user_id !== currentUserId) {
      toast.error("You can only delete cities you created");
      return;
    }

    if (!confirm("Are you sure you want to delete this city?")) return;

    try {
      await requestWithAuth(token, `/collaborator/cities/${cityId}`, {
        method: "DELETE",
      });
      setCities((prev) => prev.filter((c) => c.id !== cityId));
      toast.success("City deleted successfully");
    } catch (error) {
      console.error("Failed to delete city", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete city"
      );
    }
  };

  const handleCityDetailEdit = (detail: AdminCityDetail) => {
    if (detail.user_id !== currentUserId) {
      toast.error("You can only edit city details you created");
      return;
    }

    setCityDetailForm({
      id: detail.id,
      city_id: detail.city_id || "",
      predefined_title: detail.predefined_title || "",
      subtitle_english: detail.subtitle_english || "",
      subtitle_burmese: detail.subtitle_burmese || "",
      body_english: detail.body_english || "",
      body_burmese: detail.body_burmese || "",
      image_files: [],
      image_urls: formatImageValue(detail.image_urls),
    });
    setActivePanel("city-details");
  };

  const handleCityDetailDelete = async (detailId: string) => {
    if (!token) return;

    const detail = cityDetails.find((d) => d.id === detailId);
    if (detail && detail.user_id !== currentUserId) {
      toast.error("You can only delete city details you created");
      return;
    }

    if (!confirm("Are you sure you want to delete this city detail?")) return;

    try {
      await requestWithAuth(token, `/collaborator/city-details/${detailId}`, {
        method: "DELETE",
      });
      setCityDetails((prev) => prev.filter((d) => d.id !== detailId));
      toast.success("City detail deleted successfully");
    } catch (error) {
      console.error("Failed to delete city detail", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete city detail"
      );
    }
  };

  const handleLocationEdit = (location: AdminLocation) => {
    if (location.user_id !== currentUserId) {
      toast.error("You can only edit locations you created");
      return;
    }

    const { lon, lat } = extractPointFromWkt(location.coordinates);

    setLocationForm({
      id: location.id,
      city_id: location.city_id || "",
      name_en: location.name_en || "",
      name_mm: location.name_mm || "",
      address_en: location.address_en || "",
      address_mm: location.address_mm || "",
      description_en: location.description_en || "",
      description_mm: location.description_mm || "",
      location_type: location.location_type || "",
      lon: lon ?? "",
      lat: lat ?? "",
      image_files: [],
      image_urls: formatImageValue(location.image_urls),
    });
    setActivePanel("locations");
  };

  const handleLocationDelete = async (locationId: string) => {
    if (!token) return;

    const location = locations.find((l) => l.id === locationId);
    if (location && location.user_id !== currentUserId) {
      toast.error("You can only delete locations you created");
      return;
    }

    if (!confirm("Are you sure you want to delete this location?")) return;

    try {
      await requestWithAuth(token, `/collaborator/locations/${locationId}`, {
        method: "DELETE",
      });
      setLocations((prev) => prev.filter((l) => l.id !== locationId));
      toast.success("Location deleted successfully");
    } catch (error) {
      console.error("Failed to delete location", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete location"
      );
    }
  };

  const handleRoadEdit = (road: AdminRoad) => {
    if (road.user_id !== currentUserId) {
      toast.error("You can only edit roads you created");
      return;
    }

    setRoadForm({
      id: road.id,
      city_id: road.city_id || "",
      user_id: road.user_id || "",
      name_en: road.name_en || "",
      name_mm: road.name_mm || "",
      road_type: road.road_type || "",
      is_oneway: road.is_oneway || false,
      intersection_ids: road.intersection_ids || [],
      coordinates: "",
    });
    setActivePanel("roads");
  };

  const handleRoadDelete = async (roadId: string) => {
    if (!token) return;

    const road = roads.find((r) => r.id === roadId);
    if (road && road.user_id !== currentUserId) {
      toast.error("You can only delete roads you created");
      return;
    }

    if (!confirm("Are you sure you want to delete this road?")) return;

    try {
      await requestWithAuth(token, `/collaborator/roads/${roadId}`, {
        method: "DELETE",
      });
      setRoads((prev) => prev.filter((r) => r.id !== roadId));
      toast.success("Road deleted successfully");
    } catch (error) {
      console.error("Failed to delete road", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete road"
      );
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 blur-3xl" />
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl px-8 py-6 shadow-2xl">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
              <div className="absolute inset-2 rounded-full bg-slate-900" />
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-200">
                Validating Credentials
              </span>
              <span className="text-xs text-slate-400">Please wait...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/85 to-slate-950" />
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="absolute -left-1/3 top-32 h-[420px] w-[420px] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -right-1/2 bottom-0 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Sidebar */}
      <Sidebar
        activePanel={activePanel}
        onPanelChange={(panel) => setActivePanel(panel as PanelKey)}
        navItems={navItems}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-72">
        <div className="relative z-10 w-full h-screen overflow-y-auto px-6 py-8">
          <main className="space-y-8 pb-16 max-w-7xl mx-auto">
            {loading ? (
              <div className={`rounded-3xl ${CARD_BORDER_CLASS} p-12`}>
                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-slate-700/50 border-t-emerald-400 border-r-cyan-400" />
                    <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20" />
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-white">
                      Loading Dashboard
                    </h3>
                    <p className="text-sm text-slate-400">
                      Fetching your data, please wait...
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
                  </div>
                </div>
              </div>
            ) : null}

            {activePanel === "dashboard" ? (
              <section className="space-y-8">
                {/* My Contributions Section */}
                <div className="flex flex-col gap-2">
                  <h2 className={SECTION_HEADING_CLASS}>My Contributions</h2>
                  <p className={SECTION_DESCRIPTION_CLASS}>
                    Content you've created as a collaborator. You can edit and
                    delete your own content.
                  </p>
                </div>

                {/* My Contributions Statistics Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {/* My Cities Card */}
                  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-slate-900/80 to-slate-950/90 p-6 backdrop-blur-xl transition-all hover:border-indigo-400/30 hover:shadow-lg hover:shadow-indigo-500/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-400">
                          My Cities
                        </span>
                        <div className="rounded-lg bg-indigo-500/20 p-2">
                          <svg
                            className="h-5 w-5 text-indigo-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-white">
                        {myCreationCounts.cities}
                      </div>
                      <p className="text-xs text-slate-400">
                        Cities you've created
                      </p>
                    </div>
                  </div>

                  {/* My City Details Card */}
                  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-teal-500/10 via-slate-900/80 to-slate-950/90 p-6 backdrop-blur-xl transition-all hover:border-teal-400/30 hover:shadow-lg hover:shadow-teal-500/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-400">
                          My City Details
                        </span>
                        <div className="rounded-lg bg-teal-500/20 p-2">
                          <svg
                            className="h-5 w-5 text-teal-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-white">
                        {myCreationCounts.cityDetails}
                      </div>
                      <p className="text-xs text-slate-400">
                        Detail entries you've added
                      </p>
                    </div>
                  </div>

                  {/* My Locations Card */}
                  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-pink-500/10 via-slate-900/80 to-slate-950/90 p-6 backdrop-blur-xl transition-all hover:border-pink-400/30 hover:shadow-lg hover:shadow-pink-500/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-400">
                          My Locations
                        </span>
                        <div className="rounded-lg bg-pink-500/20 p-2">
                          <svg
                            className="h-5 w-5 text-pink-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-white">
                        {myCreationCounts.locations}
                      </div>
                      <p className="text-xs text-slate-400">
                        Locations you've registered
                      </p>
                    </div>
                  </div>

                  {/* My Roads Card */}
                  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 via-slate-900/80 to-slate-950/90 p-6 backdrop-blur-xl transition-all hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-500/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-400">
                          My Roads
                        </span>
                        <div className="rounded-lg bg-amber-500/20 p-2">
                          <svg
                            className="h-5 w-5 text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-white">
                        {myCreationCounts.roads}
                      </div>
                      <p className="text-xs text-slate-400">
                        Road segments you've mapped
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activePanel === "cities" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>Cities</h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      Manage township profiles, hero imagery, and descriptions.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {myCities.length} total
                    </span>
                  </div>
                </div>

                <form onSubmit={handleCitySubmit} className={FORM_CARD_CLASS}>
                  {/* Form Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
                        <svg
                          className="h-5 w-5 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {cityForm.id ? "Edit City Entry" : "Create New City"}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {cityForm.id
                            ? "Update the city information below"
                            : "Add a new city to the system"}
                        </p>
                      </div>
                    </div>
                    {cityForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCityForm(initialCityForm);
                          setCityFileInputKey((prev: number) => prev + 1);
                        }}
                        className={BUTTON_SECONDARY_CLASS}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Cancel
                      </button>
                    ) : null}
                  </div>

                  {/* Basic Information Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Basic Information
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          English Name *
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Enter city name in English"
                          value={cityForm.name_mm}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              name_mm: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>Burmese Name</span>
                        <input
                          type="text"
                          placeholder="မြို့အမည် (ဗမာ)"
                          value={cityForm.name_en}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              name_en: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Address (English)
                        </span>
                        <input
                          type="text"
                          placeholder="Enter address in English"
                          value={cityForm.address_en}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              address_en: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Address (Myanmar)
                        </span>
                        <input
                          type="text"
                          placeholder="လိပ်စာ (ဗမာ)"
                          value={cityForm.address_mm}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              address_mm: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Description (English)
                        </span>
                        <textarea
                          placeholder="Provide a detailed description in English..."
                          value={cityForm.description_en}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              description_en: event.target.value,
                            }))
                          }
                          className={TEXTAREA_BASE_CLASS}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Description (Myanmar)
                        </span>
                        <textarea
                          placeholder="အသေးစိတ်ဖော်ပြချက် (ဗမာ)..."
                          value={cityForm.description_mm}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              description_mm: event.target.value,
                            }))
                          }
                          className={TEXTAREA_BASE_CLASS}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Location Coordinates Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Location Coordinates
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>Longitude</span>
                        <input
                          type="text"
                          placeholder="e.g., 96.195132"
                          value={cityForm.lon}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              lon: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>Latitude</span>
                        <input
                          type="text"
                          placeholder="e.g., 16.871311"
                          value={cityForm.lat}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              lat: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                    </div>
                    <p className={FIELD_SUBTEXT_CLASS}>
                      Specify the geographic coordinates for the city center.
                      These coordinates will be used for map visualization.
                    </p>
                  </div>

                  {/* Media Upload Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Media Upload
                    </h4>
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>City Images</span>
                      <input
                        key={cityFileInputKey}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          setCityForm((prev) => ({
                            ...prev,
                            image_files: event.target.files
                              ? Array.from(event.target.files)
                              : [],
                          }))
                        }
                        className={`${INPUT_BASE_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-gradient-to-r file:from-emerald-500 file:via-cyan-500 file:to-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110`}
                      />
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Upload one or more images showcasing the city. Supported
                        formats: JPG, PNG, GIF. Maximum file size: 5MB per
                        image.
                      </p>
                    </label>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                    {cityForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCityForm(initialCityForm);
                          setCityFileInputKey((prev: number) => prev + 1);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition-all hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-300"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Discard Changes
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className={BUTTON_PRIMARY_CLASS}
                      disabled={isCitySubmitting}
                    >
                      {isCitySubmitting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          {cityForm.id ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={
                                cityForm.id
                                  ? "M5 13l4 4L19 7"
                                  : "M12 4v16m8-8H4"
                              }
                            />
                          </svg>
                          {cityForm.id ? "Update City" : "Create City"}
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* City Table */}
                <CityTable
                  cities={myCitiesForTable}
                  onEdit={handleCityEdit}
                  onDelete={handleCityDelete}
                />
              </section>
            ) : null}

            {activePanel === "city-details" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>City Details</h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      Create and manage detailed city information sections.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {myCityDetails.length} total
                    </span>
                  </div>
                </div>

                {/* City Detail Form */}
                <form
                  onSubmit={handleCityDetailSubmit}
                  className={FORM_CARD_CLASS}
                >
                  {/* Form Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 shadow-lg shadow-purple-500/20">
                        <svg
                          className="h-6 w-6 text-purple-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          {cityDetailForm.id
                            ? "Edit City Detail"
                            : "Create New City Detail"}
                        </h3>
                        <p className="text-sm text-slate-400">
                          {cityDetailForm.id
                            ? "Update city content block"
                            : "Add new content for a city"}
                        </p>
                      </div>
                    </div>
                    {cityDetailForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCityDetailForm(initialCityDetailForm);
                          setCityDetailFileInputKey((prev: number) => prev + 1);
                          scrollToTop();
                        }}
                        className={BUTTON_SECONDARY_CLASS}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>

                  {/* City Selection Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-purple-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      City Selection
                    </h4>
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>
                        Select City <span className="text-red-400">*</span>
                      </span>
                      <select
                        required
                        value={cityDetailForm.city_id}
                        onChange={(event) =>
                          setCityDetailForm((prev) => ({
                            ...prev,
                            city_id: event.target.value,
                          }))
                        }
                        className={SELECT_BASE_CLASS}
                      >
                        <option value="">Choose a city</option>
                        {cityOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Select the city for which this detail section will be
                        displayed.
                      </p>
                    </label>
                  </div>

                  {/* Title Category Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-purple-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                        />
                      </svg>
                      Title Category
                    </h4>
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>
                        Select Title Category{" "}
                        <span className="text-red-400">*</span>
                      </span>
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Choose one of the predefined title categories for this
                        city detail section.
                      </p>
                      <select
                        required
                        value={cityDetailForm.predefined_title}
                        onChange={(event) =>
                          setCityDetailForm((prev) => ({
                            ...prev,
                            predefined_title: event.target.value,
                          }))
                        }
                        className={SELECT_BASE_CLASS}
                      >
                        <option value="">Choose a title category</option>
                        {PREDEFINED_TITLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label_mm} ({option.label_en})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Subtitle Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-purple-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                        />
                      </svg>
                      Subtitle (Optional)
                    </h4>
                    <p className={FIELD_SUBTEXT_CLASS}>
                      Add a custom subtitle for this section. This will appear
                      below the main title category.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          English Subtitle
                        </span>
                        <input
                          type="text"
                          placeholder="Enter subtitle in English"
                          value={cityDetailForm.subtitle_english}
                          onChange={(event) =>
                            setCityDetailForm((prev) => ({
                              ...prev,
                              subtitle_english: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Burmese Subtitle
                        </span>
                        <input
                          type="text"
                          placeholder="ခေါင်းစဉ်ငယ် (ဗမာ)"
                          value={cityDetailForm.subtitle_burmese}
                          onChange={(event) =>
                            setCityDetailForm((prev) => ({
                              ...prev,
                              subtitle_burmese: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Body Content Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-purple-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h7"
                        />
                      </svg>
                      Content Body
                    </h4>
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>English Content</span>
                      <textarea
                        placeholder="Write detailed content in English..."
                        value={cityDetailForm.body_english}
                        onChange={(event) =>
                          setCityDetailForm((prev) => ({
                            ...prev,
                            body_english: event.target.value,
                          }))
                        }
                        className={TEXTAREA_BASE_CLASS}
                        rows={6}
                      />
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Provide detailed information in English for this
                        section.
                      </p>
                    </label>
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>Burmese Content</span>
                      <textarea
                        placeholder="အသေးစိတ်အကြောင်းအရာ (ဗမာ)..."
                        value={cityDetailForm.body_burmese}
                        onChange={(event) =>
                          setCityDetailForm((prev) => ({
                            ...prev,
                            body_burmese: event.target.value,
                          }))
                        }
                        className={TEXTAREA_BASE_CLASS}
                        rows={6}
                      />
                      <p className={FIELD_SUBTEXT_CLASS}>
                        ဤကဏ္ဍအတွက် မြန်မာဘာသာဖြင့် အသေးစိတ်အချက်အလက်များ ပေးပါ
                      </p>
                    </label>
                  </div>

                  {/* Media Upload Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-purple-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Media Upload
                    </h4>
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>Content Images</span>
                      <input
                        key={cityDetailFileInputKey}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          setCityDetailForm((prev) => ({
                            ...prev,
                            image_files: event.target.files
                              ? Array.from(event.target.files)
                              : [],
                          }))
                        }
                        className={`${INPUT_BASE_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-gradient-to-r file:from-purple-500 file:via-pink-500 file:to-red-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110`}
                      />
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Upload images related to this content block. These will
                        be displayed alongside the text content.
                      </p>
                    </label>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                    {cityDetailForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCityDetailForm(initialCityDetailForm);
                          setCityDetailFileInputKey((prev: number) => prev + 1);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition-all hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-300"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Discard Changes
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className={BUTTON_PRIMARY_CLASS}
                      disabled={isCityDetailSubmitting}
                    >
                      {isCityDetailSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {cityDetailForm.id ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={
                                cityDetailForm.id
                                  ? "M5 13l4 4L19 7"
                                  : "M12 4v16m8-8H4"
                              }
                            />
                          </svg>
                          {cityDetailForm.id
                            ? "Update Detail"
                            : "Create Detail"}
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* City Detail Table */}
                <CityDetailTable
                  cityDetails={myCityDetailsForTable as any}
                  cityLookup={cityLabelById}
                  onEdit={handleCityDetailEdit as any}
                  onDelete={handleCityDetailDelete}
                />
              </section>
            ) : null}

            {activePanel === "locations" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>Locations</h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      Create and manage location points of interest across
                      cities.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {myLocations.length} total
                    </span>
                  </div>
                </div>

                {/* Location Form */}
                <form
                  onSubmit={handleLocationSubmit}
                  className={FORM_CARD_CLASS}
                >
                  {/* Form Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 shadow-lg shadow-pink-500/20">
                        <svg
                          className="h-6 w-6 text-pink-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          {locationForm.id
                            ? "Edit Location"
                            : "Create New Location"}
                        </h3>
                        <p className="text-sm text-slate-400">
                          {locationForm.id
                            ? "Update location details and coordinates"
                            : "Add a new point of interest to the map"}
                        </p>
                      </div>
                    </div>
                    {locationForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setLocationForm(initialLocationForm);
                          scrollToTop();
                        }}
                        className={BUTTON_SECONDARY_CLASS}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>

                  {/* Basic Information Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-pink-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Basic Information
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          City <span className="text-red-400">*</span>
                        </span>
                        <select
                          required
                          value={locationForm.city_id}
                          onChange={(e) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              city_id: e.target.value,
                            }))
                          }
                          className={SELECT_BASE_CLASS}
                        >
                          <option value="">Select a city</option>
                          {cities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name_en || city.name_mm || city.id}
                            </option>
                          ))}
                        </select>
                        <p className={FIELD_SUBTEXT_CLASS}>
                          Select the city where this location is situated.
                        </p>
                      </label>

                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Location Type <span className="text-red-400">*</span>
                        </span>
                        <select
                          required
                          value={locationForm.location_type}
                          onChange={(e) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              location_type: e.target.value,
                            }))
                          }
                          className={SELECT_BASE_CLASS}
                        >
                          <option value="">Select a type</option>
                          {baseLocationTypeGroups.map((group) => (
                            <optgroup key={group.key} label={group.label}>
                              {group.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <p className={FIELD_SUBTEXT_CLASS}>
                          Choose the category that best describes this location.
                        </p>
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          English Name <span className="text-red-400">*</span>
                        </span>
                        <input
                          required
                          type="text"
                          value={locationForm.name_mm}
                          onChange={(e) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              name_mm: e.target.value,
                            }))
                          }
                          placeholder="e.g., Shwedagon Pagoda"
                          className={INPUT_BASE_CLASS}
                        />
                        <p className={FIELD_SUBTEXT_CLASS}>
                          Official English name of the location.
                        </p>
                      </label>

                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Burmese Name <span className="text-red-400">*</span>
                        </span>
                        <input
                          required
                          type="text"
                          value={locationForm.name_en}
                          onChange={(e) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              name_en: e.target.value,
                            }))
                          }
                          placeholder="ဥပမာ - ရွှေတိဂုံဘုရား"
                          className={INPUT_BASE_CLASS}
                        />
                        <p className={FIELD_SUBTEXT_CLASS}>
                          ဒေသတွင်းမြန်မာဘာသာဖြင့် အမည်
                        </p>
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          English Address
                        </span>
                        <input
                          type="text"
                          value={locationForm.address_en}
                          onChange={(e) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              address_en: e.target.value,
                            }))
                          }
                          placeholder="Street address, ward, etc."
                          className={INPUT_BASE_CLASS}
                        />
                        <p className={FIELD_SUBTEXT_CLASS}>
                          Physical address in English (optional).
                        </p>
                      </label>

                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Burmese Address
                        </span>
                        <input
                          type="text"
                          value={locationForm.address_mm}
                          onChange={(e) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              address_mm: e.target.value,
                            }))
                          }
                          placeholder="လမ်း၊ ရပ်ကွက် စသည်"
                          className={INPUT_BASE_CLASS}
                        />
                        <p className={FIELD_SUBTEXT_CLASS}>
                          မြန်မာဘာသာဖြင့် လိပ်စာ (ရွေးချယ်ခွင့်)
                        </p>
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          English Description
                        </span>
                        <textarea
                          value={locationForm.description_en}
                          onChange={(e) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              description_en: e.target.value,
                            }))
                          }
                          placeholder="Describe this location in English..."
                          className={TEXTAREA_BASE_CLASS}
                        />
                        <p className={FIELD_SUBTEXT_CLASS}>
                          Additional details about this location.
                        </p>
                      </label>

                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Burmese Description
                        </span>
                        <textarea
                          value={locationForm.description_mm}
                          onChange={(e) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              description_mm: e.target.value,
                            }))
                          }
                          placeholder="ဤနေရာအကြောင်း ဖော်ပြပါ..."
                          className={TEXTAREA_BASE_CLASS}
                        />
                        <p className={FIELD_SUBTEXT_CLASS}>
                          နေရာအကြောင်း အသေးစိတ်အချက်အလက်များ
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* Location Coordinates Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-pink-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                      Location Coordinates
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-300">
                          Interactive Map Picker
                        </span>
                        <span className="text-xs text-slate-400">
                          Click to set coordinates
                        </span>
                      </div>
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Click on the map to select the exact location. The
                        coordinates will be automatically captured.
                      </p>
                      <div className="overflow-hidden rounded-lg border border-white/20 shadow-xl">
                        <LocationMapPicker
                          value={{
                            lon: locationForm.lon,
                            lat: locationForm.lat,
                          }}
                          cityCenter={selectedCityCenter}
                          disabled={isLocationMapDisabled}
                          onChange={(coords) => {
                            setLocationForm((prev) => ({
                              ...prev,
                              lon: coords.lon,
                              lat: coords.lat,
                            }));
                          }}
                        />
                      </div>
                      {locationForm.lon && locationForm.lat && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                          <p className="text-sm font-medium text-emerald-300">
                            ✓ Coordinates Selected: Lat {locationForm.lat}, Lon{" "}
                            {locationForm.lon}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Media Upload Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-pink-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Media Upload
                    </h4>
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>
                        Images (Multiple)
                      </span>
                      <input
                        key={locationFileInputKey}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          setLocationForm((prev) => ({
                            ...prev,
                            image_files: event.target.files
                              ? Array.from(event.target.files)
                              : [],
                          }))
                        }
                        className={`${INPUT_BASE_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-gradient-to-r file:from-emerald-500 file:via-cyan-500 file:to-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110`}
                      />
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Upload representative images of this location. Multiple
                        files are supported.
                      </p>
                    </label>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                    {locationForm.id ? (
                      <button
                        type="button"
                        onClick={() => setLocationForm(initialLocationForm)}
                        className={BUTTON_SECONDARY_CLASS}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Discard Changes
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className={BUTTON_PRIMARY_CLASS}
                      disabled={isLocationSubmitting}
                    >
                      {isLocationSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {locationForm.id ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={
                                locationForm.id
                                  ? "M5 13l4 4L19 7"
                                  : "M12 4v16m8-8H4"
                              }
                            />
                          </svg>
                          {locationForm.id
                            ? "Update Location"
                            : "Create Location"}
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Location Table */}
                <LocationTable
                  locations={myLocationsForTable as any}
                  cityLookup={cityLabelById}
                  categoryGroups={baseLocationTypeGroups}
                  onEdit={handleLocationEdit as any}
                  onDelete={handleLocationDelete}
                />
              </section>
            ) : null}

            {activePanel === "roads" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2">
                  <h2 className={SECTION_HEADING_CLASS}>Roads</h2>
                  <p className={SECTION_DESCRIPTION_CLASS}>
                    Create and manage road network segments.
                  </p>
                </div>

                {/* Road Form */}
                <form onSubmit={handleRoadSubmit} className={FORM_CARD_CLASS}>
                  {/* Form Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30">
                        <svg
                          className="h-5 w-5 text-orange-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {roadForm.id ? "Edit Road" : "Create New Road"}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {roadForm.id
                            ? "Update road details and connections"
                            : "Define a new road segment"}
                        </p>
                      </div>
                    </div>
                    {roadForm.id ? (
                      <button
                        type="button"
                        onClick={() => setRoadForm(initialRoadForm)}
                        className={BUTTON_SECONDARY_CLASS}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Cancel
                      </button>
                    ) : null}
                  </div>

                  {/* Basic Information Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-orange-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Basic Information
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>City *</span>
                        <select
                          required
                          value={roadForm.city_id}
                          onChange={(event) =>
                            setRoadForm((prev) => ({
                              ...prev,
                              city_id: event.target.value,
                            }))
                          }
                          className={SELECT_BASE_CLASS}
                        >
                          <option value="">Select a city</option>
                          {cities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name_en || city.name_mm || city.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>Road Type</span>
                        <select
                          value={roadForm.road_type}
                          onChange={(event) =>
                            setRoadForm((prev) => ({
                              ...prev,
                              road_type: event.target.value,
                            }))
                          }
                          className={SELECT_BASE_CLASS}
                        >
                          <option value="">Select a road type</option>
                          {ROAD_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {humanizeKey(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>English Name</span>
                        <input
                          type="text"
                          placeholder="Enter road name in English"
                          value={roadForm.name_mm}
                          onChange={(event) =>
                            setRoadForm((prev) => ({
                              ...prev,
                              name_mm: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>Burmese Name</span>
                        <input
                          type="text"
                          placeholder="လမ်းအမည် (ဗမာ)"
                          value={roadForm.name_en}
                          onChange={(event) =>
                            setRoadForm((prev) => ({
                              ...prev,
                              name_en: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
                      <input
                        type="checkbox"
                        checked={roadForm.is_oneway}
                        onChange={(event) =>
                          setRoadForm((prev) => ({
                            ...prev,
                            is_oneway: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border border-white/20 text-orange-400 accent-orange-400"
                      />
                      <span className="text-slate-200">One-way road</span>
                    </label>
                  </div>

                  {/* Intersection Selection Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-orange-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Intersection Selection
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-300">
                          Interactive Map Picker
                        </span>
                        <span className="text-xs text-slate-400">
                          Select at least 2 intersections
                        </span>
                      </div>
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Choose intersections within the selected city. Click a
                        marker to toggle selection; road geometry is generated
                        automatically.
                      </p>
                      <RoadIntersectionMap
                        intersections={cityIntersections
                          .map((location) => {
                            const { lon, lat } = extractPointFromWkt(
                              location.geometry
                            );
                            return {
                              id: location.id,
                              name:
                                location.name_en ||
                                location.name_mm ||
                                location.id,
                              lon: Number(lon),
                              lat: Number(lat),
                            };
                          })
                          .filter(
                            (point) =>
                              Number.isFinite(point.lon) &&
                              Number.isFinite(point.lat)
                          )}
                        selectedIds={roadForm.intersection_ids}
                        onChange={(nextIds) =>
                          setRoadForm((prev) => ({
                            ...prev,
                            intersection_ids: nextIds,
                          }))
                        }
                        existingRoads={cityRoadPolylines}
                        cityCenter={selectedRoadCityCenter}
                        disabled={
                          !roadForm.city_id || cityIntersections.length === 0
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedIntersections.length ? (
                        selectedIntersections.map((location, index) => (
                          <span
                            key={location.id}
                            className="inline-flex items-center gap-2 rounded-full border border-orange-300/40 bg-orange-400/10 px-3 py-1 text-xs text-orange-200"
                          >
                            <span className="font-medium">{index + 1}.</span>
                            <span>
                              {location.name_en ||
                                location.name_mm ||
                                location.id}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setRoadForm((prev) => ({
                                  ...prev,
                                  intersection_ids:
                                    prev.intersection_ids.filter(
                                      (intersectionId) =>
                                        intersectionId !== location.id
                                    ),
                                }))
                              }
                              className="rounded-full border border-orange-300/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-200 transition hover:border-orange-200 hover:text-orange-50"
                            >
                              Remove
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-dashed border-white/15 px-3 py-1 text-xs text-slate-400">
                          No intersections selected yet.
                        </span>
                      )}
                      {selectedIntersections.length ? (
                        <button
                          type="button"
                          onClick={() =>
                            setRoadForm((prev) => ({
                              ...prev,
                              intersection_ids: [],
                              coordinates: "",
                            }))
                          }
                          className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-orange-300/40 hover:bg-orange-400/10 hover:text-white"
                        >
                          Clear selections
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Road Geometry Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-orange-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                      Road Geometry
                    </h4>
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>
                        Coordinates (lon,lat per line or comma separated pairs)
                      </span>
                      <textarea
                        required={roadForm.intersection_ids.length < 2}
                        value={roadForm.coordinates}
                        onChange={(event) =>
                          setRoadForm((prev) => ({
                            ...prev,
                            coordinates: event.target.value,
                          }))
                        }
                        readOnly={roadForm.intersection_ids.length >= 2}
                        placeholder="96.195132,16.871311\n96.195845,16.872045"
                        className={`${TEXTAREA_BASE_CLASS} h-28 ${
                          roadForm.intersection_ids.length >= 2
                            ? "bg-slate-900/40"
                            : ""
                        }`}
                      />
                      <p className={FIELD_SUBTEXT_CLASS}>
                        {roadForm.intersection_ids.length >= 2
                          ? "Coordinates are auto-generated from the selected intersections. Remove an intersection to edit manually."
                          : "Provide coordinates manually if intersections are unavailable."}
                      </p>
                    </label>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                    {roadForm.id ? (
                      <button
                        type="button"
                        onClick={() => setRoadForm(initialRoadForm)}
                        className={BUTTON_SECONDARY_CLASS}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Discard Changes
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className={BUTTON_PRIMARY_CLASS}
                      disabled={isRoadSubmitting}
                    >
                      {isRoadSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {roadForm.id ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={
                                roadForm.id
                                  ? "M5 13l4 4L19 7"
                                  : "M12 4v16m8-8H4"
                              }
                            />
                          </svg>
                          {roadForm.id ? "Update Road" : "Create Road"}
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Road Table */}
                <RoadTable
                  roads={myRoadsForTable as any}
                  cityLookup={cityLabelById}
                  roadTypeOptions={ROAD_TYPE_OPTIONS}
                  onEdit={handleRoadEdit as any}
                  onDelete={handleRoadDelete}
                />
              </section>
            ) : null}

            {/* Inactive Cities Panel */}
            {activePanel === "inactive-cities" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>Inactive Cities</h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      View your cities that have been marked as inactive
                      (is_active = false). These cities are hidden from public
                      view.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {myInactiveCities.length} inactive
                    </span>
                  </div>
                </div>

                {myInactiveCitiesForTable.length === 0 ? (
                  <div className={`${FORM_CARD_CLASS} text-center`}>
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
                        <svg
                          className="h-8 w-8 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          No Inactive Cities
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          All your cities are currently active.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <CityTable
                    cities={myInactiveCitiesForTable as any}
                    onEdit={handleCityEdit as any}
                    onDelete={handleCityDelete}
                  />
                )}
              </section>
            ) : null}

            {/* Inactive City Details Panel */}
            {activePanel === "inactive-city-details" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>
                      Inactive City Details
                    </h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      View your city detail sections that have been marked as
                      inactive. These details are hidden from public view.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {myInactiveCityDetails.length} inactive
                    </span>
                  </div>
                </div>

                {myInactiveCityDetailsForTable.length === 0 ? (
                  <div className={`${FORM_CARD_CLASS} text-center`}>
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
                        <svg
                          className="h-8 w-8 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          No Inactive City Details
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          All your city details are currently active.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <CityDetailTable
                    cityDetails={myInactiveCityDetailsForTable as any}
                    cityLookup={cityLabelById}
                    onEdit={handleCityDetailEdit as any}
                    onDelete={handleCityDetailDelete}
                  />
                )}
              </section>
            ) : null}

            {/* Inactive Locations Panel */}
            {activePanel === "inactive-locations" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>
                      Inactive Locations
                    </h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      View your locations that have been marked as inactive.
                      These locations are hidden from public view.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {myInactiveLocations.length} inactive
                    </span>
                  </div>
                </div>

                {myInactiveLocationsForTable.length === 0 ? (
                  <div className={`${FORM_CARD_CLASS} text-center`}>
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
                        <svg
                          className="h-8 w-8 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          No Inactive Locations
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          All your locations are currently active.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <LocationTable
                    locations={myInactiveLocationsForTable as any}
                    cityLookup={cityLabelById}
                    onEdit={handleLocationEdit as any}
                    onDelete={handleLocationDelete}
                    categoryGroups={baseLocationTypeGroups}
                  />
                )}
              </section>
            ) : null}

            {/* Inactive Roads Panel */}
            {activePanel === "inactive-roads" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>Inactive Roads</h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      View your roads that have been marked as inactive. These
                      roads are hidden from public view.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {myInactiveRoads.length} inactive
                    </span>
                  </div>
                </div>

                {myInactiveRoadsForTable.length === 0 ? (
                  <div className={`${FORM_CARD_CLASS} text-center`}>
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
                        <svg
                          className="h-8 w-8 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          No Inactive Roads
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          All your roads are currently active.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <RoadTable
                    roads={myInactiveRoadsForTable as any}
                    cityLookup={cityLabelById}
                    roadTypeOptions={ROAD_TYPE_OPTIONS}
                    onEdit={handleRoadEdit as any}
                    onDelete={handleRoadDelete}
                  />
                )}
              </section>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
