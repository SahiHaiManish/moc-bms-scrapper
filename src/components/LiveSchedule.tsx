"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addMinutes, isAfter, isBefore, parseISO } from "date-fns";

import DateStrip from "./DateStrip";
import ShowSection from "./ShowSection";

import { bucketByDate, dateKey, dayTitle, pickDate } from "@/lib/calendar";
import { Show, groupShows, isDisplayed } from "@/lib/groupShows";
import { showKey } from "@/lib/showKey";

/** A show counts as "live now" for this long after its start time. */
const LIVE_WINDOW_MIN = 30;

/**
 * Featured listings float to the front of their section (Tonight, Friday,
 * Coming Soon...) instead of sitting in time order. Set to false to keep
 * strict chronological order and rely on the tag + gold border alone.
 */
const PIN_FEATURED_FIRST = true;

const NONE: string[] = [];

interface Props {
  shows: Show[];
  featuredIds?: string[];
  videos?: Record<string, string>;
}

export default function LiveSchedule({
  shows,
  featuredIds = NONE,
  videos,
}: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);

    return () => clearInterval(timer);
  }, []);

  // Everything upcoming, plus the show that is on stage right now. The date
  // strip and a picked day use all of it, so Mon-Thu can be looked up.
  const listed = useMemo(
    () =>
      shows.filter((show) =>
        isAfter(addMinutes(parseISO(show.startDate), LIVE_WINDOW_MIN), now)
      ),
    [shows, now]
  );

  // The default "All" view leaves out mid-week days (isDisplayed): they would
  // repeat the same mics down the page. They appear under "Tonight" on the day.
  const advertised = useMemo(
    () => listed.filter((show) => isDisplayed(show, now)),
    [listed, now]
  );

  const liveShow = useMemo(
    () =>
      listed.find((show) => isBefore(parseISO(show.startDate), now)),
    [listed, now]
  );

  // ---- Calendar ------------------------------------------------------------

  const days = useMemo(() => bucketByDate(listed, now), [listed, now]);

  const [picked, setPicked] = useState<string | null>(null);

  // A shared link like /?date=2026-10-10 opens straight on that day.
  useEffect(() => {
    setPicked(new URLSearchParams(window.location.search).get("date"));
  }, []);

  // Only honour a date that still has shows (an old link, or midnight passing,
  // quietly falls back to "All").
  const activeDate = pickDate(picked, days);

  // "Next up" must be a card that is on screen: from the full list when a day
  // is picked, otherwise from what "All" displays.
  const nextShow = useMemo(
    () => (activeDate ? listed : advertised).find((show) => parseISO(show.startDate) > now),
    [activeDate, listed, advertised, now]
  );

  const selectDate = useCallback((key: string | null) => {
    setPicked(key);

    try {
      const url = new URL(window.location.href);

      if (key) url.searchParams.set("date", key);
      else url.searchParams.delete("date");

      window.history.replaceState(null, "", url.toString());
    } catch {
      /* URL can't be updated here (e.g. sandboxed preview): the filter still works */
    }
  }, []);

  const sections = useMemo(() => {
    const day = days.find((d) => d.key === activeDate);

    const grouped = day
      ? [
          {
            title: dayTitle(day),
            shows: listed.filter((s) => dateKey(s.startDate) === day.key),
          },
        ]
      : groupShows(advertised, now);

    if (!PIN_FEATURED_FIRST) return grouped;

    const featured = new Set(featuredIds);

    return grouped.map((section) => ({
      ...section,
      // stable: featured first, everything else keeps its time order
      shows: [
        ...section.shows.filter((s) => featured.has(s.eventId)),
        ...section.shows.filter((s) => !featured.has(s.eventId)),
      ],
    }));
  }, [listed, advertised, featuredIds, days, activeDate, now]);

  return (
    <>
      {days.length > 1 && (
        <DateStrip
          buckets={days}
          total={advertised.length}
          selected={activeDate}
          onSelect={selectDate}
        />
      )}

      {sections.map((section) => (
        <ShowSection
          key={section.title}
          title={section.title}
          shows={section.shows}
          featuredIds={featuredIds}
          videos={videos}
          nextKey={nextShow && showKey(nextShow)}
          liveKey={liveShow && showKey(liveShow)}
        />
      ))}
    </>
  );
}
