"use client";

import { useEffect, useMemo, useState } from "react";
import { addMinutes, isAfter, isBefore, parseISO } from "date-fns";

import FeaturedShow from "./FeaturedShow";
import NextShow from "./NextShow";
import ShowSection from "./ShowSection";

import { Show, groupShows } from "@/lib/groupShows";

interface Props {
  shows: Show[];
  featuredIds?: string[];
  videos?: Record<string, string>;
}


export default function LiveSchedule({
  shows,
 featuredIds = [],
  videos,
}: Props) {

useEffect(() => {
  const timer = setInterval(() => {
    setNow(new Date());
  }, 30000);

  return () => clearInterval(timer);
}, []);

const [now, setNow] = useState(new Date());
  const liveShow = useMemo(
    () =>
      shows.find((show) => {
        const start = parseISO(show.startDate);

        return (
          isBefore(start, now) &&
          isAfter(addMinutes(start, 30), now)
        );
      }),
    [shows, now]
  );

  const upcomingShows = useMemo(
    () =>
      shows.filter(
        (show) => parseISO(show.startDate) > now
      ),
    [shows, now]
  );

const featuredShow = useMemo(() => {
  let show = upcomingShows.find((s) =>
    featuredIds.includes(s.eventId)
  );

  if (!show) {
    show = upcomingShows[0];
  }

  return show;
}, [upcomingShows, featuredIds]);
  const sections = groupShows(upcomingShows);

  return (
  <>
  <div className="mb-16">
    <div className="flex flex-wrap justify-center gap-8">

      {liveShow && (
        <div className="w-full max-w-sm">
          <FeaturedShow
            show={liveShow}
            title="NOW PLAYING"
            live
            videoId={videos?.[liveShow.eventId]}
          />
        </div>
      )}

      {upcomingShows.length > 0 && (
        <div className="w-full max-w-sm">
          <NextShow
            shows={upcomingShows}
            videos={videos}
          />
        </div>
      )}

      {featuredShow &&
        featuredShow.eventId !== upcomingShows[0]?.eventId && (
          <div className="w-full max-w-sm">
            <FeaturedShow
              show={featuredShow}
              title="EDITOR'S PICK"
              featured
              videoId={videos?.[featuredShow.eventId]}
            />
          </div>
      )}

    </div>
  </div>

  {sections.map((section) => (
    <ShowSection
      key={section.title}
      title={section.title}
      shows={section.shows}
    />
  ))}
</> 
  );
}
