"use client";

import { useEffect, useState } from "react";
import { parseISO } from "date-fns";

import FeaturedShow from "./FeaturedShow";
import { Show } from "@/lib/groupShows";

interface Props {
  shows: Show[];
  videos?: Record<string, string>;
}

function getNextShow(shows: Show[]) {
  const now = new Date();

  const upcoming = shows.filter(
    (show) => parseISO(show.startDate) > now
  );

  return upcoming[0] ?? shows[0];
}

export default function NextShow({
  shows,
  videos,
}: Props) {
  const [nextShow, setNextShow] = useState(() =>
    getNextShow(shows)
  );

  useEffect(() => {
    const update = () => {
      setNextShow(getNextShow(shows));
    };

    update();

    const timer = setInterval(update, 30000);

    return () => clearInterval(timer);
  }, [shows]);

if (!nextShow) {
  return null;
}
  return (
    <FeaturedShow
      show={nextShow}
      title="NEXT UP"
      videoId={videos?.[nextShow.eventId]}
    />
  );
}
