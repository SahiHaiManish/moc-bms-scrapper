"use client";

import Image from "next/image";
import {
  Calendar,
  Clock,
  Ticket,
} from "lucide-react";

import {
  parseISO,
  differenceInMinutes,
} from "date-fns";

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
    <article className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 transition hover:border-yellow-400">

      {/* Header */}

      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">

        <p className="text-xs font-bold uppercase tracking-[0.35em] text-yellow-400">
          {title}
        </p>

        {!featured ? (
          <Countdown startDate={show.startDate} />
        ) : (
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
            ⭐ Editor's Pick
          </span>
        )}

      </div>

      {/* Poster */}

      <div className="relative h-52">

        <Image
          src={show.image}
          alt={show.title}
          fill
          className="object-cover"
        />

      </div>

      {/* Content */}

      <div className="space-y-4 p-5">

        <h2 className="line-clamp-2 text-2xl font-black text-white">
          {show.title}
        </h2>

        {show.performers.length > 0 && (
          <p className="line-clamp-1 text-sm text-zinc-400">
            {show.performers.join(", ")}
          </p>
        )}

        <div className="space-y-2 text-sm text-zinc-300">

          <div className="flex items-center gap-2">

            <Calendar size={15} />

            {formatInTimeZone(
              start,
              "Asia/Kolkata",
              "EEE, d MMM"
            )}

          </div>

          <div className="flex items-center gap-2">

            <Clock size={15} />

            {formatInTimeZone(
              start,
              "Asia/Kolkata",
              "h:mm a"
            )}

          </div>

        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">

          <div>

            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Tickets
            </p>

            <p className="text-3xl font-black text-white">
              ₹{show.price}
            </p>

          </div>

          <a
            href={show.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300"
          >
            Book
          </a>

        </div>

      </div>

    </article>
  );
}
