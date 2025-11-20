import { useMemo } from "react";

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
};

type CityDetailTableProps = {
  cityDetails: AdminCityDetail[];
  cityLookup: Record<string, string>;
  onEdit: (detail: AdminCityDetail) => void;
  onDelete: (id: string) => void;
};

const PREDEFINED_TITLE_LABELS: Record<string, { mm: string; en: string }> = {
  introduction_and_history: {
    mm: "နိဒါန်း နှင့် ဒေသသမိုင်း",
    en: "Introduction and History",
  },
  geography: { mm: "ပထဝီဝင်အနေအထား", en: "Geography" },
  climate_and_environment: {
    mm: "ရာသီဥတုနှင့်သဘာဝပတ်ဝန်းကျင်",
    en: "Climate and Environment",
  },
  demographics: { mm: "လူဦးရေဆိုင်ရာအချက်အလက်များ", en: "Demographics" },
  administrative_info: {
    mm: "အုပ်ချုပ်ရေးဆိုင်ရာအချက်အလက်များ",
    en: "Administrative Information",
  },
  economic_info: {
    mm: "စီးပွားရေးဆိုင်ရာ အချက်အလက်များ",
    en: "Economic Information",
  },
  social_info: {
    mm: "လူမှုရေးဆိုင်ရာ အချက်အလက်များ",
    en: "Social Information",
  },
  religious_info: {
    mm: "ဘာသာရေးဆိုင်ရာအချက်အလက်များ",
    en: "Religious Information",
  },
  development_info: {
    mm: "ဒေသဖွံ့ဖြိုးရေးဆိုင်ရာအချက်အလက်များ",
    en: "Development Information",
  },
  general: { mm: "အထွေထွေ", en: "General" },
};

function resolveTitle(detail: AdminCityDetail): string {
  const labels = PREDEFINED_TITLE_LABELS[detail.predefined_title];
  if (!labels) return detail.predefined_title || "(No title)";
  return `${labels.mm} (${labels.en})`;
}

function resolveSubtitle(detail: AdminCityDetail): string {
  return detail.subtitle_en || detail.subtitle_mm || "";
}

function resolveBody(detail: AdminCityDetail): string {
  const body = detail.body_en || detail.body_mm || "";
  return body.length > 100 ? body.substring(0, 100) + "..." : body;
}

export default function CityDetailTable({
  cityDetails,
  cityLookup,
  onEdit,
  onDelete,
}: CityDetailTableProps) {
  const sortedDetails = useMemo(() => {
    return [...cityDetails].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [cityDetails]);

  if (!sortedDetails.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30 p-8 text-center backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100/60">
          <svg
            className="h-8 w-8 text-emerald-600"
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
        <p className="mt-4 text-sm font-medium text-slate-700">
          No city details found
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Create your first city detail entry to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-emerald-50/60 to-emerald-100/40 backdrop-blur shadow-2xl shadow-emerald-500/10">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-emerald-100/70 bg-emerald-50/80">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-emerald-800">
                City
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Title
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Body Preview
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Images
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-100/60">
            {sortedDetails.map((detail) => (
              <tr
                key={detail.id}
                className="transition-colors hover:bg-emerald-50/60"
              >
                <td className="px-6 py-4 text-sm text-slate-700">
                  {cityLookup[detail.city_id] || detail.city_id}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-slate-900">
                    {resolveTitle(detail)}
                  </div>
                  {resolveSubtitle(detail) && (
                    <div className="mt-1 text-xs text-slate-500 italic">
                      {resolveSubtitle(detail)}
                    </div>
                  )}
                  <div className="mt-1 flex gap-2">
                    {detail.subtitle_en && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        EN Subtitle
                      </span>
                    )}
                    {detail.subtitle_mm && (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                        MM Subtitle
                      </span>
                    )}
                  </div>
                </td>
                <td className="max-w-md px-6 py-4 text-sm text-slate-600">
                  {resolveBody(detail)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {Array.isArray(detail.image_urls)
                    ? detail.image_urls.length
                    : 0}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(detail)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100 hover:shadow-lg hover:shadow-emerald-200"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(detail.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-100 hover:shadow-lg hover:shadow-rose-200"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
