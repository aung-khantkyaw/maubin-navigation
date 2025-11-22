import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
  Loader2,
  MapPin,
  Navigation,
  X,
} from "lucide-react";
import { Header } from "@/components/header";
import { useTranslation } from "react-i18next";
import {
  normalizeLocalizedField,
  normalizeLocalizedNames,
  pickLocalizedText,
} from "@/utils/localized";
import type { LocalizedTextPair } from "@/utils/localized";

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

type GalleryImage = {
  src: string;
  alt: string;
};

type LocationCard = {
  id: string;
  name: string;
  description: string;
  address?: string;
  type: string;
  category: string;
  images: GalleryImage[];
};

type TabKey =
  | "profile"
  | "public_and_civic"
  | "transportation"
  | "entertainment_and_leisure"
  | "commerce"
  | "education_and_culture"
  | "religious"
  | "residential_and_industrial"
  | "other";

type CityDetailContent = {
  id: string;
  city_id: string;
  user_id: string;
  predefined_title: string;
  subtitle: {
    en?: string;
    mm?: string;
  } | null;
  body: {
    en?: string;
    mm?: string;
  };
  image_urls: string[] | null;
  created_at: string;
  updated_at: string;
};

type CityDetails = {
  id: string;
  user_id: string | null;
  burmese_name: string | null;
  english_name: string;
  address: LocalizedTextPair;
  description: LocalizedTextPair;
  geometry: string | null;
  image_urls: string[] | null;
};

type CityLocation = {
  id: string;
  city_id: string | null;
  user_id: string | null;
  burmese_name: string | null;
  english_name: string | null;
  address: LocalizedTextPair;
  description: LocalizedTextPair;
  location_type: string | null;
  geometry: string | null;
  image_urls: string[] | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatImageUrl(src: string | null | undefined): string {
  if (!src) return "";
  const trimmedSrc = src.trim();
  // If it's already a full URL, return it as is.
  if (trimmedSrc.startsWith("http://") || trimmedSrc.startsWith("https://")) {
    return trimmedSrc;
  }
  // If it's a relative path, combine it with the base URL.
  // This handles both '/uploads/...' and 'uploads/...'
  return `${API_BASE_URL.replace(/\/$/, "")}/${trimmedSrc.replace(/^\//, "")}`;
}

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

// Mapping of predefined titles to location types
const CATEGORY_LOCATION_TYPES: Record<string, string[]> = {
  administrative_info: ["office"],
  economic_info: [
    "restaurant",
    "store",
    "pharmacy",
    "factory",
    "warehouse",
    "farm",
    "cafe",
    "bar",
    "cinema",
    "stadium",
    "market",
    "mall",
    "supermarket",
    "bank",
    "hotel",
  ],
  social_info: ["school", "university", "library", "museum", "hospital"],
  religious_info: ["pagoda", "monastery", "temple", "church", "mosque"],
};

function slugify(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
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
      // Not JSON, fall through
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
  image_urls: unknown;
}>;

function normalizeCityResponse(city: unknown): CityDetails {
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
    user_id: payload.user_id ? String(payload.user_id) : null,
    burmese_name:
      pickStringValue(payload.burmese_name, payload.name_mm) ?? null,
    english_name:
      pickStringValue(payload.english_name, payload.name_en, payload.name) ??
      "",
    address,
    description,
    geometry: typeof payload.geometry === "string" ? payload.geometry : null,
    image_urls: normalizeImageUrls(payload.image_urls ?? null),
  };
}

function normalizeLocationResponse(location: unknown): CityLocation {
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

  return {
    id: payload.id ? String(payload.id) : "",
    city_id: payload.city_id ? String(payload.city_id) : null,
    user_id: payload.user_id ? String(payload.user_id) : null,
    burmese_name:
      pickStringValue(payload.burmese_name, payload.name_mm) ?? null,
    english_name: pickStringValue(
      payload.english_name,
      payload.name_en,
      payload.name
    ),
    address,
    description,
    location_type:
      typeof payload.location_type === "string" ? payload.location_type : null,
    geometry: typeof payload.geometry === "string" ? payload.geometry : null,
    image_urls: normalizeImageUrls(payload.image_urls ?? null),
  };
}

function formatLocationTag(type: string): string {
  return type
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function createGalleryFromUrls(
  imageUrls: string[] | null | undefined,
  altPrefix: string
): GalleryImage[] {
  if (!imageUrls?.length) return [];
  return imageUrls.map((src, index) => ({
    src: formatImageUrl(src),
    alt: `${altPrefix} photo ${index + 1}`,
  }));
}

async function fetchCity(cityId: string, signal: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/cities/${cityId}`, {
    signal,
  });
  if (!response.ok) return null;
  const json = await response.json();
  if (!json?.is_success || !json.data) return null;
  const payload = Array.isArray(json.data) ? json.data[0] : json.data;
  if (!payload) return null;
  return normalizeCityResponse(payload);
}

async function fetchCityByIdentifier(identifier: string, signal: AbortSignal) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const direct = await fetchCity(trimmed, signal);
  if (direct) return direct;

  if (isUuid(trimmed)) return null;

  const response = await fetch(`${API_BASE_URL}/cities`, { signal });
  if (!response.ok) return null;
  const json = await response.json();
  const raw = json?.data;
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
    ? [raw]
    : [];
  const cities: CityDetails[] = items.map(normalizeCityResponse);

  const slug = slugify(trimmed);
  const match = cities.find((candidate) => {
    const englishSlug = slugify(candidate.english_name);
    const burmeseSlug = slugify(candidate.burmese_name);
    const idSlug = slugify(candidate.id);
    return slug === englishSlug || slug === burmeseSlug || slug === idSlug;
  });

  if (!match) return null;
  if (match.id === trimmed) return match;
  return (await fetchCity(match.id, signal)) ?? match;
}

async function fetchLocations(cityId: string, signal: AbortSignal) {
  const response = await fetch(
    `${API_BASE_URL}/locations?city_id=${encodeURIComponent(cityId)}`,
    { signal }
  );
  if (!response.ok) return [];
  const json = await response.json();
  if (!json?.is_success || !json.data) return [];
  const raw = json.data;
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
    ? [raw]
    : [];
  return items.map(normalizeLocationResponse);
}

async function fetchCityDetailsByTitle(
  cityId: string,
  title: string,
  signal: AbortSignal
): Promise<CityDetailContent | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/city-details?city_id=${encodeURIComponent(
        cityId
      )}&predefined_title=${encodeURIComponent(title)}`,
      { signal }
    );
    if (!response.ok) return null;
    const json = await response.json();
    if (!json?.is_success || !json.data) return null;
    const raw = json.data;
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return null;

    // Handle subtitle - can be JSONB or separate fields
    let subtitle = null;
    if (item.subtitle) {
      subtitle =
        typeof item.subtitle === "string"
          ? JSON.parse(item.subtitle)
          : item.subtitle;
    } else if (item.subtitle_en || item.subtitle_mm) {
      subtitle = {
        en: item.subtitle_en || "",
        mm: item.subtitle_mm || "",
      };
    }

    // Handle body - can be JSONB or separate fields (body_en, body_mm)
    let body = { en: "", mm: "" };
    if (item.body) {
      body = typeof item.body === "string" ? JSON.parse(item.body) : item.body;
    } else if (item.body_en || item.body_mm) {
      body = {
        en: item.body_en || "",
        mm: item.body_mm || "",
      };
    }

    return {
      id: item.id ? String(item.id) : "",
      city_id: item.city_id ? String(item.city_id) : "",
      user_id: item.user_id ? String(item.user_id) : "",
      predefined_title: item.predefined_title
        ? String(item.predefined_title)
        : "",
      subtitle,
      body,
      image_urls: normalizeImageUrls(item.image_urls ?? null),
      created_at: item.created_at ? String(item.created_at) : "",
      updated_at: item.updated_at ? String(item.updated_at) : "",
    };
  } catch (error) {
    console.error("Error fetching city details:", error);
    return null;
  }
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Navigation;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ImageCarousel({
  images,
  altPrefix,
  onImageClick,
}: {
  images: GalleryImage[];
  altPrefix: string;
  onImageClick?: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (direction: "left" | "right") => {
    const node = scrollRef.current;
    if (!node) return;
    const amount = node.clientWidth * 0.8;
    node.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!images.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
        Photo gallery coming soon.
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-2 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {images.map((image, index) => (
          <button
            key={`${altPrefix}-${index}`}
            type="button"
            onClick={() => onImageClick?.(index)}
            className="relative w-64 flex-shrink-0 overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <img
              src={image.src}
              alt={image.alt}
              className="h-40 w-64 object-cover transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {images.length > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-700 opacity-0 transition hover:bg-white group-hover:opacity-100"
            onClick={() => scrollBy("left")}
            aria-label="Scroll images left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-700 opacity-0 transition hover:bg-white group-hover:opacity-100"
            onClick={() => scrollBy("right")}
            aria-label="Scroll images right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function EmptySectionMessage({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
      {message}
    </div>
  );
}

function CategoryBadges({
  activeLanguage,
  selectedTitle,
  onTitleSelect,
  isLoading,
}: {
  activeLanguage: string;
  selectedTitle: string | null;
  onTitleSelect: (title: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-blue-100/60">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Compass className="h-4 w-4" />
        </span>
        <h3 className="text-lg font-semibold text-slate-900">
          {activeLanguage === "mm"
            ? "အမျိုးအစားများ"
            : "Information Categories"}
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {PREDEFINED_TITLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onTitleSelect(option.value)}
            disabled={isLoading}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selectedTitle === option.value
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            } ${
              isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            {activeLanguage === "mm" ? option.label_mm : option.label_en}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingCity({ cityName }: { cityName: string }) {
  const { t } = useTranslation("details");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-600">
      <Loader2 className="h-9 w-9 animate-spin text-blue-500" />
      <p className="mt-4 text-sm uppercase tracking-[0.3em] text-blue-600/80">
        {t("loading.preparing", { cityName })}
      </p>
    </div>
  );
}

function UnsupportedCity({
  cityName,
  message,
}: {
  cityName: string;
  message?: string;
}) {
  const { t } = useTranslation("details");
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(59,130,246,0.12),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(192,132,252,0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.6)_0%,rgba(241,245,249,0.9)_50%,rgba(248,250,252,0.6)_100%)]" />
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs uppercase tracking-[0.3em] text-blue-700">
            {t("comingSoon.badge")}
          </span>
          <h1 className="mt-6 text-3xl font-semibold text-slate-900 sm:text-4xl">
            {t("comingSoon.routeGuideOnTheWay", { cityName })}
          </h1>
          <p className="mt-4 text-sm text-slate-600 sm:text-base">
            {message ?? t("comingSoon.notPublished", { cityName })}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
            >
              {t("comingSoon.goHome")}
            </Link>
            <Link
              to="/landmark-map"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
            >
              {t("comingSoon.openMap")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function formatCityName(raw: string) {
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(
      (segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    )
    .join(" ");
}

export default function Details() {
  const { cityId } = useParams<{ cityId?: string }>();
  const requestedIdentifier = (cityId ?? "maubin").trim() || "maubin";

  const { t, i18n } = useTranslation("details");
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language ?? "en";

  const [city, setCity] = useState<CityDetails | null>(null);
  const [locations, setLocations] = useState<CityLocation[]>([]);
  const [isCityLoading, setIsCityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [modalState, setModalState] = useState<{
    open: boolean;
    title: string;
    images: GalleryImage[];
  }>({ open: false, title: "", images: [] });
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [cityDetailContent, setCityDetailContent] =
    useState<CityDetailContent | null>(null);
  const [isTitleContentLoading, setIsTitleContentLoading] = useState(false);
  const [categoryLocations, setCategoryLocations] = useState<CityLocation[]>(
    []
  );
  const [areCategoryLocationsLoading, setAreCategoryLocationsLoading] =
    useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadCity() {
      setIsCityLoading(true);
      setError(null);
      setCity(null);
      setLocations([]);

      try {
        const fetchedCity = await fetchCityByIdentifier(
          requestedIdentifier,
          controller.signal
        );

        if (!mounted) return;

        if (!fetchedCity) {
          setError("City not found in our dataset just yet.");
          setCity(null);
          setLocations([]);
          return;
        }

        setCity(fetchedCity);
        setIsCityLoading(false);

        const fetchedLocations = await fetchLocations(
          fetchedCity.id,
          controller.signal
        );
        if (!mounted) return;
        setLocations(fetchedLocations);
      } catch (err) {
        if (!mounted) return;
        console.error(err);
        setError(
          "We couldn't load this city right now. Please try again shortly."
        );
        setCity(null);
        setLocations([]);
      } finally {
        if (mounted) {
          setIsCityLoading(false);
        }
      }
    }

    loadCity();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [requestedIdentifier]);

  useEffect(() => {
    if (!modalState.open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalState({ open: false, title: "", images: [] });
        return;
      }

      if (event.key === "ArrowLeft") {
        setLightboxIndex((current) =>
          modalState.images.length ? Math.max(current - 1, 0) : current
        );
      }

      if (event.key === "ArrowRight") {
        setLightboxIndex((current) =>
          modalState.images.length
            ? Math.min(current + 1, modalState.images.length - 1)
            : current
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalState]);

  useEffect(() => {
    document.body.style.overflow = modalState.open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalState.open]);

  const cityLocalizedNames = useMemo(
    () =>
      normalizeLocalizedNames({
        english_name: city?.english_name,
        burmese_name: city?.burmese_name,
      }),
    [city?.english_name, city?.burmese_name]
  );

  const { en: cityNameEn, mm: cityNameMm } = cityLocalizedNames;

  const displayCityName = useMemo(
    () =>
      pickLocalizedText(activeLanguage, {
        en: cityNameEn,
        mm: cityNameMm,
        fallback: formatCityName(requestedIdentifier),
      }),
    [activeLanguage, cityNameEn, cityNameMm, requestedIdentifier]
  );

  const cityDescriptionText = useMemo(() => {
    if (!city) return "";
    return pickLocalizedText(activeLanguage, {
      en: city.description.en,
      mm: city.description.mm,
      fallback: "",
    });
  }, [city, activeLanguage]);

  const profileParagraphs = useMemo<string[]>(() => {
    if (!cityDescriptionText) return [];
    return cityDescriptionText
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);
  }, [cityDescriptionText]);

  const heroImages = useMemo(
    () => createGalleryFromUrls(city?.image_urls, displayCityName),
    [city?.image_urls, displayCityName]
  );

  const adventurePhotos = heroImages;
  const activeModalImage = modalState.images[lightboxIndex];

  // Helper function to get category for a location type
  const getCategoryForLocationType = (locationType: string | null): string => {
    if (!locationType) return "other";
    const normalizedType = locationType.toLowerCase().trim();

    for (const [category, types] of Object.entries(LOCATION_CATEGORIES)) {
      if (types.some((type) => normalizedType.includes(type.toLowerCase()))) {
        return category;
      }
    }
    return "other";
  };

  // Generate location cards with categories
  const locationCards = useMemo<LocationCard[]>(() => {
    if (!locations.length) return [];

    return locations
      .filter((location) => {
        // Filter out intersection type locations
        const locationType = location.location_type?.toLowerCase().trim();
        return locationType !== "intersection";
      })
      .map((location, index) => {
        const normalizedNames = normalizeLocalizedNames(location);
        const fallbackName = `${displayCityName} highlight ${index + 1}`;
        const name = pickLocalizedText(activeLanguage, {
          en: normalizedNames.en,
          mm: normalizedNames.mm,
          fallback: fallbackName,
        });

        const type = location.location_type
          ? formatLocationTag(location.location_type)
          : "Other";
        const gallery = createGalleryFromUrls(location.image_urls, name);

        const fallbackDescription = `Discover this ${type.toLowerCase()} while exploring ${displayCityName}.`;

        const description = pickLocalizedText(activeLanguage, {
          en: location.description.en,
          mm: location.description.mm,
          fallback: fallbackDescription,
        }).trim();

        const addressText = pickLocalizedText(activeLanguage, {
          en: location.address.en,
          mm: location.address.mm,
          fallback: location.address.en ?? location.address.mm ?? null,
        }).trim();

        const category = getCategoryForLocationType(location.location_type);

        return {
          id: location.id,
          name,
          description,
          address: addressText.length ? addressText : undefined,
          type,
          category,
          images: gallery,
        };
      });
  }, [locations, displayCityName, activeLanguage]);

  const tabs: { key: TabKey; label: string; icon: typeof Compass }[] = [
    { key: "profile", label: t("tabs.profile"), icon: Compass },
    {
      key: "public_and_civic",
      label: t("categories.public_and_civic"),
      icon: MapPin,
    },
    {
      key: "transportation",
      label: t("categories.transportation"),
      icon: MapPin,
    },
    {
      key: "entertainment_and_leisure",
      label: t("categories.entertainment_and_leisure"),
      icon: MapPin,
    },
    { key: "commerce", label: t("categories.commerce"), icon: MapPin },
    {
      key: "education_and_culture",
      label: t("categories.education_and_culture"),
      icon: MapPin,
    },
    { key: "religious", label: t("categories.religious"), icon: MapPin },
    {
      key: "residential_and_industrial",
      label: t("categories.residential_and_industrial"),
      icon: MapPin,
    },
    { key: "other", label: t("categories.other"), icon: MapPin },
  ];

  const openModal = (title: string, images: GalleryImage[], index = 0) => {
    setModalState({ open: true, title, images });
    setLightboxIndex(index);
  };

  const closeModal = () => {
    setModalState({ open: false, title: "", images: [] });
  };

  const handleTitleSelect = async (title: string) => {
    if (!city?.id || selectedTitle === title) return;

    setSelectedTitle(title);
    setIsTitleContentLoading(true);
    setCityDetailContent(null);
    setCategoryLocations([]);

    const controller = new AbortController();
    try {
      // Fetch city detail content
      const content = await fetchCityDetailsByTitle(
        city.id,
        title,
        controller.signal
      );
      setCityDetailContent(content);

      // Check if this category has associated location types
      const locationTypes = CATEGORY_LOCATION_TYPES[title];
      if (locationTypes && locationTypes.length > 0) {
        setAreCategoryLocationsLoading(true);
        // Fetch all locations for this city
        const allLocations = await fetchLocations(city.id, controller.signal);
        // Filter locations by the category's location types
        const filteredLocations = allLocations.filter((location) => {
          if (!location.location_type) return false;
          const normalizedType = location.location_type.toLowerCase().trim();
          return locationTypes.some((type) =>
            normalizedType.includes(type.toLowerCase())
          );
        });
        setCategoryLocations(filteredLocations);
        setAreCategoryLocationsLoading(false);
      }
    } catch (err) {
      console.error("Error loading title content:", err);
      setCityDetailContent(null);
      setCategoryLocations([]);
    } finally {
      setIsTitleContentLoading(false);
      setAreCategoryLocationsLoading(false);
    }
  };

  if (isCityLoading && !city) {
    return <LoadingCity cityName={displayCityName} />;
  }

  if (!city) {
    return (
      <UnsupportedCity
        cityName={displayCityName}
        message={
          error ?? t("errors.notPublishedYet", { cityName: displayCityName })
        }
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <div className="relative overflow-x-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(59,130,246,0.12),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(192,132,252,0.12),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.6)_0%,rgba(241,245,249,0.9)_50%,rgba(248,250,252,0.6)_100%)]" />

        <main className="relative z-10 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Link
              to="/"
              className="group inline-flex items-center text-sm text-blue-600 transition hover:text-blue-500"
            >
              <ArrowLeft className="mr-2 h-4 w-4 transition group-hover:-translate-x-1" />
              {t("backHome")}
            </Link>

            <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-4">
                <h1
                  className={`text-2xl font-bold text-slate-900 drop-shadow md:text-4xl ${
                    activeLanguage === "mm" ? "leading-tight" : ""
                  }`}
                >
                  {t("routesIn", { cityName: displayCityName })}
                </h1>
                {/* <p
                className={`max-w-2xl text-base text-slate-600 md:text-lg ${
                  activeLanguage === "mm" ? "leading-loose" : ""
                }`}
              >
                {heroDescription}
              </p> */}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  to={`/landmark-map/${city.id}`}
                  className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  <Navigation className="h-4 w-4" />
                  {t("exploreMap")}
                </Link>
              </div>
            </div>

            {heroImages.length ? (
              <div className="relative mt-8 grid h-[520px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-blue-100">
                {heroImages.map((image, index) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() =>
                      openModal("Adventure Photos", adventurePhotos, index)
                    }
                    className={`group relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      index === 0
                        ? "col-span-2 row-span-2"
                        : index === heroImages.length - 1
                        ? "col-span-2"
                        : ""
                    }`}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/10 via-transparent to-transparent" />
                  </button>
                ))}

                <div className="pointer-events-none absolute inset-0 rounded-3xl border border-slate-200" />

                <button
                  type="button"
                  onClick={() => openModal("Adventure Photos", adventurePhotos)}
                  className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-900 backdrop-blur transition hover:bg-white"
                >
                  <Camera className="h-4 w-4" />
                  {t("showAllPhotos", { count: adventurePhotos.length })}
                </button>
              </div>
            ) : (
              <div className="mt-8 flex h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white text-sm text-slate-600">
                {t("photoGalleryWillAppear")}
              </div>
            )}

            <div className="mt-10 border-y border-slate-200 py-4" id="profile">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {tabs.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 border-b-2 pb-2 transition ${
                      activeTab === key
                        ? "border-blue-500 text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "profile" ? (
              <section className="mt-12">
                <SectionHeading
                  icon={Compass}
                  title={
                    selectedTitle
                      ? PREDEFINED_TITLE_OPTIONS.find(
                          (opt) => opt.value === selectedTitle
                        )?.[
                          activeLanguage === "mm" ? "label_mm" : "label_en"
                        ] ??
                        t("profile.informationAbout", {
                          cityName: displayCityName,
                        })
                      : t("profile.profileOf", { cityName: displayCityName })
                  }
                />

                {/* 2:1 Grid Layout - Content (left) and Categories (right) */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Left column - Main Content (2/3 width) */}
                  <div className="space-y-8 lg:col-span-2">
                    {isTitleContentLoading ? (
                      <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
                        <div className="text-center">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
                          <p className="mt-3 text-sm text-slate-600">
                            {t("profile.loadingContent")}
                          </p>
                        </div>
                      </div>
                    ) : cityDetailContent ? (
                      <div className="space-y-8">
                        {cityDetailContent.image_urls &&
                        cityDetailContent.image_urls.length > 0 ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <ImageCarousel
                              images={createGalleryFromUrls(
                                cityDetailContent.image_urls,
                                selectedTitle
                                  ? PREDEFINED_TITLE_OPTIONS.find(
                                      (opt) => opt.value === selectedTitle
                                    )?.[
                                      activeLanguage === "mm"
                                        ? "label_mm"
                                        : "label_en"
                                    ] ?? "Category"
                                  : "Profile"
                              )}
                              altPrefix={
                                selectedTitle
                                  ? PREDEFINED_TITLE_OPTIONS.find(
                                      (opt) => opt.value === selectedTitle
                                    )?.[
                                      activeLanguage === "mm"
                                        ? "label_mm"
                                        : "label_en"
                                    ] ?? "Category"
                                  : "Profile"
                              }
                              onImageClick={(index) =>
                                openModal(
                                  selectedTitle
                                    ? PREDEFINED_TITLE_OPTIONS.find(
                                        (opt) => opt.value === selectedTitle
                                      )?.[
                                        activeLanguage === "mm"
                                          ? "label_mm"
                                          : "label_en"
                                      ] ?? "Category Images"
                                    : "Profile Images",
                                  createGalleryFromUrls(
                                    cityDetailContent.image_urls,
                                    "Category"
                                  ),
                                  index
                                )
                              }
                            />
                          </div>
                        ) : null}

                        <div
                          className={`space-y-5 text-base text-slate-600 ${
                            activeLanguage === "mm"
                              ? "leading-loose"
                              : "leading-relaxed"
                          }`}
                        >
                          {(() => {
                            const content =
                              activeLanguage === "mm"
                                ? cityDetailContent.body.mm
                                : cityDetailContent.body.en;
                            if (!content) {
                              return (
                                <EmptySectionMessage
                                  message={`No content available for this category in ${
                                    activeLanguage === "mm"
                                      ? "Myanmar"
                                      : "English"
                                  }.`}
                                />
                              );
                            }
                            const paragraphs = content
                              .split(/\n+/)
                              .map((p: string) => p.trim())
                              .filter((p: string) => p.length > 0);
                            return paragraphs.length ? (
                              paragraphs.map(
                                (paragraph: string, index: number) => (
                                  <p key={`content-${index}`}>{paragraph}</p>
                                )
                              )
                            ) : (
                              <EmptySectionMessage
                                message={t("profile.noContentAvailable")}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    ) : selectedTitle ? (
                      <EmptySectionMessage
                        message={t("profile.noContentFound")}
                      />
                    ) : (
                      <div
                        className={`space-y-5 text-base text-slate-600 ${
                          activeLanguage === "mm"
                            ? "leading-loose"
                            : "leading-relaxed"
                        }`}
                      >
                        {profileParagraphs.length ? (
                          profileParagraphs.map((paragraph, index) => (
                            <p key={`profile-${index}`}>{paragraph}</p>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">
                            {t("profile.gatheringDetails", {
                              cityName: displayCityName,
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right column - Category Badges (1/3 width) */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-6">
                      <CategoryBadges
                        activeLanguage={activeLanguage}
                        selectedTitle={selectedTitle}
                        onTitleSelect={handleTitleSelect}
                        isLoading={isTitleContentLoading}
                      />
                    </div>
                  </div>
                </div>

                {/* Display category-related locations */}
                {selectedTitle &&
                CATEGORY_LOCATION_TYPES[selectedTitle] &&
                (areCategoryLocationsLoading ||
                  categoryLocations.length > 0) ? (
                  <div className="mt-12 space-y-6">
                    <SectionHeading
                      icon={MapPin}
                      title={t("relatedLocations.title", {
                        category:
                          PREDEFINED_TITLE_OPTIONS.find(
                            (opt) => opt.value === selectedTitle
                          )?.[
                            activeLanguage === "mm" ? "label_mm" : "label_en"
                          ] ?? "Category",
                      })}
                      subtitle={
                        areCategoryLocationsLoading
                          ? t("relatedLocations.loadingLocations")
                          : t("relatedLocations.locationsFound", {
                              count: categoryLocations.length,
                            })
                      }
                    />

                    {areCategoryLocationsLoading ? (
                      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
                        <div className="text-center">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
                          <p className="mt-3 text-sm text-slate-600">
                            {t("relatedLocations.loadingRelated")}
                          </p>
                        </div>
                      </div>
                    ) : categoryLocations.length > 0 ? (
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {categoryLocations.map((location) => {
                          const normalizedNames =
                            normalizeLocalizedNames(location);
                          const locationName = pickLocalizedText(
                            activeLanguage,
                            {
                              en: normalizedNames.en,
                              mm: normalizedNames.mm,
                              fallback: t("relatedLocations.unnamedLocation"),
                            }
                          );
                          const locationTag = location.location_type
                            ? formatLocationTag(location.location_type)
                            : null;
                          const locationAddress = pickLocalizedText(
                            activeLanguage,
                            {
                              en: location.address.en,
                              mm: location.address.mm,
                              fallback:
                                location.address.en ??
                                location.address.mm ??
                                null,
                            }
                          ).trim();
                          const locationDescription = pickLocalizedText(
                            activeLanguage,
                            {
                              en: location.description.en,
                              mm: location.description.mm,
                              fallback: t(
                                "relatedLocations.noDescriptionAvailable"
                              ),
                            }
                          ).trim();
                          const locationGallery = createGalleryFromUrls(
                            location.image_urls,
                            locationName
                          );

                          return (
                            <article
                              key={location.id}
                              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-blue-100 transition hover:border-blue-300 hover:shadow-blue-200"
                            >
                              <div className="relative h-48 overflow-hidden">
                                {locationGallery.length > 0 ? (
                                  <>
                                    <img
                                      src={locationGallery[0].src}
                                      alt={locationGallery[0].alt}
                                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                      loading="lazy"
                                    />
                                    {locationGallery.length > 1 ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openModal(
                                            locationName,
                                            locationGallery,
                                            0
                                          )
                                        }
                                        className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 backdrop-blur transition hover:bg-white"
                                      >
                                        <Camera className="h-3 w-3" />
                                        {locationGallery.length} photos
                                      </button>
                                    ) : null}
                                  </>
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
                                    No images available
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-1 flex-col justify-between p-5">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <h3 className="text-lg font-semibold text-slate-900">
                                      {locationName}
                                    </h3>
                                    {locationTag ? (
                                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                        {locationTag}
                                      </span>
                                    ) : null}
                                  </div>
                                  {locationAddress ? (
                                    <p className="text-xs text-blue-600/80">
                                      {locationAddress}
                                    </p>
                                  ) : null}
                                  <p className="text-sm text-slate-600 line-clamp-3">
                                    {locationDescription}
                                  </p>
                                </div>
                                <div className="mt-4 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openModal(
                                        locationName,
                                        locationGallery,
                                        0
                                      )
                                    }
                                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                                  >
                                    <Camera className="h-3 w-3" />
                                    View Photos
                                  </button>
                                  <Link
                                    to={`/landmark-map/${city.id}?location=${location.id}`}
                                    className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                  >
                                    <Navigation className="h-3 w-3" />
                                    View on Map
                                  </Link>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* <div className="mt-10" id="plan-your-trip">
                <SectionHeading
                  icon={Navigation}
                  title="Popular Routes"
                  subtitle={`Preview three must-see stops on your ${displayCityName} itinerary`}
                />
                {visitCards.length ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {visitCards.slice(0, 2).map((spot) => (
                      <div
                        key={spot.name}
                        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-blue-100 transition hover:border-blue-300 hover:shadow-blue-200"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-semibold text-slate-900">
                              {spot.name}
                            </h3>
                            {spot.address ? (
                              <p className="mt-1 text-sm text-blue-600">
                                {spot.address}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs uppercase tracking-wide text-blue-700 transition hover:bg-blue-100"
                            onClick={() => openModal(spot.name, spot.images)}
                          >
                            <Camera className="h-4 w-4" />
                            View photos
                          </button>
                        </div>
                        <p className="mt-4 text-sm text-slate-600">
                          {spot.description}
                        </p>
                        {spot.highlights ? (
                          <ul className="mt-4 space-y-2 text-sm text-slate-600">
                            {spot.highlights.map((highlight) => (
                              <li
                                key={`${spot.name}-${highlight}`}
                                className="flex items-start gap-2"
                              >
                                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
                                {highlight}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySectionMessage message="Live routes will appear once locations are tagged for this city." />
                )}
              </div> */}
              </section>
            ) : null}

            {/* Category-based Location Sections */}
            {activeTab !== "profile" ? (
              <section className="mt-16 space-y-12">
                <SectionHeading
                  icon={MapPin}
                  title={t(`categories.${activeTab}`)}
                  subtitle={t("locations.filterByCategory")}
                />

                {/* Locations Display */}
                <div className="space-y-10">
                  {(() => {
                    const categoryLocations = locationCards.filter(
                      (loc) => loc.category === activeTab
                    );

                    return categoryLocations.length ? (
                      categoryLocations.map((location) => (
                        <div
                          key={location.id}
                          className="flex flex-col gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-blue-100 lg:flex-row"
                        >
                          <div className="lg:w-5/12">
                            <ImageCarousel
                              images={location.images}
                              altPrefix={location.name}
                              onImageClick={(index) =>
                                openModal(location.name, location.images, index)
                              }
                            />
                          </div>
                          <div className="flex flex-1 flex-col justify-between space-y-4">
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-2xl font-semibold text-slate-900">
                                  {location.name}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                  {location.type && (
                                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs uppercase tracking-wide text-blue-700">
                                      {location.type.replace(/_/g, " ")}
                                    </span>
                                  )}
                                  {location.address && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                                      <MapPin className="h-3.5 w-3.5" />
                                      {location.address}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p
                                className={`mt-3 text-sm text-slate-600 ${
                                  activeLanguage === "mm"
                                    ? "leading-relaxed"
                                    : ""
                                } min-h-[200px] max-h-[200px] overflow-y-auto pr-1`}
                              >
                                {location.description}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  openModal(location.name, location.images)
                                }
                                className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
                              >
                                <Camera className="h-4 w-4" />
                                {t("common.openGallery", "Open gallery")}
                              </button>
                              <Link
                                to={`/landmark-map/${city.id}?location=${location.id}`}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Navigation className="h-4 w-4" />
                                {t("common.viewOnMap", "View on Map")}
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                        <p className="text-lg text-slate-600">
                          {t("locations.noLocationsFound")}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {t("locations.tryAnotherCategory")}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </section>
            ) : null}
          </div>
        </main>

        {modalState.open ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 px-4 py-6">
            <div
              className="absolute inset-0"
              onClick={closeModal}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-6xl rounded-3xl border border-slate-200 bg-white p-6 backdrop-blur-lg">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {modalState.title}
                  </h3>
                  <p className="text-xs uppercase tracking-[0.3em] text-blue-600">
                    {t("modal.photoCollection")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {activeModalImage ? (
                    <img
                      src={formatImageUrl(activeModalImage.src)}
                      alt={activeModalImage.alt}
                      className="max-h-[480px] w-full object-contain"
                    />
                  ) : (
                    <p className="text-sm text-slate-600">
                      {t("modal.noImagesAvailable")}
                    </p>
                  )}
                </div>
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                  {modalState.images.length ? (
                    modalState.images.map((image, index) => (
                      <button
                        key={`${modalState.title}-modal-${index}`}
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition ${
                          lightboxIndex === index
                            ? "border-blue-200 bg-blue-50"
                            : "border-slate-200 bg-white hover:border-blue-200"
                        }`}
                      >
                        <span className="h-20 w-28 overflow-hidden rounded-xl">
                          <img
                            src={formatImageUrl(image.src)}
                            alt={image.alt}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <span className="text-sm text-slate-700">
                          {image.alt}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">
                      {t("modal.onceImagesAdded")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
