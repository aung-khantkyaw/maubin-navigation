import type { CSSProperties } from "react";
import Header from "@/components/common/Header";
import { useTranslation } from "react-i18next";
import "@/assets/styles/home.css";

type StatCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
};

type GalleryItem = {
  src: string;
  alt: string;
};

export default function Home() {
  const { t } = useTranslation(["home", "common"]);
  const lineSpacingClass = "leading-relaxed md:leading-[1.9]";

  const stats: StatCard[] = ["population", "area"].map((key) => ({
    key,
    label: t(`home:profile.stats.${key}.label`),
    value: t(`home:profile.stats.${key}.value`),
    detail: t(`home:profile.stats.${key}.detail`),
  }));

  const gallery =
    (t("home:gallery.items", { returnObjects: true }) as GalleryItem[]) || [];
  const galleryPattern: CSSProperties[] = [
    {
      gridColumnStart: 1,
      gridColumnEnd: 2,
      gridRow: "span 6 / span 6",
    },
    {
      gridColumn: "span 2 / span 2",
      gridRow: "span 2 / span 2",
    },
    {
      gridRow: "span 2 / span 2",
      gridColumnStart: 4,
    },
    {
      gridRow: "span 2 / span 2",
      gridColumnStart: 2,
      gridRowStart: 3,
    },
    {
      gridRow: "span 2 / span 2",
      gridColumnStart: 3,
      gridRowStart: 3,
    },
    {
      gridRow: "span 4 / span 4",
      gridColumnStart: 4,
      gridRowStart: 3,
    },
    {
      gridRow: "span 2 / span 2",
      gridColumnStart: 2,
      gridRowStart: 5,
    },
    {
      gridRow: "span 2 / span 2",
      gridColumnStart: 3,
      gridRowStart: 5,
    },
  ];

  const quickLinks = [
    { href: "/", label: t("common:footer.links.home") },
    { href: "/map", label: t("common:footer.links.map") },
  ];

  const supportLinks = [
    {
      href: "mailto:aungkhantkyaw.info@gmail.com",
      label: t("common:footer.support.email"),
    },
  ];

  return (
    <div className="flex flex-col bg-slate-50">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-10 flex flex-1 w-full flex-col items-center justify-center">
        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-emerald-600">
              {t("home:profile.pretitle")}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {t("home:profile.title")}
            </h1>
            <p className={`mt-4 text-base text-slate-600 ${lineSpacingClass}`}>
              {t("home:profile.description")}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {stats.map((stat) => (
                <div
                  key={stat.key}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p
                    className={`mt-2 text-3xl font-semibold text-slate-900 ${lineSpacingClass}`}
                  >
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-500">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl self-start w-full mt-6">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gridTemplateRows: "repeat(6, minmax(0, 1fr))",
              maxHeight: "600px",
            }}
          >
            {gallery.map((item, index) => (
              <div
                key={item.src}
                className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-100"
                style={galleryPattern[index] ?? undefined}
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </aside>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-12 text-slate-600">
          <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
                <span className="size-1 rounded-full bg-emerald-400" />
                {t("common:footer.badge")}
              </span>
              <h3 className="text-2xl font-semibold text-slate-900">
                {t("common:footer.title")}
              </h3>
              <p className="text-sm text-slate-500">
                {t("common:footer.tagline")}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t("common:footer.linksTitle")}
              </h4>
              <ul className="mt-4 space-y-3 text-sm">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="inline-flex items-center gap-2 text-slate-600 transition hover:text-emerald-600"
                    >
                      <span className="h-px w-5 bg-emerald-400/60" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t("common:footer.supportTitle")}
              </h4>
              <ul className="mt-4 space-y-3 text-sm">
                {supportLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="inline-flex items-center gap-2 text-slate-600 transition hover:text-emerald-600"
                    >
                      <span className="size-2 rounded-full border border-emerald-400/60" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {new Date().getFullYear()} {t("common:footer.copyright")}
            </span>
            <span className="flex items-center gap-2 text-slate-500">
              <span className="size-2 rounded-full bg-emerald-400/80" />
              {t("common:footer.status")}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
