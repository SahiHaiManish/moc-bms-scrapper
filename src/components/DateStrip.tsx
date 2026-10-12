"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DayBucket, spokenDay } from "@/lib/calendar";

interface Props {
  buckets: DayBucket[];
  /** number of shows across all dates (shown on the "All" chip) */
  total: number;
  /** selected date key, or null for "All" */
  selected: string | null;
  onSelect: (key: string | null) => void;
}

const chipBase =
  "relative flex w-[3.75rem] shrink-0 snap-start flex-col items-center rounded-xl border px-1 py-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 sm:w-[4.25rem]";

const chipOn = "border-yellow-400 bg-yellow-400 text-black";
const chipOff = "border-zinc-800 bg-zinc-900 text-white hover:border-zinc-600";

/**
 * Horizontal date picker. One chip per day that has shows, so there are no
 * dead ends: every date you can tap leads to a list.
 */
export default function DateStrip({ buckets, total, selected, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;

    if (!el) return;

    setEdge({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();

    const el = scroller.current;

    if (!el) return;

    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, buckets.length]);

  // Keep the chosen chip in view (e.g. when arriving from a ?date= link).
  // Scrolls the strip itself, never the page.
  useEffect(() => {
    const el = scroller.current;
    const chip = el?.querySelector<HTMLElement>(`[data-key="${selected ?? "all"}"]`);

    if (!el || !chip) return;

    el.scrollTo({
      left: chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [selected]);

  const nudge = (direction: 1 | -1) =>
    scroller.current?.scrollBy({
      left: direction * scroller.current.clientWidth * 0.8,
      behavior: "smooth",
    });

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-8 border-b border-zinc-900 bg-black/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex items-center gap-2">

        <button
          type="button"
          aria-label="Earlier dates"
          onClick={() => nudge(-1)}
          disabled={!edge.left}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-zinc-300 transition hover:border-zinc-600 disabled:pointer-events-none disabled:opacity-30 sm:flex"
        >
          <ChevronLeft size={18} />
        </button>

        <div
          ref={scroller}
          role="group"
          aria-label="Filter shows by date"
          className="flex flex-1 snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >

          <button
            type="button"
            data-key="all"
            aria-pressed={selected === null}
            onClick={() => onSelect(null)}
            className={`${chipBase} ${selected === null ? chipOn : chipOff}`}
          >
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${selected === null ? "text-black/70" : "text-zinc-400"}`}>
              All
            </span>
            <span className="text-xl font-extrabold leading-tight tabular-nums">{total}</span>
            <span className={`text-[10px] uppercase tracking-widest ${selected === null ? "text-black/70" : "text-zinc-500"}`}>
              shows
            </span>
            <span className="mt-1 h-1.5" />
          </button>

          {buckets.map((b) => {
            const on = selected === b.key;

            return (
              <button
                key={b.key}
                type="button"
                data-key={b.key}
                aria-pressed={on}
                aria-label={spokenDay(b)}
                onClick={() => onSelect(b.key)}
                className={`${chipBase} ${on ? chipOn : chipOff}`}
              >
                <span className={`text-[10px] font-semibold uppercase tracking-widest ${on ? "text-black/70" : b.isToday ? "text-yellow-400" : "text-zinc-400"}`}>
                  {b.isToday ? "Today" : b.weekday}
                </span>

                <span className="text-xl font-extrabold leading-tight tabular-nums">{b.day}</span>

                <span className={`text-[10px] uppercase tracking-widest ${on ? "text-black/70" : "text-zinc-500"}`}>
                  {b.month}
                </span>

                {/* one dot per show, up to three */}
                <span className="mt-1 flex h-1.5 items-center gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(b.count, 3) }).map((_, i) => (
                    <span key={i} className={`h-1.5 w-1.5 rounded-full ${on ? "bg-black/70" : "bg-yellow-400"}`} />
                  ))}
                </span>
              </button>
            );
          })}

        </div>

        <button
          type="button"
          aria-label="Later dates"
          onClick={() => nudge(1)}
          disabled={!edge.right}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-zinc-300 transition hover:border-zinc-600 disabled:pointer-events-none disabled:opacity-30 sm:flex"
        >
          <ChevronRight size={18} />
        </button>

      </div>
    </div>
  );
}
