"use client";

import { useEffect, useMemo, useState } from "react";
import { addMinutes, isAfter, isBefore, parseISO } from "date-fns";

import ShowSection from "./ShowSection";

import { Show, groupShows } from "@/lib/groupShows";
import { showKey } from "@/lib/showKey";

/** A show counts as "live now" for this long after its start time. */
const LIVE_WINDOW_MIN = 30;

/**
 * Featured listings float to the front of their section (Tonight, Friday,
 * Coming Soon...) instead of sitting in time order. Set to false to keep
 * strict chronological order and rely on the tag + gold border alone.
 */
const PIN_FEATURED_FIRST = false;

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

  // On the page: everything upcoming, plus the show that is on stage right now.
  const listed = useMemo(
    () =>
      shows.filter((show) =>
        isAfter(addMinutes(parseISO(show.startDate), LIVE_WINDOW_MIN), now)
      ),
    [shows, now]
  );

  const liveShow = useMemo(
    () =>
      listed.find((show) => isBefore(parseISO(show.startDate), now)),
    [listed, now]
  );

  const nextShow = useMemo(
    () => listed.find((show) => parseISO(show.startDate) > now),
    [listed, now]
  );

  const sections = useMemo(() => {
    const grouped = groupShows(listed);

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
  }, [listed, featuredIds]);

  return (
    <>
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
