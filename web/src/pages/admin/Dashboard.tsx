import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { LatLngTuple } from "leaflet";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import Sidebar from "@/components/admin/Sidebar";
import LocationMapPicker from "@/components/location-map-picker";
import CityTable from "@/components/admin/city-table";
import CityDetailTable from "@/components/admin/city-detail-table";
import LocationTable from "@/components/admin/location-table";
import RoadTable from "@/components/admin/road-table";
import UserTable from "@/components/admin/user-table";
import RoadIntersectionMap from "@/components/road-intersection-map";
import { InactiveContentMapViewer } from "@/components/admin/inactive-content-map-viewer";
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
  is_active?: boolean;
};

type AdminLocation = {
  id: string;
  city_id: string | null;
  user_id: string | null;
  name_mm: string | null;
  name_en: string | null;
  address_mm: string | null;
  address_en: string | null;
  description_mm: string | null;
  description_en: string | null;
  image_urls: string[] | string | null;
  location_type: string | null;
  geometry: string | null;
  is_active?: boolean;
};

type AdminRoad = {
  id: string;
  city_id: string | null;
  user_id: string | null;
  name_mm: string | null;
  name_en: string | null;
  road_type: string | null;
  is_oneway: boolean | null;
  length_m: number[] | null;
  geometry: string | null;
  is_active?: boolean;
};

type AdminCityDetail = {
  id: string;
  city_id: string;
  user_id: string | null;
  predefined_title: string;
  subtitle_mm: string | null;
  subtitle_en: string | null;
  body_mm: string | null;
  body_en: string | null;
  image_urls: string[] | string | null;
  created_at: string | null;
  updated_at: string | null;
  is_active?: boolean;
};

type AdminUser = {
  id: string;
  username: string | null;
  email: string | null;
  user_type: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  last_login: string | null;
};

type AdminCollaborator = {
  id: string;
  username: string | null;
  email: string | null;
  created_at: string | null;
  last_login: string | null;
};

type AdminCollaboratorRequest = {
  id: string;
  user_id: string;
  username: string;
  email: string;
  organization: string;
  position: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_notes?: string;
  created_at: string;
  updated_at: string;
};

type StoredUser = {
  id?: unknown;
  user_id?: unknown;
  userId?: unknown;
  user_type?: unknown;
  role?: unknown;
  roles?: unknown;
  is_admin?: unknown;
};

type PanelKey =
  | "dashboard"
  | "cities"
  | "city-details"
  | "locations"
  | "roads"
  | "users"
  | "collaborators"
  | "collaborator-requests"
  | "inactive-cities"
  | "inactive-city-details"
  | "inactive-locations"
  | "inactive-roads";

type DashboardResponse = {
  cities: AdminCity[];
  city_details?: AdminCityDetail[];
  locations: AdminLocation[];
  roads: AdminRoad[];
  users?: AdminUser[];
  collaborators?: AdminCollaborator[];
  collaborator_requests?: AdminCollaboratorRequest[];
};

type ApiEnvelope<T> = {
  is_success: boolean;
  data?: T;
  msg?: string;
  error?: string;
};

type CityFormState = {
  id: string | null;
  burmese_name: string;
  english_name: string;
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
  burmese_name: string;
  english_name: string;
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
  burmese_name: string;
  english_name: string;
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
  burmese_name: "",
  english_name: "",
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
  burmese_name: "",
  english_name: "",
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
  burmese_name: "",
  english_name: "",
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
  "border border-slate-200 bg-white/95 backdrop-blur-sm shadow-xl shadow-emerald-100/50";
const FORM_CARD_CLASS = `space-y-6 rounded-2xl ${CARD_BORDER_CLASS} p-8`;
const FORM_SECTION_CLASS =
  "space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6";
const PANEL_PILL_CLASS =
  "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm";
const FIELD_LABEL_CLASS = "block text-sm font-semibold text-slate-700";
const FIELD_SUBTEXT_CLASS = "mt-1.5 text-xs text-slate-500 leading-relaxed";
const INPUT_BASE_CLASS =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-400/70 focus:outline-none focus:ring-4 focus:ring-emerald-200 hover:border-slate-300";
const TEXTAREA_BASE_CLASS =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-400/70 focus:outline-none focus:ring-4 focus:ring-emerald-200 hover:border-slate-300 resize-none min-h-[100px]";
const SELECT_BASE_CLASS =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-emerald-400/70 focus:outline-none focus:ring-4 focus:ring-emerald-200 hover:border-slate-300 cursor-pointer";
const SECTION_HEADING_CLASS =
  "text-3xl font-bold text-slate-900 tracking-tight";
const SECTION_DESCRIPTION_CLASS = "text-sm text-slate-500 leading-relaxed";
const SUBSECTION_HEADING_CLASS =
  "text-base font-bold text-slate-800 flex items-center gap-2";
const BUTTON_PRIMARY_CLASS =
  "inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";
const BUTTON_SECONDARY_CLASS =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed";

function formatImageValue(value: AdminCity["image_urls"]): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(", ");
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.join(", ");
    }
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

function formatLineStringForEditor(wkt: string | null | undefined) {
  if (!wkt) return "";
  const match = /LINESTRING\s*\(([^)]+)\)/i.exec(wkt);
  if (!match) return "";
  return match[1]
    .split(",")
    .map((segment) => segment.trim())
    .join("\n");
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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch (error) {
    console.warn("Failed to decode JWT", error);
    return null;
  }
}

function resolveUserId(
  storedUser: unknown,
  token: string | null
): string | null {
  if (storedUser && typeof storedUser === "object") {
    const candidate =
      (storedUser as { id?: unknown }).id ??
      (storedUser as { user_id?: unknown }).user_id ??
      (storedUser as { userId?: unknown }).userId;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  if (token) {
    const payload = decodeJwtPayload(token);
    const candidate =
      (payload?.sub as string | undefined) ??
      (payload?.user_id as string | undefined) ??
      (payload?.identity as string | undefined);
    if (candidate && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [cityDetails, setCityDetails] = useState<AdminCityDetail[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [roads, setRoads] = useState<AdminRoad[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [collaborators, setCollaborators] = useState<AdminCollaborator[]>([]);
  const [collaboratorRequests, setCollaboratorRequests] = useState<
    AdminCollaboratorRequest[]
  >([]);
  const [activePanel, setActivePanel] = useState<PanelKey>("dashboard");
  const [cityForm, setCityForm] = useState<CityFormState>(initialCityForm);
  const [cityDetailForm, setCityDetailForm] = useState<CityDetailFormState>(
    initialCityDetailForm
  );
  const [locationForm, setLocationForm] =
    useState<LocationFormState>(initialLocationForm);
  const [roadForm, setRoadForm] = useState<RoadFormState>(initialRoadForm);
  const [cityFileInputKey, setCityFileInputKey] = useState<number>(0);
  const [cityDetailFileInputKey, setCityDetailFileInputKey] =
    useState<number>(0);
  const [locationFileInputKey, setLocationFileInputKey] = useState<number>(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Image preview URLs
  const [cityImagePreviews, setCityImagePreviews] = useState<string[]>([]);
  const [cityDetailImagePreviews, setCityDetailImagePreviews] = useState<
    string[]
  >([]);
  const [locationImagePreviews, setLocationImagePreviews] = useState<string[]>(
    []
  );

  // Loading states for form submissions
  const [isCitySubmitting, setIsCitySubmitting] = useState(false);
  const [isCityDetailSubmitting, setIsCityDetailSubmitting] = useState(false);
  const [isLocationSubmitting, setIsLocationSubmitting] = useState(false);
  const [isRoadSubmitting, setIsRoadSubmitting] = useState(false);

  // Loading states for collaborator actions
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(
    null
  );
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(
    null
  );
  const [revokingCollaboratorId, setRevokingCollaboratorId] = useState<
    string | null
  >(null);

  // Map viewer state for inactive content
  const [mapViewerContent, setMapViewerContent] = useState<{
    data: AdminCity | AdminLocation | AdminRoad;
    type: "city" | "location" | "road";
  } | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedUserRaw = localStorage.getItem("user");

    if (!storedToken || !storedUserRaw) {
      toast.error(
        "Please sign in as an administrator to access the dashboard."
      );
      navigate("/sign-in", { replace: true });
      return;
    }

    let storedUser: StoredUser | null = null;
    try {
      storedUser = JSON.parse(storedUserRaw) as StoredUser;
      const normalizedType = String(
        (storedUser?.user_type ?? storedUser?.role ?? "") as string
      ).toLowerCase();
      const hasAdminRole = Array.isArray(storedUser?.roles)
        ? storedUser.roles.some(
            (role: unknown) =>
              typeof role === "string" && role.toLowerCase() === "admin"
          )
        : false;
      const isAdmin =
        storedUser?.is_admin === true ||
        normalizedType === "admin" ||
        hasAdminRole;

      if (!isAdmin) {
        toast.error("Admin access required.");
        navigate("/", { replace: true });
        return;
      }
    } catch (error) {
      console.error("Failed to parse stored user", error);
      toast.error("Session data is corrupted. Please sign in again.");
      navigate("/sign-in", { replace: true });
      return;
    }

    setCurrentUserId(resolveUserId(storedUser, storedToken));
    setToken(storedToken);
  }, [navigate]);

  useEffect(() => {
    if (!token) return;

    async function loadDashboard(currentToken: string) {
      try {
        setLoading(true);
        const { data } = await requestWithAuth<DashboardResponse>(
          currentToken,
          "/admin/dashboard"
        );
        if (data) {
          setCities(data.cities ?? []);
          setCityDetails(data.city_details ?? []);
          setLocations(data.locations ?? []);
          setRoads(data.roads ?? []);
          setUsers(data.users ?? []);
          setCollaborators(data.collaborators ?? []);
          setCollaboratorRequests(data.collaborator_requests ?? []);
        }
      } catch (error) {
        console.error("Failed to load admin data", error);
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

  const locationTypeGroups = useMemo(() => {
    const groups = [...baseLocationTypeGroups];

    const knownValues = new Set<string>();
    groups.forEach((group) => {
      group.options.forEach((option) => knownValues.add(option.value));
    });

    if (
      locationForm.location_type &&
      !knownValues.has(locationForm.location_type)
    ) {
      groups.push({
        key: "existing",
        label: "Existing Value",
        options: [
          {
            value: locationForm.location_type,
            label: humanizeKey(locationForm.location_type),
          },
        ],
      });
    }

    return groups;
  }, [baseLocationTypeGroups, locationForm.location_type]);

  const cityLabelById = useMemo(() => {
    const lookup: Record<string, string> = {};
    cities.forEach((city) => {
      const label = city.name_en || city.name_mm || city.id;
      lookup[city.id] = label;
    });
    return lookup;
  }, [cities]);

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

  // Filter inactive data (is_active = false) - admin sees ALL inactive data
  const inactiveCities = useMemo(() => {
    return cities.filter((c) => c.is_active === false);
  }, [cities]);

  const inactiveCityDetails = useMemo(() => {
    return cityDetails.filter((cd) => cd.is_active === false);
  }, [cityDetails]);

  const inactiveLocations = useMemo(() => {
    return locations.filter((l) => l.is_active === false);
  }, [locations]);

  const inactiveRoads = useMemo(() => {
    return roads.filter((r) => r.is_active === false);
  }, [roads]);

  // Create a lookup map for users by ID
  const userLookupById = useMemo(() => {
    const lookup: Record<string, AdminUser | AdminCollaborator> = {};
    users.forEach((user) => {
      lookup[user.id] = user;
    });
    collaborators.forEach((collab) => {
      lookup[collab.id] = collab;
    });
    return lookup;
  }, [users, collaborators]);

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
        category: "User Management",
        items: [
          { id: "users" as const, label: "Users", count: users.length },
          {
            id: "collaborators" as const,
            label: "Collaborators",
            count: collaborators.length,
          },
          {
            id: "collaborator-requests" as const,
            label: "Collaborator Requests",
            count: collaboratorRequests.length,
          },
        ],
      },
      {
        category: "Inactive Content",
        items: [
          {
            id: "inactive-cities" as const,
            label: "Inactive Cities",
            count: inactiveCities.length,
          },
          {
            id: "inactive-city-details" as const,
            label: "Inactive City Details",
            count: inactiveCityDetails.length,
          },
          {
            id: "inactive-locations" as const,
            label: "Inactive Locations",
            count: inactiveLocations.length,
          },
          {
            id: "inactive-roads" as const,
            label: "Inactive Roads",
            count: inactiveRoads.length,
          },
        ],
      },
    ],
    [
      cities.length,
      cityDetails.length,
      locations.length,
      roads.length,
      users.length,
      collaborators.length,
      collaboratorRequests.length,
      inactiveCities.length,
      inactiveCityDetails.length,
      inactiveLocations.length,
      inactiveRoads.length,
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

  const intersectionCoordinateLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    intersectionLocations.forEach((location) => {
      const { lon, lat } = extractPointFromWkt(location.geometry);
      const lonNum = Number(lon);
      const latNum = Number(lat);
      if (Number.isFinite(lonNum) && Number.isFinite(latNum)) {
        const key = `${lonNum.toFixed(6)},${latNum.toFixed(6)}`;
        lookup[key] = location.id;
      }
    });
    return lookup;
  }, [intersectionLocations]);

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
        positions: LatLngTuple[];
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
          ([lon, lat]) => [lat, lon] as LatLngTuple
        );
        const segmentLengths = computeSegmentLengths(coordinates);
        const totalLength = segmentLengths.reduce(
          (sum: number, segment: number) => sum + segment,
          0
        );

        return {
          id: road.id,
          name: road.name_en || road.name_mm || road.road_type || road.id,
          positions,
          lengthMeters: totalLength,
        };
      })
      .filter(
        (
          road
        ): road is {
          id: string;
          name: string;
          positions: LatLngTuple[];
          lengthMeters: number;
        } => Boolean(road)
      );
  }, [roadForm.city_id, roads]);

  const selectedIntersections = useMemo(() => {
    return roadForm.intersection_ids
      .map((id) => intersectionLookupById[id])
      .filter((location): location is AdminLocation => Boolean(location));
  }, [intersectionLookupById, roadForm.intersection_ids]);

  const derivedIntersectionCoordinateText = useMemo(() => {
    if (roadForm.intersection_ids.length < 2) {
      return "";
    }

    const parts: string[] = [];
    for (const id of roadForm.intersection_ids) {
      const location = intersectionLookupById[id];
      if (!location) {
        return "";
      }
      const { lon, lat } = extractPointFromWkt(location.geometry);
      const lonNum = Number(lon);
      const latNum = Number(lat);
      if (!Number.isFinite(lonNum) || !Number.isFinite(latNum)) {
        return "";
      }
      parts.push(`${lonNum}, ${latNum}`);
    }

    return parts.join("\n");
  }, [intersectionLookupById, roadForm.intersection_ids]);

  useEffect(() => {
    if (!derivedIntersectionCoordinateText) {
      return;
    }

    setRoadForm((prev) => {
      if (prev.intersection_ids.length < 2) {
        return prev;
      }
      if (prev.coordinates.trim() === derivedIntersectionCoordinateText) {
        return prev;
      }
      return {
        ...prev,
        coordinates: derivedIntersectionCoordinateText,
      };
    });
  }, [derivedIntersectionCoordinateText]);

  useEffect(() => {
    if (roadForm.intersection_ids.length >= 2) {
      return;
    }

    if (!roadForm.coordinates) {
      return;
    }

    setRoadForm((prev) => {
      if (prev.intersection_ids.length >= 2 || !prev.coordinates) {
        return prev;
      }
      return {
        ...prev,
        coordinates: "",
      };
    });
  }, [roadForm.intersection_ids.length, roadForm.coordinates]);

  const toNullable = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const confirmAction = (message: string) =>
    typeof window === "undefined" ? true : window.confirm(message);

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
      const parsed = JSON.parse(storedUserRaw) as StoredUser;
      const resolved = resolveUserId(parsed, storedToken);
      if (resolved) {
        setCurrentUserId(resolved);
      }
      return resolved;
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

  // Helper functions for image preview management
  const createImagePreview = (file: File): string => {
    return URL.createObjectURL(file);
  };

  const revokeImagePreviews = (previews: string[]) => {
    previews.forEach((url) => {
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
  };

  const getExistingImageUrls = (
    imageUrls: string | string[] | null
  ): string[] => {
    if (!imageUrls) return [];
    if (Array.isArray(imageUrls)) return imageUrls;
    try {
      const parsed = JSON.parse(imageUrls);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // If not JSON, try splitting by comma
      if (typeof imageUrls === "string" && imageUrls.trim()) {
        return imageUrls
          .split(",")
          .map((url) => url.trim())
          .filter(Boolean);
      }
    }
    return [];
  };

  const formatImageUrl = (url: string): string => {
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("blob:")
    ) {
      return url;
    }
    // Handle relative paths like /uploads/...
    return `${API_BASE_URL}${url.startsWith("/") ? url : "/" + url}`;
  };

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
      toast.error("Unable to determine the current administrator account.");
      return;
    }

    const formData = new FormData();
    formData.append("name_en", cityForm.english_name.trim());
    formData.append("name_mm", cityForm.burmese_name);
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
        cityId ? `/admin/cities/${cityId}` : "/admin/cities",
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

        // Clean up preview URLs
        revokeImagePreviews(cityImagePreviews);
        setCityImagePreviews([]);

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

  function handleCityEdit(city: AdminCity) {
    const { lon, lat } = extractPointFromWkt(city.geometry);

    // Clear any existing preview URLs
    revokeImagePreviews(cityImagePreviews);
    setCityImagePreviews([]);

    setCityForm({
      id: city.id,
      burmese_name: city.name_mm ?? "",
      english_name: city.name_en ?? "",
      address_en: city.address_en ?? "",
      address_mm: city.address_mm ?? "",
      description_en: city.description_en ?? "",
      description_mm: city.description_mm ?? "",
      image_urls: formatImageValue(city.image_urls),
      image_files: [],
      lon,
      lat,
    });
    setCityFileInputKey((prev: number) => prev + 1);
    scrollToTop();
  }

  async function handleCityDelete(cityId: string) {
    const authToken = token;
    if (!authToken) return;
    if (!confirmAction("Are you sure you want to delete this city?")) {
      return;
    }

    try {
      await requestWithAuth<null>(authToken, `/admin/cities/${cityId}`, {
        method: "DELETE",
      });
      setCities((prev) => prev.filter((city) => city.id !== cityId));
      setLocations((prev) =>
        prev.filter((location) => location.city_id !== cityId)
      );
      setRoads((prev) => prev.filter((road) => road.city_id !== cityId));
      if (cityForm.id === cityId) {
        setCityForm(initialCityForm);
        setCityFileInputKey((prev: number) => prev + 1);
      }
      toast.success("City deleted.");
    } catch (err) {
      console.error("Failed to delete city", err);
      toast.error(err instanceof Error ? err.message : "Unable to delete city");
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
      toast.error("Unable to determine the current administrator account.");
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
          ? `/admin/city-details/${cityDetailId}`
          : "/admin/city-details",
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

        // Clean up preview URLs
        revokeImagePreviews(cityDetailImagePreviews);
        setCityDetailImagePreviews([]);

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

  function handleCityDetailEdit(detail: AdminCityDetail) {
    // Clear any existing preview URLs
    revokeImagePreviews(cityDetailImagePreviews);
    setCityDetailImagePreviews([]);

    setCityDetailForm({
      id: detail.id,
      city_id: detail.city_id,
      predefined_title: detail.predefined_title,
      subtitle_burmese: detail.subtitle_mm ?? "",
      subtitle_english: detail.subtitle_en ?? "",
      body_burmese: detail.body_mm ?? "",
      body_english: detail.body_en ?? "",
      image_urls: formatImageValue(detail.image_urls),
      image_files: [],
    });
    setCityDetailFileInputKey((prev: number) => prev + 1);
    scrollToTop();
  }

  async function handleCityDetailDelete(detailId: string) {
    const authToken = token;
    if (!authToken) return;
    if (!confirmAction("Are you sure you want to delete this city detail?")) {
      return;
    }

    try {
      await requestWithAuth<null>(
        authToken,
        `/admin/city-details/${detailId}`,
        {
          method: "DELETE",
        }
      );
      setCityDetails((prev) => prev.filter((detail) => detail.id !== detailId));
      if (cityDetailForm.id === detailId) {
        setCityDetailForm(initialCityDetailForm);
        setCityDetailFileInputKey((prev: number) => prev + 1);
      }
      toast.success("City detail deleted.");
    } catch (err) {
      console.error("Failed to delete city detail", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to delete city detail"
      );
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
      toast.error("Unable to determine the current administrator account.");
      return;
    }

    const formData = new FormData();
    formData.append("city_id", locationForm.city_id);
    formData.append("user_id", activeUserId);
    formData.append("name_mm", locationForm.burmese_name);
    formData.append("name_en", locationForm.english_name);
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
        locationId ? `/admin/locations/${locationId}` : "/admin/locations",
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

        // Clean up preview URLs
        revokeImagePreviews(locationImagePreviews);
        setLocationImagePreviews([]);

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

  function handleLocationEdit(location: AdminLocation) {
    const { lon, lat } = extractPointFromWkt(location.geometry);

    // Clear any existing preview URLs
    revokeImagePreviews(locationImagePreviews);
    setLocationImagePreviews([]);

    setLocationForm({
      id: location.id,
      city_id: location.city_id ?? "",
      burmese_name: location.name_mm ?? "",
      english_name: location.name_en ?? "",
      address_en: location.address_en ?? "",
      address_mm: location.address_mm ?? "",
      description_en: location.description_en ?? "",
      description_mm: location.description_mm ?? "",
      location_type: location.location_type ?? "",
      image_urls: formatImageValue(location.image_urls),
      image_files: [],
      lon,
      lat,
    });
    setLocationFileInputKey((prev: number) => prev + 1);
    scrollToTop();
  }

  async function handleLocationDelete(locationId: string) {
    const authToken = token;
    if (!authToken) return;
    if (!confirmAction("Are you sure you want to delete this location?")) {
      return;
    }

    try {
      await requestWithAuth<null>(authToken, `/admin/locations/${locationId}`, {
        method: "DELETE",
      });
      setLocations((prev) =>
        prev.filter((location) => location.id !== locationId)
      );
      if (locationForm.id === locationId) {
        setLocationForm(initialLocationForm);
        setLocationFileInputKey((prev: number) => prev + 1);
      }
      toast.success("Location deleted.");
    } catch (err) {
      console.error("Failed to delete location", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to delete location"
      );
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
      name_mm: toNullable(roadForm.burmese_name),
      name_en: toNullable(roadForm.english_name),
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
        roadId ? `/admin/roads/${roadId}` : "/admin/roads",
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

  function handleRoadEdit(road: AdminRoad) {
    const coordinateText = formatLineStringForEditor(road.geometry) || "";
    const coordinatePairs = parseCoordinateText(coordinateText);
    const resolvedIntersectionIds: string[] = [];
    let allMatched = coordinatePairs.length > 0;

    coordinatePairs.forEach(([lon, lat]) => {
      const key = `${Number(lon).toFixed(6)},${Number(lat).toFixed(6)}`;
      const intersectionId = intersectionCoordinateLookup[key];
      if (intersectionId) {
        resolvedIntersectionIds.push(intersectionId);
      } else {
        allMatched = false;
      }
    });

    setRoadForm({
      id: road.id,
      city_id: road.city_id ?? "",
      user_id: road.user_id ?? "",
      burmese_name: road.name_mm ?? "",
      english_name: road.name_en ?? "",
      road_type: road.road_type ?? "",
      is_oneway: Boolean(road.is_oneway),
      intersection_ids: allMatched ? resolvedIntersectionIds : [],
      coordinates: coordinateText,
    });
    scrollToTop();
  }

  async function handleRoadDelete(roadId: string) {
    const authToken = token;
    if (!authToken) return;
    if (!confirmAction("Are you sure you want to delete this road?")) {
      return;
    }

    try {
      await requestWithAuth<null>(authToken, `/admin/roads/${roadId}`, {
        method: "DELETE",
      });
      setRoads((prev) => prev.filter((road) => road.id !== roadId));
      if (roadForm.id === roadId) {
        setRoadForm(initialRoadForm);
      }
      toast.success("Road deleted.");
    } catch (err) {
      console.error("Failed to delete road", err);
      toast.error(err instanceof Error ? err.message : "Unable to delete road");
    }
  }

  async function handleApproveRequest(requestId: string) {
    const authToken = token;
    if (!authToken) return;

    if (
      !confirmAction(
        "Are you sure you want to approve this collaborator request?"
      )
    ) {
      return;
    }

    setApprovingRequestId(requestId);
    try {
      await requestWithAuth<AdminCollaboratorRequest>(
        authToken,
        `/admin/collaborator-requests/${requestId}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: "approved" }),
        }
      );

      // Reload dashboard data to refresh collaborators and requests
      const { data } = await requestWithAuth<DashboardResponse>(
        authToken,
        "/admin/dashboard"
      );
      if (data) {
        setCollaboratorRequests(data.collaborator_requests ?? []);
        setCollaborators(data.collaborators ?? []);
      }

      toast.success("Collaborator request approved successfully.");
    } catch (err) {
      console.error("Failed to approve request", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to approve request"
      );
    } finally {
      setApprovingRequestId(null);
    }
  }

  async function handleRejectRequest(requestId: string) {
    const authToken = token;
    if (!authToken) return;

    if (
      !confirmAction(
        "Are you sure you want to reject this collaborator request?"
      )
    ) {
      return;
    }

    setRejectingRequestId(requestId);
    try {
      await requestWithAuth<AdminCollaboratorRequest>(
        authToken,
        `/admin/collaborator-requests/${requestId}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: "rejected" }),
        }
      );

      // Update local state
      setCollaboratorRequests((prev) =>
        prev.map((req) =>
          req.id === requestId ? { ...req, status: "rejected" } : req
        )
      );

      toast.success("Collaborator request rejected.");
    } catch (err) {
      console.error("Failed to reject request", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to reject request"
      );
    } finally {
      setRejectingRequestId(null);
    }
  }

  async function handleRevokeCollaborator(userId: string, username: string) {
    const authToken = token;
    if (!authToken) return;

    if (
      !confirmAction(
        `Are you sure you want to revoke collaborator status for ${username}? They will be changed back to a normal user.`
      )
    ) {
      return;
    }

    // Prompt for admin notes (reason for revocation)
    const adminNotes = window.prompt(
      `Please provide a reason for revoking ${username}'s collaborator access:\n\n(This will be sent to the user via email)`
    );

    if (adminNotes === null) {
      // User clicked cancel
      return;
    }

    setRevokingCollaboratorId(userId);
    try {
      await requestWithAuth<null>(authToken, `/admin/collaborators/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          admin_notes: adminNotes.trim(),
        }),
      });

      // Remove from collaborators list
      setCollaborators((prev) => prev.filter((collab) => collab.id !== userId));

      // Reload users to show updated status
      const { data } = await requestWithAuth<DashboardResponse>(
        authToken,
        "/admin/dashboard"
      );
      if (data) {
        setUsers(data.users ?? []);
      }

      toast.success(
        "Collaborator status revoked successfully. Email notification sent."
      );
    } catch (err) {
      console.error("Failed to revoke collaborator status", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Unable to revoke collaborator status"
      );
    } finally {
      setRevokingCollaboratorId(null);
    }
  }

  // Accept inactive content (set is_active = true)
  async function handleAcceptInactiveCity(cityId: string) {
    const authToken = token;
    if (!authToken) return;

    if (!confirmAction("Are you sure you want to activate this city?")) {
      return;
    }

    try {
      const city = cities.find((c) => c.id === cityId);
      if (!city) {
        toast.error("City not found");
        return;
      }

      // Use existing update endpoint with is_active = true
      const formData = new FormData();
      formData.append("name_en", city.name_en || "");
      formData.append("name_mm", city.name_mm || "");
      formData.append("user_id", city.user_id || "");
      formData.append("address_en", city.address_en || "");
      formData.append("address_mm", city.address_mm || "");
      formData.append("description_en", city.description_en || "");
      formData.append("description_mm", city.description_mm || "");
      formData.append(
        "image_urls",
        Array.isArray(city.image_urls)
          ? city.image_urls.join(", ")
          : city.image_urls || ""
      );
      formData.append("is_active", "true");

      if (city.geometry) {
        const { lon, lat } = extractPointFromWkt(city.geometry);
        if (lon && lat) {
          formData.append("lon", lon);
          formData.append("lat", lat);
        }
      }

      const { data } = await requestWithAuth<AdminCity>(
        authToken,
        `/admin/cities/${cityId}`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if (data) {
        setCities((prev) =>
          prev.map((city) => (city.id === data.id ? data : city))
        );
        toast.success("City activated successfully.");
      }
    } catch (err) {
      console.error("Failed to activate city", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to activate city"
      );
    }
  }

  async function handleAcceptInactiveCityDetail(detailId: string) {
    const authToken = token;
    if (!authToken) return;

    if (!confirmAction("Are you sure you want to activate this city detail?")) {
      return;
    }

    try {
      const detail = cityDetails.find((cd) => cd.id === detailId);
      if (!detail) {
        toast.error("City detail not found");
        return;
      }

      const formData = new FormData();
      formData.append("city_id", detail.city_id);
      formData.append("user_id", detail.user_id || "");
      formData.append("predefined_title", detail.predefined_title);
      formData.append("subtitle_en", detail.subtitle_en || "");
      formData.append("subtitle_mm", detail.subtitle_mm || "");
      formData.append("body_en", detail.body_en || "");
      formData.append("body_mm", detail.body_mm || "");
      formData.append(
        "image_urls",
        Array.isArray(detail.image_urls)
          ? detail.image_urls.join(", ")
          : detail.image_urls || ""
      );
      formData.append("is_active", "true");

      const { data } = await requestWithAuth<AdminCityDetail>(
        authToken,
        `/admin/city-details/${detailId}`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if (data) {
        setCityDetails((prev) =>
          prev.map((detail) => (detail.id === data.id ? data : detail))
        );
        toast.success("City detail activated successfully.");
      }
    } catch (err) {
      console.error("Failed to activate city detail", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to activate city detail"
      );
    }
  }

  async function handleAcceptInactiveLocation(locationId: string) {
    const authToken = token;
    if (!authToken) return;

    if (!confirmAction("Are you sure you want to activate this location?")) {
      return;
    }

    try {
      const location = locations.find((l) => l.id === locationId);
      if (!location) {
        toast.error("Location not found");
        return;
      }

      const formData = new FormData();
      formData.append("city_id", location.city_id || "");
      formData.append("user_id", location.user_id || "");
      formData.append("name_mm", location.name_mm || "");
      formData.append("name_en", location.name_en || "");
      formData.append("address_en", location.address_en || "");
      formData.append("address_mm", location.address_mm || "");
      formData.append("description_en", location.description_en || "");
      formData.append("description_mm", location.description_mm || "");
      formData.append("location_type", location.location_type || "");
      formData.append(
        "image_urls",
        Array.isArray(location.image_urls)
          ? location.image_urls.join(", ")
          : location.image_urls || ""
      );
      formData.append("is_active", "true");

      if (location.geometry) {
        const { lon, lat } = extractPointFromWkt(location.geometry);
        if (lon && lat) {
          formData.append("lon", lon);
          formData.append("lat", lat);
        }
      }

      const { data } = await requestWithAuth<AdminLocation>(
        authToken,
        `/admin/locations/${locationId}`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if (data) {
        setLocations((prev) =>
          prev.map((location) => (location.id === data.id ? data : location))
        );
        toast.success("Location activated successfully.");
      }
    } catch (err) {
      console.error("Failed to activate location", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to activate location"
      );
    }
  }

  async function handleAcceptInactiveRoad(roadId: string) {
    const authToken = token;
    if (!authToken) return;

    if (!confirmAction("Are you sure you want to activate this road?")) {
      return;
    }

    try {
      const road = roads.find((r) => r.id === roadId);
      if (!road) {
        toast.error("Road not found");
        return;
      }

      const coordinates = extractLineStringCoordinates(road.geometry);
      const segmentLengths = computeSegmentLengths(coordinates);

      const payload = {
        city_id: road.city_id,
        user_id: road.user_id,
        name_mm: road.name_mm,
        name_en: road.name_en,
        road_type: road.road_type,
        is_oneway: road.is_oneway,
        coordinates: coordinates,
        length_m: segmentLengths,
        is_active: true,
      };

      const { data } = await requestWithAuth<AdminRoad>(
        authToken,
        `/admin/roads/${roadId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      if (data) {
        setRoads((prev) =>
          prev.map((road) => (road.id === data.id ? data : road))
        );
        toast.success("Road activated successfully.");
      }
    } catch (err) {
      console.error("Failed to activate road", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to activate road"
      );
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <div className="relative">
          {/* Animated gradient background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-emerald-200/50 via-cyan-200/50 to-blue-200/50 blur-3xl" />
          </div>

          {/* Loading card */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/95 px-8 py-6 shadow-2xl">
            {/* Spinner */}
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-400" />
              <div className="absolute inset-2 rounded-full bg-white" />
            </div>

            {/* Text */}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800">
                Validating Credentials
              </span>
              <span className="text-xs text-slate-500">Please wait...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex bg-gradient-to-b from-slate-50 via-white to-emerald-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-emerald-50" />
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/60 to-transparent" />
        <div className="absolute -left-1/3 top-32 h-[420px] w-[420px] rounded-full bg-emerald-200/60 blur-3xl" />
        <div className="absolute -right-1/2 bottom-0 h-[520px] w-[520px] rounded-full bg-cyan-200/50 blur-3xl" />
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
                  {/* Animated spinner */}
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-400 border-r-cyan-400" />
                    <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-emerald-200/60 to-cyan-200/60" />
                  </div>

                  {/* Loading text */}
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Loading Dashboard
                    </h3>
                    <p className="text-sm text-slate-600">
                      Fetching your data, please wait...
                    </p>
                  </div>

                  {/* Animated dots */}
                  <div className="flex gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
                  </div>
                </div>
              </div>
            ) : null}

            {activePanel === "dashboard" ? (
              <section className="space-y-6">
                {/* Dashboard Header */}
                <div className="flex flex-col gap-2">
                  <h2 className={SECTION_HEADING_CLASS}>System Overview</h2>
                  <p className={SECTION_DESCRIPTION_CLASS}>
                    Monitor system statistics, activity, and key metrics at a
                    glance.
                  </p>
                </div>

                {/* Statistics Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {/* Cities Card */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">
                          Cities
                        </span>
                        <div className="rounded-lg bg-blue-100 p-2">
                          <svg
                            className="h-5 w-5 text-blue-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-3xl font-bold text-slate-900">
                          {cities.length}
                        </p>
                        <p className="text-xs text-slate-500">
                          Total townships
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Locations Card */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-emerald-200 hover:shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">
                          Locations
                        </span>
                        <div className="rounded-lg bg-emerald-100 p-2">
                          <svg
                            className="h-5 w-5 text-emerald-500"
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
                      <div className="space-y-1">
                        <p className="text-3xl font-bold text-slate-900">
                          {locations.length}
                        </p>
                        <p className="text-xs text-slate-500">
                          Points of interest
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Roads Card */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-purple-200 hover:shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">
                          Roads
                        </span>
                        <div className="rounded-lg bg-purple-100 p-2">
                          <svg
                            className="h-5 w-5 text-purple-500"
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
                      <div className="space-y-1">
                        <p className="text-3xl font-bold text-slate-900">
                          {roads.length}
                        </p>
                        <p className="text-xs text-slate-500">Road segments</p>
                      </div>
                    </div>
                  </div>

                  {/* Users Card */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-cyan-200 hover:shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">
                          Users
                        </span>
                        <div className="rounded-lg bg-cyan-100 p-2">
                          <svg
                            className="h-5 w-5 text-cyan-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-3xl font-bold text-slate-900">
                          {users.length}
                        </p>
                        <p className="text-xs text-slate-500">
                          Registered users
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Overview */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* City Details Overview */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Content Details
                      </h3>
                      <span className={PANEL_PILL_CLASS}>
                        {cityDetails.length} entries
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="text-sm text-slate-600">
                          City Details
                        </span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {cityDetails.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="text-sm text-slate-600">
                          Locations
                        </span>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {locations.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="text-sm text-slate-600">Roads</span>
                        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                          {roads.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* User Management Overview */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        User Management
                      </h3>
                      <span className={PANEL_PILL_CLASS}>
                        {users.length + collaborators.length} total
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="text-sm text-slate-600">
                          Total Users
                        </span>
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                          {users.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="text-sm text-slate-600">
                          Collaborators
                        </span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {collaborators.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="text-sm text-slate-600">
                          Pending Requests
                        </span>
                        <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                          {
                            collaboratorRequests.filter(
                              (req) => req.status === "pending"
                            ).length
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location Types Distribution */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Location Types Distribution
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Breakdown by category
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(LOCATION_CATEGORIES).map(
                      ([category, types]) => {
                        const count = locations.filter(
                          (loc) =>
                            loc.location_type &&
                            types.some((type) =>
                              loc.location_type
                                ?.toLowerCase()
                                .includes(type.toLowerCase())
                            )
                        ).length;

                        return (
                          <div
                            key={category}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                          >
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                              {humanizeKey(category)}
                            </p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">
                              {count}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {types.length} types
                            </p>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Quick Actions
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Navigate to common tasks
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => setActivePanel("cities")}
                      className="group flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-blue-200 hover:bg-blue-50"
                    >
                      <div className="rounded-lg bg-blue-100 p-2 transition-colors group-hover:bg-blue-200">
                        <svg
                          className="h-5 w-5 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Add City</p>
                        <p className="text-xs text-slate-600">
                          Create new township
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePanel("locations")}
                      className="group flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50"
                    >
                      <div className="rounded-lg bg-emerald-100 p-2 transition-colors group-hover:bg-emerald-200">
                        <svg
                          className="h-5 w-5 text-emerald-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          Add Location
                        </p>
                        <p className="text-xs text-slate-600">
                          Create new point
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePanel("collaborator-requests")}
                      className="group flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-yellow-200 hover:bg-yellow-50"
                    >
                      <div className="rounded-lg bg-yellow-100 p-2 transition-colors group-hover:bg-yellow-200">
                        <svg
                          className="h-5 w-5 text-yellow-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          Review Requests
                        </p>
                        <p className="text-xs text-slate-600">
                          {
                            collaboratorRequests.filter(
                              (req) => req.status === "pending"
                            ).length
                          }{" "}
                          pending
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePanel("users")}
                      className="group flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-cyan-200 hover:bg-cyan-50"
                    >
                      <div className="rounded-lg bg-cyan-100 p-2 transition-colors group-hover:bg-cyan-200">
                        <svg
                          className="h-5 w-5 text-cyan-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          Manage Users
                        </p>
                        <p className="text-xs text-slate-600">View all users</p>
                      </div>
                    </button>
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
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={PANEL_PILL_CLASS}>
                      {cities.length} total
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
                        <h3 className="text-lg font-bold text-slate-900">
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
                          value={cityForm.english_name}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              english_name: event.target.value,
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
                          value={cityForm.burmese_name}
                          onChange={(event) =>
                            setCityForm((prev) => ({
                              ...prev,
                              burmese_name: event.target.value,
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
                        onChange={(event) => {
                          const files = event.target.files
                            ? Array.from(event.target.files)
                            : [];
                          setCityForm((prev) => ({
                            ...prev,
                            image_files: files,
                          }));

                          // Create preview URLs for new files
                          const newPreviews = files.map((file) =>
                            createImagePreview(file)
                          );
                          setCityImagePreviews(newPreviews);
                        }}
                        className={`${INPUT_BASE_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-gradient-to-r file:from-emerald-500 file:via-cyan-500 file:to-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110`}
                      />
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Upload one or more images showcasing the city. Supported
                        formats: JPG, PNG, GIF. Maximum file size: 5MB per
                        image.
                      </p>
                    </label>

                    {/* Existing Images (when editing) */}
                    {cityForm.id &&
                      cityForm.image_urls &&
                      getExistingImageUrls(cityForm.image_urls).length > 0 && (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-slate-200">
                            Existing Images
                          </span>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {getExistingImageUrls(cityForm.image_urls).map(
                              (url, index) => (
                                <div
                                  key={`existing-${index}`}
                                  className="group relative aspect-square overflow-hidden rounded-lg border border-white/20 bg-slate-950/60"
                                >
                                  <img
                                    src={formatImageUrl(url)}
                                    alt={`City image ${index + 1}`}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const existing = getExistingImageUrls(
                                        cityForm.image_urls
                                      );
                                      const updated = existing.filter(
                                        (_, i) => i !== index
                                      );
                                      setCityForm((prev) => ({
                                        ...prev,
                                        image_urls: updated.join(", "),
                                      }));
                                    }}
                                    className="absolute right-1 top-1 rounded-md bg-red-500/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                    title="Remove image"
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
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* New Image Previews */}
                    {cityImagePreviews.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-sm font-semibold text-slate-200">
                          New Images
                        </span>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                          {cityImagePreviews.map((preview, index) => (
                            <div
                              key={`preview-${index}`}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-emerald-400/30 bg-slate-950/60"
                            >
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedFiles =
                                    cityForm.image_files.filter(
                                      (_, i) => i !== index
                                    );
                                  const updatedPreviews =
                                    cityImagePreviews.filter(
                                      (_, i) => i !== index
                                    );

                                  // Revoke the URL for the removed preview
                                  URL.revokeObjectURL(cityImagePreviews[index]);

                                  setCityForm((prev) => ({
                                    ...prev,
                                    image_files: updatedFiles,
                                  }));
                                  setCityImagePreviews(updatedPreviews);
                                }}
                                className="absolute right-1 top-1 rounded-md bg-red-500/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                title="Remove image"
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
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                    {cityForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          // Revoke all preview URLs before resetting
                          revokeImagePreviews(cityImagePreviews);
                          setCityImagePreviews([]);

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
                          <Loader2 className="h-4 w-4 animate-spin" />
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

                <CityTable
                  cities={cities}
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
                      Add rich content blocks, articles, and detailed
                      information for each city.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {cityDetails.length} total
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={handleCityDetailSubmit}
                  className={FORM_CARD_CLASS}
                >
                  {/* Form Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
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
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {cityDetailForm.id
                            ? "Edit City Detail"
                            : "Create City Detail"}
                        </h3>
                        <p className="text-xs text-slate-400">
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
                          // Revoke all preview URLs before resetting
                          revokeImagePreviews(cityDetailImagePreviews);
                          setCityDetailImagePreviews([]);

                          setCityDetailForm(initialCityDetailForm);
                          setCityDetailFileInputKey((prev: number) => prev + 1);
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

                  {/* City Selection */}
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
                      <span className={FIELD_LABEL_CLASS}>Select City *</span>
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
                        Select Title Category *
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
                        onChange={(event) => {
                          const files = event.target.files
                            ? Array.from(event.target.files)
                            : [];
                          setCityDetailForm((prev) => ({
                            ...prev,
                            image_files: files,
                          }));

                          // Create preview URLs for new files
                          const newPreviews = files.map((file) =>
                            createImagePreview(file)
                          );
                          setCityDetailImagePreviews(newPreviews);
                        }}
                        className={`${INPUT_BASE_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-gradient-to-r file:from-purple-500 file:via-pink-500 file:to-red-500 file:px-4 file:py-2 file:text-sm font-semibold file:text-white hover:file:brightness-110`}
                      />
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Upload images related to this content block. These will
                        be displayed alongside the text content.
                      </p>
                    </label>

                    {/* Existing Images (when editing) */}
                    {cityDetailForm.id &&
                      cityDetailForm.image_urls &&
                      getExistingImageUrls(cityDetailForm.image_urls).length >
                        0 && (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-slate-200">
                            Existing Images
                          </span>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {getExistingImageUrls(
                              cityDetailForm.image_urls
                            ).map((url, index) => (
                              <div
                                key={`existing-${index}`}
                                className="group relative aspect-square overflow-hidden rounded-lg border border-white/20 bg-slate-950/60"
                              >
                                <img
                                  src={formatImageUrl(url)}
                                  alt={`Detail image ${index + 1}`}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const existing = getExistingImageUrls(
                                      cityDetailForm.image_urls
                                    );
                                    const updated = existing.filter(
                                      (_, i) => i !== index
                                    );
                                    setCityDetailForm((prev) => ({
                                      ...prev,
                                      image_urls: updated.join(", "),
                                    }));
                                  }}
                                  className="absolute right-1 top-1 rounded-md bg-red-500/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                  title="Remove image"
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
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* New Image Previews */}
                    {cityDetailImagePreviews.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-sm font-semibold text-slate-200">
                          New Images
                        </span>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                          {cityDetailImagePreviews.map((preview, index) => (
                            <div
                              key={`preview-${index}`}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-purple-400/30 bg-slate-950/60"
                            >
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedFiles =
                                    cityDetailForm.image_files.filter(
                                      (_, i) => i !== index
                                    );
                                  const updatedPreviews =
                                    cityDetailImagePreviews.filter(
                                      (_, i) => i !== index
                                    );

                                  // Revoke the URL for the removed preview
                                  URL.revokeObjectURL(
                                    cityDetailImagePreviews[index]
                                  );

                                  setCityDetailForm((prev) => ({
                                    ...prev,
                                    image_files: updatedFiles,
                                  }));
                                  setCityDetailImagePreviews(updatedPreviews);
                                }}
                                className="absolute right-1 top-1 rounded-md bg-red-500/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                title="Remove image"
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
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

                <CityDetailTable
                  cityDetails={cityDetails}
                  cityLookup={cityLabelById}
                  onEdit={handleCityDetailEdit}
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
                      Curate points of interest, dining venues, and experiences.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {locations.length} total
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={handleLocationSubmit}
                  className={FORM_CARD_CLASS}
                >
                  {/* Form Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                        <svg
                          className="h-5 w-5 text-blue-400"
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
                        <h3 className="text-lg font-bold text-slate-900">
                          {locationForm.id
                            ? "Edit Location Entry"
                            : "Create New Location"}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {locationForm.id
                            ? "Modify location details"
                            : "Add a new point of interest"}
                        </p>
                      </div>
                    </div>
                    {locationForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setLocationForm(initialLocationForm);
                          setLocationFileInputKey((prev: number) => prev + 1);
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
                        className="h-5 w-5 text-blue-400"
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
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>City *</span>
                      <select
                        required
                        value={locationForm.city_id}
                        onChange={(event) =>
                          setLocationForm((prev) => ({
                            ...prev,
                            city_id: event.target.value,
                          }))
                        }
                        className={SELECT_BASE_CLASS}
                      >
                        <option value="">Select a city</option>
                        {cityOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>English Name</span>
                        <input
                          type="text"
                          placeholder="Enter location name"
                          value={locationForm.english_name}
                          onChange={(event) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              english_name: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>Burmese Name</span>
                        <input
                          type="text"
                          placeholder="နေရာအမည် (ဗမာ)"
                          value={locationForm.burmese_name}
                          onChange={(event) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              burmese_name: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                    </div>
                    <label className="space-y-2">
                      <span className={FIELD_LABEL_CLASS}>
                        Location Category
                      </span>
                      <select
                        value={locationForm.location_type}
                        onChange={(event) =>
                          setLocationForm((prev) => ({
                            ...prev,
                            location_type: event.target.value,
                          }))
                        }
                        className={SELECT_BASE_CLASS}
                      >
                        <option value="">Select a category</option>
                        {locationTypeGroups.map((group) => (
                          <optgroup key={group.key} label={group.label}>
                            {group.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>
                          Address (English)
                        </span>
                        <input
                          type="text"
                          placeholder="Enter address in English"
                          value={locationForm.address_en}
                          onChange={(event) =>
                            setLocationForm((prev) => ({
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
                          value={locationForm.address_mm}
                          onChange={(event) =>
                            setLocationForm((prev) => ({
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
                          placeholder="Describe this location in English..."
                          value={locationForm.description_en}
                          onChange={(event) =>
                            setLocationForm((prev) => ({
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
                          placeholder="နေရာဖော်ပြချက် (ဗမာ)..."
                          value={locationForm.description_mm}
                          onChange={(event) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              description_mm: event.target.value,
                            }))
                          }
                          className={TEXTAREA_BASE_CLASS}
                        />
                      </label>
                    </div>
                  </div>{" "}
                  {/* Location Coordinates Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-blue-400"
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
                      Location & Map
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
                      <LocationMapPicker
                        value={{ lon: locationForm.lon, lat: locationForm.lat }}
                        cityCenter={selectedCityCenter}
                        disabled={isLocationMapDisabled}
                        onChange={({ lon, lat }) =>
                          setLocationForm((prev) => ({
                            ...prev,
                            lon,
                            lat,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>Longitude</span>
                        <input
                          type="text"
                          placeholder="e.g., 96.195132"
                          value={locationForm.lon}
                          onChange={(event) =>
                            setLocationForm((prev) => ({
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
                          value={locationForm.lat}
                          onChange={(event) =>
                            setLocationForm((prev) => ({
                              ...prev,
                              lat: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                    </div>
                  </div>
                  {/* Media Upload Section */}
                  <div className={FORM_SECTION_CLASS}>
                    <h4 className={SUBSECTION_HEADING_CLASS}>
                      <svg
                        className="h-5 w-5 text-blue-400"
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
                      <span className={FIELD_LABEL_CLASS}>Location Images</span>
                      <input
                        key={locationFileInputKey}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          const files = event.target.files
                            ? Array.from(event.target.files)
                            : [];
                          setLocationForm((prev) => ({
                            ...prev,
                            image_files: files,
                          }));

                          // Create preview URLs for new files
                          const newPreviews = files.map((file) =>
                            createImagePreview(file)
                          );
                          setLocationImagePreviews(newPreviews);
                        }}
                        className={`${INPUT_BASE_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-gradient-to-r file:from-emerald-500 file:via-cyan-500 file:to-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110`}
                      />
                      <p className={FIELD_SUBTEXT_CLASS}>
                        Upload images showcasing this location. Files will be
                        uploaded alongside any existing URLs.
                      </p>
                    </label>

                    {/* Existing Images (when editing) */}
                    {locationForm.id &&
                      locationForm.image_urls &&
                      getExistingImageUrls(locationForm.image_urls).length >
                        0 && (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-slate-200">
                            Existing Images
                          </span>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {getExistingImageUrls(locationForm.image_urls).map(
                              (url, index) => (
                                <div
                                  key={`existing-${index}`}
                                  className="group relative aspect-square overflow-hidden rounded-lg border border-white/20 bg-slate-950/60"
                                >
                                  <img
                                    src={formatImageUrl(url)}
                                    alt={`Location image ${index + 1}`}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const existing = getExistingImageUrls(
                                        locationForm.image_urls
                                      );
                                      const updated = existing.filter(
                                        (_, i) => i !== index
                                      );
                                      setLocationForm((prev) => ({
                                        ...prev,
                                        image_urls: updated.join(", "),
                                      }));
                                    }}
                                    className="absolute right-1 top-1 rounded-md bg-red-500/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                    title="Remove image"
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
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* New Image Previews */}
                    {locationImagePreviews.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-sm font-semibold text-slate-200">
                          New Images
                        </span>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                          {locationImagePreviews.map((preview, index) => (
                            <div
                              key={`preview-${index}`}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-blue-400/30 bg-slate-950/60"
                            >
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedFiles =
                                    locationForm.image_files.filter(
                                      (_, i) => i !== index
                                    );
                                  const updatedPreviews =
                                    locationImagePreviews.filter(
                                      (_, i) => i !== index
                                    );

                                  // Revoke the URL for the removed preview
                                  URL.revokeObjectURL(
                                    locationImagePreviews[index]
                                  );

                                  setLocationForm((prev) => ({
                                    ...prev,
                                    image_files: updatedFiles,
                                  }));
                                  setLocationImagePreviews(updatedPreviews);
                                }}
                                className="absolute right-1 top-1 rounded-md bg-red-500/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                title="Remove image"
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
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                    {locationForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          // Revoke all preview URLs before resetting
                          revokeImagePreviews(locationImagePreviews);
                          setLocationImagePreviews([]);

                          setLocationForm(initialLocationForm);
                          setLocationFileInputKey((prev: number) => prev + 1);
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

                <LocationTable
                  locations={locations}
                  cityLookup={cityLabelById}
                  onEdit={handleLocationEdit}
                  onDelete={handleLocationDelete}
                  categoryGroups={baseLocationTypeGroups}
                />
              </section>
            ) : null}

            {activePanel === "roads" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>Roads</h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      Maintain road geometries and one-way metadata for route
                      planning.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {roads.length} total
                    </span>
                  </div>
                </div>

                <form onSubmit={handleRoadSubmit} className={FORM_CARD_CLASS}>
                  {/* Form Header */}
                  <div className="flex items-start gap-4 border-b border-white/10 pb-4 md:col-span-2">
                    <div className="rounded-lg bg-gradient-to-br from-orange-500 to-pink-600 p-3 shadow-lg shadow-orange-500/20">
                      <svg
                        className="h-6 w-6 text-white"
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
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900">
                        {roadForm.id ? "Edit Road" : "Create New Road"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {roadForm.id
                          ? "Update road details and intersection connections"
                          : "Define a new road with intersections and geometry"}
                      </p>
                    </div>
                    {roadForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRoadForm(initialRoadForm);
                        }}
                        className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-300"
                      >
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
                          onChange={(event) => {
                            const nextCityId = event.target.value;
                            setRoadForm((prev) => ({
                              ...prev,
                              city_id: nextCityId,
                              intersection_ids: [],
                              coordinates: "",
                            }));
                          }}
                          className={SELECT_BASE_CLASS}
                        >
                          <option value="">Select a city</option>
                          {cityOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
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
                          {roadForm.road_type &&
                          !ROAD_TYPE_OPTIONS.includes(roadForm.road_type) ? (
                            <option value={roadForm.road_type}>
                              {`Current: ${humanizeKey(roadForm.road_type)}`}
                            </option>
                          ) : null}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>English Name</span>
                        <input
                          type="text"
                          placeholder="Enter road name in English"
                          value={roadForm.english_name}
                          onChange={(event) =>
                            setRoadForm((prev) => ({
                              ...prev,
                              english_name: event.target.value,
                            }))
                          }
                          className={INPUT_BASE_CLASS}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={FIELD_LABEL_CLASS}>Burmese Name</span>
                        <input
                          type="text"
                          placeholder="Enter road name in Burmese"
                          value={roadForm.burmese_name}
                          onChange={(event) =>
                            setRoadForm((prev) => ({
                              ...prev,
                              burmese_name: event.target.value,
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
                      <span className="text-slate-900">One-way road</span>
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
                  <div className="flex justify-end gap-3 border-t border-white/10 pt-6 md:col-span-2">
                    {roadForm.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRoadForm(initialRoadForm);
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

                <RoadTable
                  roads={roads}
                  cityLookup={cityLabelById}
                  roadTypeOptions={ROAD_TYPE_OPTIONS}
                  onEdit={handleRoadEdit}
                  onDelete={handleRoadDelete}
                />
              </section>
            ) : null}

            {activePanel === "users" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>Users</h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      Review registered administrators and contributors.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {users.length} total
                    </span>
                  </div>
                </div>

                <UserTable users={users} />
              </section>
            ) : null}

            {activePanel === "collaborators" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>Collaborators</h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      Manage users with collaborator access to contribute
                      content.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {collaborators.length} total
                    </span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,118,110,0.25)]">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-slate-100 bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-800">
                            Username
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-800">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-800">
                            Joined
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-800">
                            Last Login
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-800">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {collaborators.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-8 text-center text-sm text-slate-500"
                            >
                              No collaborators found
                            </td>
                          </tr>
                        ) : (
                          collaborators.map((collab) => (
                            <tr
                              key={collab.id}
                              className="transition hover:bg-emerald-50/70"
                            >
                              <td className="px-4 py-3 text-sm text-slate-800">
                                {collab.username || "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-800">
                                {collab.email || "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {collab.created_at
                                  ? new Date(
                                      collab.created_at
                                    ).toLocaleDateString()
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {collab.last_login
                                  ? new Date(
                                      collab.last_login
                                    ).toLocaleDateString()
                                  : "Never"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRevokeCollaborator(
                                        collab.id,
                                        collab.username || "this user"
                                      )
                                    }
                                    disabled={
                                      revokingCollaboratorId === collab.id
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {revokingCollaboratorId === collab.id ? (
                                      <>
                                        <svg
                                          className="h-3.5 w-3.5 animate-spin"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                        >
                                          <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                          />
                                          <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                          />
                                        </svg>
                                        Revoking...
                                      </>
                                    ) : (
                                      <>
                                        <svg
                                          className="h-3.5 w-3.5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                          />
                                        </svg>
                                        Revoke Access
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {activePanel === "collaborator-requests" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>
                      Collaborator Requests
                    </h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      Review and manage requests from users who want to become
                      collaborators.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {collaboratorRequests.length} total
                    </span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,118,110,0.2)]">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-slate-100 bg-slate-50/80">
                        <tr>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-900/60">
                            User
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-900/60">
                            Organization
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-900/60">
                            Position
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-900/60">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-900/60">
                            Submitted
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-900/60">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {collaboratorRequests.filter(
                          (req) => req.status === "pending"
                        ).length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-8 text-center text-sm text-slate-500"
                            >
                              No pending collaborator requests found
                            </td>
                          </tr>
                        ) : (
                          collaboratorRequests
                            .filter((request) => request.status === "pending")
                            .map((request) => (
                              <tr
                                key={request.id}
                                className="transition hover:bg-emerald-50/60"
                              >
                                <td className="px-4 py-3">
                                  <div className="text-sm font-semibold text-slate-900">
                                    {request.username}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {request.email}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">
                                  {request.organization}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">
                                  {request.position}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                      request.status === "pending"
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : request.status === "approved"
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                        : "bg-rose-100 text-rose-700 border border-rose-200"
                                    }`}
                                  >
                                    {request.status.charAt(0).toUpperCase() +
                                      request.status.slice(1)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500">
                                  {new Date(
                                    request.created_at
                                  ).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-2">
                                    {request.status === "pending" ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleApproveRequest(request.id)
                                          }
                                          disabled={
                                            approvingRequestId === request.id ||
                                            rejectingRequestId === request.id
                                          }
                                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {approvingRequestId === request.id ? (
                                            <>
                                              <svg
                                                className="h-3.5 w-3.5 animate-spin"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                              >
                                                <circle
                                                  className="opacity-25"
                                                  cx="12"
                                                  cy="12"
                                                  r="10"
                                                  stroke="currentColor"
                                                  strokeWidth="4"
                                                />
                                                <path
                                                  className="opacity-75"
                                                  fill="currentColor"
                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                              </svg>
                                              Approving...
                                            </>
                                          ) : (
                                            <>
                                              <svg
                                                className="h-3.5 w-3.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M5 13l4 4L19 7"
                                                />
                                              </svg>
                                              Approve
                                            </>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRejectRequest(request.id)
                                          }
                                          disabled={
                                            approvingRequestId === request.id ||
                                            rejectingRequestId === request.id
                                          }
                                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {rejectingRequestId === request.id ? (
                                            <>
                                              <svg
                                                className="h-3.5 w-3.5 animate-spin"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                              >
                                                <circle
                                                  className="opacity-25"
                                                  cx="12"
                                                  cy="12"
                                                  r="10"
                                                  stroke="currentColor"
                                                  strokeWidth="4"
                                                />
                                                <path
                                                  className="opacity-75"
                                                  fill="currentColor"
                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                              </svg>
                                              Rejecting...
                                            </>
                                          ) : (
                                            <>
                                              <svg
                                                className="h-3.5 w-3.5"
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
                                              Reject
                                            </>
                                          )}
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-xs text-slate-500">
                                        {request.status === "approved"
                                          ? "Approved"
                                          : "Rejected"}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Inactive Cities Panel */}
            {activePanel === "inactive-cities" ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={SECTION_HEADING_CLASS}>Inactive Cities</h2>
                    <p className={SECTION_DESCRIPTION_CLASS}>
                      View all cities that have been marked as inactive
                      (is_active = false). These cities are hidden from public
                      view.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={PANEL_PILL_CLASS}>
                      {inactiveCities.length} inactive
                    </span>
                  </div>
                </div>

                {inactiveCities.length === 0 ? (
                  <div className={`${FORM_CARD_CLASS} text-center`}>
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                        <svg
                          className="h-8 w-8 text-emerald-500"
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
                        <h3 className="text-lg font-semibold text-slate-900">
                          No Inactive Cities
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          All cities in the system are currently active.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={FORM_CARD_CLASS}>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              City Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Submitted By
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Email
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inactiveCities.map((city) => {
                            const submitter = city.user_id
                              ? userLookupById[city.user_id]
                              : null;
                            return (
                              <tr
                                key={city.id}
                                className="transition-colors hover:bg-emerald-50/60"
                              >
                                <td className="px-4 py-3">
                                  <div className="text-sm font-medium text-slate-900">
                                    {city.name_en || city.name_mm || "Unnamed"}
                                  </div>
                                  {city.name_mm && city.name_en && (
                                    <div className="text-xs text-slate-500">
                                      {city.name_mm}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {submitter?.username || "Unknown User"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500">
                                  {submitter?.email || "N/A"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMapViewerContent({
                                          data: city,
                                          type: "city",
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
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
                                      View Map
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAcceptInactiveCity(city.id)
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCityDelete(city.id)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
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
                                      Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
                      View all city detail sections that have been marked as
                      inactive. These details are hidden from public view.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={PANEL_PILL_CLASS}>
                      {inactiveCityDetails.length} inactive
                    </span>
                  </div>
                </div>

                {inactiveCityDetails.length === 0 ? (
                  <div className={`${FORM_CARD_CLASS} text-center`}>
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                        <svg
                          className="h-8 w-8 text-emerald-500"
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
                        <h3 className="text-lg font-semibold text-slate-900">
                          No Inactive City Details
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          All city details in the system are currently active.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={FORM_CARD_CLASS}>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Title
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              City
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Submitted By
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Email
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inactiveCityDetails.map((detail) => {
                            const submitter = detail.user_id
                              ? userLookupById[detail.user_id]
                              : null;
                            const titleOption = PREDEFINED_TITLE_OPTIONS.find(
                              (opt) => opt.value === detail.predefined_title
                            );
                            return (
                              <tr
                                key={detail.id}
                                className="transition-colors hover:bg-emerald-50/60"
                              >
                                <td className="px-4 py-3">
                                  <div className="text-sm font-medium text-slate-900">
                                    {titleOption?.label_en ||
                                      detail.predefined_title}
                                  </div>
                                  {titleOption?.label_mm && (
                                    <div className="text-xs text-slate-500">
                                      {titleOption.label_mm}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {cityLabelById[detail.city_id] ||
                                    detail.city_id}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {submitter?.username || "Unknown User"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500">
                                  {submitter?.email || "N/A"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAcceptInactiveCityDetail(
                                          detail.id
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCityDetailDelete(detail.id)
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
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
                                      Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
                      View all locations that have been marked as inactive.
                      These locations are hidden from public view.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={PANEL_PILL_CLASS}>
                      {inactiveLocations.length} inactive
                    </span>
                  </div>
                </div>

                {inactiveLocations.length === 0 ? (
                  <div className={`${FORM_CARD_CLASS} text-center`}>
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                        <svg
                          className="h-8 w-8 text-emerald-500"
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
                        <h3 className="text-lg font-semibold text-slate-900">
                          No Inactive Locations
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          All locations in the system are currently active.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={FORM_CARD_CLASS}>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Location Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Type
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              City
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Submitted By
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Email
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inactiveLocations.map((location) => {
                            const submitter = location.user_id
                              ? userLookupById[location.user_id]
                              : null;
                            return (
                              <tr
                                key={location.id}
                                className="transition-colors hover:bg-emerald-50/60"
                              >
                                <td className="px-4 py-3">
                                  <div className="text-sm font-medium text-slate-900">
                                    {location.name_en ||
                                      location.name_mm ||
                                      "Unnamed"}
                                  </div>
                                  {location.name_mm && location.name_en && (
                                    <div className="text-xs text-slate-500">
                                      {location.name_mm}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {humanizeKey(location.location_type || "N/A")}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {location.city_id
                                    ? cityLabelById[location.city_id] ||
                                      location.city_id
                                    : "N/A"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {submitter?.username || "Unknown User"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500">
                                  {submitter?.email || "N/A"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMapViewerContent({
                                          data: location,
                                          type: "location",
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
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
                                      View Map
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAcceptInactiveLocation(
                                          location.id
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleLocationDelete(location.id)
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
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
                                      Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
                      View all roads that have been marked as inactive. These
                      roads are hidden from public view.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={PANEL_PILL_CLASS}>
                      {inactiveRoads.length} inactive
                    </span>
                  </div>
                </div>

                {inactiveRoads.length === 0 ? (
                  <div className={`${FORM_CARD_CLASS} text-center`}>
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                        <svg
                          className="h-8 w-8 text-emerald-500"
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
                        <h3 className="text-lg font-semibold text-slate-900">
                          No Inactive Roads
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          All roads in the system are currently active.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={FORM_CARD_CLASS}>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            Road Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            City
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            Submitted By
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            Email
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inactiveRoads.map((road) => {
                          const submitter = road.user_id
                            ? userLookupById[road.user_id]
                            : null;
                          return (
                            <tr
                              key={road.id}
                              className="transition-colors hover:bg-emerald-50/60"
                            >
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-900">
                                  {road.name_en || road.name_mm || "N/A"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-600">
                                  {humanizeKey(road.road_type || "N/A")}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-600">
                                  {road.city_id
                                    ? cityLabelById[road.city_id] || "N/A"
                                    : "N/A"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-600">
                                  {submitter?.username || "N/A"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-600">
                                  {submitter?.email || "N/A"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMapViewerContent({
                                        data: road,
                                        type: "road",
                                      })
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                  >
                                    <svg
                                      className="h-3.5 w-3.5"
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
                                    View Map
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleAcceptInactiveRoad(road.id)
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => handleRoadDelete(road.id)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}
          </main>
        </div>
      </div>

      {/* Inactive Content Map Viewer Modal */}
      {mapViewerContent && (
        <InactiveContentMapViewer
          content={mapViewerContent.data}
          type={mapViewerContent.type}
          submitter={
            mapViewerContent.data.user_id
              ? (userLookupById[mapViewerContent.data.user_id] as {
                  id: string;
                  username: string | null;
                  email: string | null;
                }) || null
              : null
          }
          cityName={
            mapViewerContent.type !== "city" &&
            (mapViewerContent.data as AdminLocation | AdminRoad).city_id
              ? cityLabelById[
                  (mapViewerContent.data as AdminLocation | AdminRoad).city_id!
                ]
              : undefined
          }
          onClose={() => setMapViewerContent(null)}
          onAccept={async () => {
            if (mapViewerContent.type === "city") {
              await handleAcceptInactiveCity(mapViewerContent.data.id);
              setMapViewerContent(null);
            } else if (mapViewerContent.type === "location") {
              await handleAcceptInactiveLocation(mapViewerContent.data.id);
              setMapViewerContent(null);
            } else if (mapViewerContent.type === "road") {
              await handleAcceptInactiveRoad(mapViewerContent.data.id);
              setMapViewerContent(null);
            }
          }}
          onReject={async () => {
            if (mapViewerContent.type === "city") {
              await handleCityDelete(mapViewerContent.data.id);
              setMapViewerContent(null);
            } else if (mapViewerContent.type === "location") {
              await handleLocationDelete(mapViewerContent.data.id);
              setMapViewerContent(null);
            } else if (mapViewerContent.type === "road") {
              await handleRoadDelete(mapViewerContent.data.id);
              setMapViewerContent(null);
            }
          }}
        />
      )}
    </div>
  );
}
