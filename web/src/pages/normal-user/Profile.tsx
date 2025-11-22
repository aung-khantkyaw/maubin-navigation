import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Header } from "@/components/header";
import {
  BadgeCheck,
  CalendarClock,
  Globe2,
  Route as RouteIcon,
  ShieldCheck,
  UserRound,
  UserPlus,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000";

type RouteHistoryItem = {
  id?: string;
  route_id?: string;
  start_name?: string;
  start_address?: string;
  end_name?: string;
  end_address?: string;
  distance?: number;
  duration_min?: number;
  created_at?: string;
};

export default function Profile() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState({
    username: "",
    email: "",
    user_type: "normal_user",
    is_admin: false,
  });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryItem[]>([]);

  useEffect(() => {
    // Load user info from localStorage or backend
    const storedUser = window.localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({
          username: parsed.username || "",
          email: parsed.email || "",
          user_type: parsed.user_type || "normal_user",
          is_admin: parsed.is_admin || false,
        });
      } catch {
        // Ignore JSON parse errors, fallback to default user state
      }
    }
    // Fetch route history from backend
    const token = window.localStorage.getItem("access_token");
    if (token) {
      fetch(`${API_BASE_URL}/routes/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setRouteHistory(data?.data ?? []))
        .catch(() => setRouteHistory([]));
    }
  }, []);

  const stats = useMemo(() => {
    const totalDistanceMeters = routeHistory.reduce(
      (sum, entry) => sum + (entry.distance ?? 0),
      0
    );
    const totalDurationMinutes = routeHistory.reduce(
      (sum, entry) => sum + (entry.duration_min ?? 0),
      0
    );
    const latestTrip = routeHistory[0]?.created_at;
    const averageDuration =
      routeHistory.length > 0 ? totalDurationMinutes / routeHistory.length : 0;

    return [
      {
        label: t("profilePage.stats.tripsLabel"),
        value:
          routeHistory.length > 0
            ? String(routeHistory.length)
            : t("profilePage.stats.tripsEmpty"),
        icon: RouteIcon,
      },
      {
        label: t("profilePage.stats.distanceLabel"),
        value:
          totalDistanceMeters > 0
            ? t("profilePage.units.kilometers", {
                value: (totalDistanceMeters / 1000).toFixed(1),
              })
            : t("profilePage.units.kilometers", { value: 0 }),
        icon: Globe2,
      },
      {
        label: t("profilePage.stats.avgDurationLabel"),
        value:
          averageDuration > 0
            ? t("profilePage.units.minutes", {
                value: Math.round(averageDuration),
              })
            : t("profilePage.stats.avgDurationEmpty"),
        icon: CalendarClock,
      },
      {
        label: t("profilePage.stats.latestTripLabel"),
        value: latestTrip
          ? new Date(latestTrip).toLocaleDateString()
          : t("profilePage.stats.latestTripEmpty"),
        icon: BadgeCheck,
      },
    ];
  }, [routeHistory, t]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = window.localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_BASE_URL}/user/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ ...user, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.is_success) {
        toast.error(data?.msg || t("profilePage.notifications.updateFailure"));
      } else {
        toast.success(t("profilePage.notifications.updateSuccess"));
        window.localStorage.setItem("user", JSON.stringify({ ...user }));
      }
    } catch {
      toast.error(t("profilePage.notifications.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <div className="relative min-h-screen flex flex-col bg-gradient-to-b from-slate-100 via-white to-slate-100 text-slate-900">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-slate-100" />
          <div className="absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),transparent_60%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/60 to-transparent" />
        </div>

        <main className="relative z-10 flex-1">
          <div className="container mx-auto px-4 pb-16 pt-12 lg:px-8">
            <section className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  {t("profilePage.badge")}
                </span>
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
                    {t("profilePage.title")}
                  </h1>
                  <p className="mt-4 text-base text-slate-600 sm:text-lg">
                    {t("profilePage.subtitle")}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {stats.map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          {label}
                        </span>
                        <Icon className="size-4 text-emerald-500 transition group-hover:text-emerald-600" />
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-900">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative space-y-4">
                <div className="absolute -inset-4 rounded-3xl bg-emerald-200/60 blur-3xl opacity-60" />
                <div className="relative flex items-center gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-lg">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 shadow">
                    <UserRound className="size-7" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">
                      {t("profilePage.signedInAs")}
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {user.username || t("roles.user")}
                    </p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                {user.is_admin ? (
                  <button
                    onClick={() => navigate("/admin/dashboard")}
                    className="relative w-full flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 px-6 py-4 text-sm font-semibold text-blue-700 shadow-lg transition hover:border-blue-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <ShieldCheck className="size-5" />
                    <span>{t("profilePage.buttons.admin")}</span>
                  </button>
                ) : user.user_type === "collaborator" ? (
                  <button
                    onClick={() => navigate("/collaborator/dashboard")}
                    className="relative w-full flex items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-teal-50 to-emerald-50 px-6 py-4 text-sm font-semibold text-cyan-700 shadow-lg transition hover:border-cyan-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  >
                    <BadgeCheck className="size-5" />
                    <span>{t("profilePage.buttons.collaborator")}</span>
                  </button>
                ) : user.user_type === "normal_user" ? (
                  <button
                    onClick={() => navigate("/collaborator-request")}
                    className="relative w-full flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 px-6 py-4 text-sm font-semibold text-emerald-700 shadow-lg transition hover:border-emerald-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <UserPlus className="size-5" />
                    <span>{t("profilePage.buttons.upgrade")}</span>
                  </button>
                ) : null}
              </div>
            </section>

            <section className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 text-blue-600 shadow">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                      {t("profilePage.account.title")}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {t("profilePage.account.subtitle")}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpdate} className="mt-8 grid gap-6">
                  <label className="space-y-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-slate-600">
                      <UserRound className="size-4 text-emerald-500" />
                      {t("profilePage.account.nameLabel")}
                    </span>
                    <input
                      type="text"
                      value={user.username}
                      onChange={(e) =>
                        setUser((u) => ({ ...u, username: e.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-inner shadow-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      required
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-slate-600">
                      <Globe2 className="size-4 text-emerald-500" />
                      {t("profilePage.account.emailLabel")}
                    </span>
                    <input
                      type="email"
                      value={user.email}
                      onChange={(e) =>
                        setUser((u) => ({ ...u, email: e.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-inner shadow-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      required
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-slate-600">
                      <ShieldCheck className="size-4 text-emerald-500" />
                      {t("profilePage.account.passwordLabel")}
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-inner shadow-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      placeholder={
                        t("profilePage.account.passwordPlaceholder") ??
                        undefined
                      }
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 px-4 py-3 text-base font-semibold text-white shadow-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60",
                      loading && "animate-pulse"
                    )}
                  >
                    {loading
                      ? t("profilePage.account.saving")
                      : t("profilePage.account.save")}
                  </button>
                </form>
              </div>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                      {t("profilePage.history.title")}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {t("profilePage.history.subtitle")}
                    </p>
                  </div>
                </div>

                {routeHistory.length === 0 ? (
                  <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500">
                    <RouteIcon className="mb-4 size-10 text-emerald-400" />
                    <h3 className="text-lg font-semibold text-slate-900">
                      {t("profilePage.history.emptyTitle")}
                    </h3>
                    <p className="mt-2 max-w-sm text-sm text-slate-500">
                      {t("profilePage.history.emptyDescription")}
                    </p>
                  </div>
                ) : (
                  <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="max-h-[420px] overflow-y-auto">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">
                              {t("profilePage.history.table.from")}
                            </th>
                            <th className="px-4 py-3">
                              {t("profilePage.history.table.to")}
                            </th>
                            <th className="px-4 py-3">
                              {t("profilePage.history.table.distance")}
                            </th>
                            <th className="px-4 py-3">
                              {t("profilePage.history.table.duration")}
                            </th>
                            <th className="px-4 py-3">
                              {t("profilePage.history.table.date")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {routeHistory.map((route, idx) => {
                            const key = route.id ?? route.route_id ?? `${idx}`;
                            return (
                              <tr
                                key={key}
                                className="transition hover:bg-slate-50"
                              >
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {route.start_name ||
                                    route.start_address ||
                                    "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {route.end_name || route.end_address || "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {route.distance
                                    ? t("profilePage.units.kilometers", {
                                        value: (route.distance / 1000).toFixed(
                                          2
                                        ),
                                      })
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {route.duration_min
                                    ? t("profilePage.units.minutes", {
                                        value: Math.round(route.duration_min),
                                      })
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {route.created_at
                                    ? new Date(
                                        route.created_at
                                      ).toLocaleString()
                                    : "—"}
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
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
