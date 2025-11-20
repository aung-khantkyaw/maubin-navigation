import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import timelineData from "../data/myanmar-timeline.json";

export interface TimelineEntry {
  id: string;
  period: string; // e.g. "Bagan Era"
  range: string; // e.g. "1044 – 1287"
  summary: string;
  details: string;
  icon?: string; // emoji or icon code
  colorClass?: string; // tailwind accent color override
}

const TIMELINE: TimelineEntry[] = timelineData as TimelineEntry[];

interface HistoryTimelineProps {
  initialExpanded?: boolean;
}

export function HistoryTimeline({
  initialExpanded = false,
}: HistoryTimelineProps) {
  const [openId, setOpenId] = useState<string | null>(
    initialExpanded ? TIMELINE[0].id : null
  );
  const { t } = useTranslation();
  const listRef = useRef<HTMLOListElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const ids = TIMELINE.map((t) => t.id);

  const focusItem = useCallback((id: string) => {
    const el = itemRefs.current[id];
    if (el) {
      const btn = el.querySelector(
        'button[data-trigger="expand"]'
      ) as HTMLElement | null;
      btn?.focus();
      el.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, []);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return;
      const currentIdx = ids.findIndex((id) => active.dataset.id === id);
      if (currentIdx === -1) return;
      let nextIdx = currentIdx;
      if (["ArrowDown"].includes(e.key)) {
        nextIdx = Math.min(ids.length - 1, currentIdx + 1);
      } else if (["ArrowUp"].includes(e.key)) {
        nextIdx = Math.max(0, currentIdx - 1);
      } else if (e.key === "Home") {
        nextIdx = 0;
      } else if (e.key === "End") {
        nextIdx = ids.length - 1;
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const id = ids[currentIdx];
        setOpenId((prev) => (prev === id ? null : id));
        return;
      } else {
        return;
      }
      e.preventDefault();
      focusItem(ids[nextIdx]);
    },
    [ids, focusItem]
  );

  // No horizontal progress needed for vertical layout.

  return (
    <div className="relative">
      <ol
        ref={listRef}
        className="relative space-y-14 md:space-y-20"
        role="list"
        aria-label="Myanmar historical periods"
        onKeyDown={handleKey}
      >
        {TIMELINE.map((entry, index) => {
          const isOpen = openId === entry.id;
          const isEven = index % 2 === 0;
          return (
            <li
              key={entry.id}
              ref={(node) => {
                itemRefs.current[entry.id] = node;
              }}
              className="relative"
            >
              {/* Central node */}
              <span
                className="absolute left-1/2 top-2 -translate-x-1/2 h-5 w-5 rounded-full border-2 border-white bg-emerald-500 shadow ring-2 ring-emerald-200"
                aria-hidden
              />
              <div
                data-id={entry.id}
                className={
                  "relative md:w-1/2 " +
                  (isEven
                    ? "md:pr-10 md:ml-0 md:mr-auto"
                    : "md:pl-10 md:ml-auto md:mr-0")
                }
              >
                <div
                  className={
                    "rounded-md border border-emerald-100 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md hover:border-emerald-300 md:max-w-xl " +
                    (isEven ? "md:text-right" : "md:text-left")
                  }
                >
                  <div
                    className={
                      "flex items-start gap-3 " +
                      (isEven ? "md:flex-row-reverse md:justify-end" : "")
                    }
                  >
                    {entry.icon && (
                      <span className="text-xl select-none" aria-hidden>
                        {entry.icon}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-slate-800 leading-tight">
                        <span className="text-emerald-600 mr-1">
                          {index + 1}.
                        </span>
                        {entry.period}
                      </h3>
                      <span className="inline-block mt-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700/90 bg-emerald-50 px-2 py-0.5 rounded">
                        {entry.range}
                      </span>
                    </div>
                    <button
                      type="button"
                      data-trigger="expand"
                      data-id={entry.id}
                      onClick={() => setOpenId(isOpen ? null : entry.id)}
                      aria-expanded={isOpen}
                      aria-controls={`timeline-panel-${entry.id}`}
                      className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium shadow-sm transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <span className="sr-only">
                        {isOpen ? t("timeline.collapse") : t("timeline.expand")}{" "}
                        {entry.period}
                      </span>
                      <span
                        aria-hidden
                        className="transition-transform duration-300"
                        style={{
                          transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                        }}
                      >
                        +
                      </span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    {entry.summary}
                  </p>
                  <ExpandablePanel
                    id={`timeline-panel-${entry.id}`}
                    open={isOpen}
                  >
                    <p>{entry.details}</p>
                  </ExpandablePanel>
                </div>
                <span
                  className="hidden md:block absolute top-6 left-1/2 -translate-x-1/2 w-10 h-px bg-emerald-300"
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ol>
      {/* Central vertical line */}
      <span
        className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-gradient-to-b from-emerald-300 via-emerald-200 to-emerald-300 pointer-events-none"
        aria-hidden
      />
    </div>
  );
}

// Animated expandable panel component (height transition with auto-measure)
interface ExpandablePanelProps {
  id: string;
  open: boolean;
  children: React.ReactNode;
}

function ExpandablePanel({ id, open, children }: ExpandablePanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <div
      id={id}
      aria-hidden={!open}
      className={
        "transition-all duration-300 overflow-hidden text-sm text-slate-700 " +
        (open ? "mt-2 opacity-100" : "h-0 opacity-0")
      }
      style={
        open && ref.current ? { height: ref.current.scrollHeight } : undefined
      }
    >
      <div ref={ref} className="space-y-3 pb-1">
        {children}
      </div>
    </div>
  );
}

export default HistoryTimeline;
