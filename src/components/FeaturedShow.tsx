"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Ticket } from "lucide-react";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import Countdown from "./Countdown";
import { Show } from "@/lib/groupShows";


import { useState } from "react";

interface Props {
  show: Show;
  title: string;
  featured?: boolean;
live?: boolean;
videoId?: string;
}

export default function FeaturedShow({
  show,
  title,
  featured = false,
  videoId,
live = false,
}: Props) {
  const start = parseISO(show.startDate);

const [playVideo, setPlayVideo] = useState(false);

  return (
    <div className="space-y-3">

      {/* Small Heading */}

      <div className="flex items-center justify-between">

        <h3 className="text-xs font-bold uppercase tracking-[0.35em] text-yellow-400">
          {title}
        </h3>

 {live ? (
  <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
    🔴 Live Now
  </span>
) : featured ? (
  <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
    ⭐ Editor's Pick
  </span>
) : (
  <Countdown startDate={show.startDate} />
)}

      </div>

      <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition hover:border-yellow-400">

<div className="relative aspect-[16/10] overflow-hidden">
    {videoId && playVideo ? (
        <iframe
            className="h-full w-full"
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

 {videoId && (
                <button
                    onClick={() => setPlayVideo(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/30"
                >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl">
                        ▶
                    </div>
                </button>
            )}
        </>
    )}
        </div>

<div className="flex flex-col gap-4 p-5">
<h2 className="min-h-[64px] line-clamp-2 text-2xl font-black text-white">
            {show.title}
          </h2>

<div className="flex items-center gap-4 text-sm">
<span className="flex items-center gap-1 text-zinc-400">
    <Calendar
        size={15}
        className="text-yellow-400"
    />
              
	     {formatInTimeZone(
                start,
                "Asia/Kolkata",
                "EEE, d MMM"
              )}

            </span>


<span className="flex items-center gap-1 text-zinc-400">
    <Clock
        size={15}
        className="text-yellow-400"
    />
              {formatInTimeZone(
                start,
                "Asia/Kolkata",
                "h:mm a"
              )}

            </span>

          </div>

<div className="flex items-center justify-between pt-2">
            <p className="text-3xl font-black text-white">
              ₹{show.price}
            </p>

            <Link
              href={show.bookingUrl}
              target="_blank"
rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 font-semibold text-black transition hover:bg-yellow-300"
            >
                     <Ticket size={18} />
	      Book
            </Link>

          </div>

        </div>

      </article>

    </div>
  );
}
