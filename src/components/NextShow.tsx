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

  return (
    shows.find(
      (show) => parseISO(show.startDate) > now
    ) ?? shows[0]
  );
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

  return (
    <FeaturedShow
      show={nextShow}
      title="NEXT UP"
      videoId={videos?.[nextShow.eventId]}
    />
  );
}
