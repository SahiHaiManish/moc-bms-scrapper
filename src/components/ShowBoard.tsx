"use client";

import { useEffect, useState } from "react";
import { isAfter, format, parseISO } from "date-fns";
import { bebas } from "@/lib/fonts";
import { mono } from "@/lib/fonts";
import { Show } from "@/lib/groupShows";


export default function ShowBoard({
  shows,
}: {
  shows: Show[];
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % upcomingShows.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [shows.length]);


const upcomingShows = shows.filter((show) =>
  isAfter(parseISO(show.startDate), new Date())
);

if (upcomingShows.length === 0) {
  return null;
}
  
const show = upcomingShows[index];

const boardTitle = show.title
  .replace(" - Standup Comedy Live", "")
  .replace(" StandUp Show!", "")
  .replace("! (Koramangala)", "")
  .trim();

  return (


<div className="border-y border-zinc-800 py-3 text-center overflow-hidden">
      <div
        key={show.startDate}
        className="animate-fade"
      >
<a
  href={show.bookingUrl}
  target="_blank"
  rel="noopener noreferrer"
className="block cursor-pointer transition-colors hover:bg-zinc-950"
>
<p className="text-[11px] tracking-[0.35em] uppercase text-yellow-400">
  {format(parseISO(show.startDate), "EEE • d MMM • h:mm a")}
</p>

<h2 className={`${mono.className} mt-2 text-xl md:text-2xl font-medium tracking-wide text-white`}>
  {boardTitle}
</h2>
</a>
      </div>
    </div>
  );
}
