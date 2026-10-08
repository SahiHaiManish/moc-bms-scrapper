"use client";

import { useEffect, useState } from "react";
import { isAfter, format, parseISO } from "date-fns";
import { mono } from "@/lib/fonts";
import { Show } from "@/lib/groupShows";
import { showKey } from "@/lib/showKey";

export default function ShowBoard({ shows }: { shows: Show[] }) {
  const [index, setIndex] = useState(0);

  const now = new Date();

  const upcomingShows = shows.filter((show) =>
    isAfter(parseISO(show.startDate), now)
  );

  // Hooks must run on every render, so they sit above the early return below.
  // (Returning first made React crash once the last show of the night passed.)
  useEffect(() => {
    if (upcomingShows.length === 0) return;

    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % upcomingShows.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [upcomingShows.length]);

  if (upcomingShows.length === 0) {
    return null;
  }

  const show = upcomingShows[index % upcomingShows.length];

  const boardTitle = show.title
    .replace(" - Standup Comedy Live", "")
    .replace(" StandUp Show!", "")
    .replace("! (Koramangala)", "")
    .trim();

  return (
    // Fixed minimum height: titles of different lengths used to resize the
    // band every 4 seconds, which shoved the whole page up and down on phones.
    <div className="flex min-h-[6.6rem] items-center justify-center overflow-hidden bg-zinc-900 px-4 py-3 text-center sm:min-h-0 sm:py-4">
      <div key={showKey(show)} className="animate-fade w-full max-w-3xl">
        <a
          href={show.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block cursor-pointer transition-colors hover:bg-zinc-800"
        >
          <p className="text-[11px] uppercase tracking-[0.25em] text-yellow-400 sm:tracking-[0.35em]">
            {format(parseISO(show.startDate), "EEE • d MMM • h:mm a")}
          </p>

          <h2
            className={`${mono.className} mt-2 line-clamp-2 text-base font-medium tracking-wide text-white sm:text-xl md:text-2xl`}
          >
            {boardTitle}
          </h2>
        </a>
      </div>
    </div>
  );
}
