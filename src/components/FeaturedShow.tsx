"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import Countdown from "./Countdown";
import { Show } from "@/lib/groupShows";

interface Props {
  show: Show;
  title: string;
  featured?: boolean;
}

export default function FeaturedShow({
  show,
  title,
  featured = false,
}: Props) {
  const start = parseISO(show.startDate);

  return (
    <div className="space-y-3">

      {/* Small Heading */}

      <div className="flex items-center justify-between">

        <h3 className="text-xs font-bold uppercase tracking-[0.35em] text-yellow-400">
          {title}
        </h3>

        {!featured ? (
          <Countdown startDate={show.startDate} />
        ) : (
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
            ⭐ Editor's Pick
          </span>
        )}

      </div>

      <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition hover:border-yellow-400">

        <div className="relative aspect-[16/10]">

          <Image
            src={show.image}
            alt={show.title}
            fill
            className="object-cover"
          />

        </div>

<div className="flex flex-col gap-4 p-5">
<h2 className="min-h-[64px] line-clamp-2 text-2xl font-black text-white">
            {show.title}
          </h2>

<div className="flex items-center gap-4 text-sm text-zinc-400">            
<span className="flex items-center gap-1">

              <Calendar size={15} />

              {formatInTimeZone(
                start,
                "Asia/Kolkata",
                "EEE, d MMM"
              )}

            </span>

            <span className="flex items-center gap-1">

              <Clock size={15} />

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
              className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300"
            >
              Book
            </Link>

          </div>

        </div>

      </article>

    </div>
  );
}
