"use client";

import { useState } from "react";
import Image from "next/image";
import { Calendar, Clock, Ticket } from "lucide-react";
import { parseISO } from "date-fns";
import { Show } from "@/lib/groupShows";

import { formatInTimeZone } from "date-fns-tz";

import Countdown from "./Countdown";

export type CardTag = "live" | "next" | "featured";

interface Props {
  show: Show;
  /** small labels shown on top of the poster */
  tags?: CardTag[];
  /** YouTube id; adds a play button that swaps the poster for the trailer */
  videoId?: string;
}

const chip =
  "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:px-3 sm:py-1 sm:text-xs";

export default function ShowCard({ show, tags = [], videoId }: Props) {

const start = parseISO(show.startDate);
const [playVideo, setPlayVideo] = useState(false);
const featured = tags.includes("featured");

  return (
    <article className={`group overflow-hidden rounded-2xl border bg-zinc-900 transition-all ${
      featured
        ? "border-yellow-500/60 shadow-lg shadow-yellow-500/10"
        : "border-zinc-800"
    } duration-300 hover:-translate-y-1 hover:border-yellow-400 hover:shadow-2xl hover:shadow-yellow-500/10`}>
      <div className="relative aspect-[16/9] overflow-hidden">
        {videoId && playVideo ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={show.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <Image
              src={show.image}
              alt={show.title}
              fill
              className="object-contain bg-zinc-950 p-2"
              sizes="(max-width: 768px) 100vw, 400px"
            />

            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/40 to-transparent" />

            {videoId && (
              <button
                type="button"
                aria-label={`Play trailer for ${show.title}`}
                onClick={() => setPlayVideo(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/10 transition hover:bg-black/30"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-xl">
                  ▶
                </span>
              </button>
            )}

            {tags.length > 0 && (
              <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1.5 sm:left-3 sm:top-3 sm:gap-2">
                {tags.includes("live") && (
                  <span className={`${chip} bg-red-600 text-white`}>
                    ● Live now
                  </span>
                )}

                {tags.includes("next") && (
                  <>
                    <span className={`${chip} bg-yellow-400 text-black`}>
                      Next up
                    </span>
                    <Countdown startDate={show.startDate} compact />
                  </>
                )}

                {featured && (
                  <span
                    className={`${chip} bg-black/70 text-yellow-300 ring-1 ring-yellow-400/60 backdrop-blur`}
                  >
                    ★ Featured
                  </span>
                )}
              </div>
            )}

            <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[11px] font-semibold text-black sm:bottom-4 sm:left-4 sm:px-3 sm:py-1 sm:text-xs">
              {show.category}
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
        <div>
          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-white sm:text-xl">
            {show.title}
          </h3>

          {show.performers.length > 0 && (
            <p className="mt-1.5 line-clamp-1 text-sm text-zinc-400 sm:mt-2 sm:line-clamp-none">
              Featuring{" "}
              <span className="text-zinc-200">
                {show.performers.join(", ")}
              </span>
            </p>
          )}
        </div>


<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-300 sm:block sm:space-y-2">

  <div className="flex items-center gap-2">
    <Calendar size={16} className="text-yellow-400" />
    <span className="sm:hidden">
      {formatInTimeZone(start, "Asia/Kolkata", "EEE, d MMM")}
    </span>
    <span className="hidden sm:inline">
      {formatInTimeZone(start, "Asia/Kolkata", "EEEE, d MMM yyyy")}
    </span>
  </div>

  <div className="flex items-center gap-2">
    <Clock size={16} className="text-yellow-400" />
    <span>
      {formatInTimeZone(start, "Asia/Kolkata", "h:mm a")}
    </span>
  </div>

</div>

<div className="flex items-center justify-between border-t border-zinc-800 pt-3 sm:pt-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Tickets from
            </p>

            <p className="text-xl font-bold text-white sm:text-2xl">
              ₹{show.price}
            </p>
          </div>

          <a
            href={show.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 font-semibold text-black transition hover:bg-yellow-300"
          >
            <Ticket size={18} />
            Book
          </a>
        </div>
      </div>
    </article>
  );
}
