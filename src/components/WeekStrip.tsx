import Image from "next/image";
import Link from "next/link";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { Show } from "@/lib/groupShows";
import { formatInTimeZone } from "date-fns-tz";


interface Props {
  shows: Show[];
}

export default function WeekStrip({ shows }: Props) {
  if (!shows.length) return null;

  const upcoming = [...shows]
    .sort(
      (a, b) =>
        parseISO(a.startDate).getTime() -
        parseISO(b.startDate).getTime()
    )
    .slice(0, 6);

  return (
    <section className="mb-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">
            This Week
          </p>

          <h2 className="mt-1 text-3xl font-black text-white">
            Don't Miss These Shows
          </h2>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">
        {upcoming.map((show) => {
const start = parseISO(show.startDate);

          const daysAway = differenceInCalendarDays(start, new Date());


let badge = formatInTimeZone(
  start,
  "Asia/Kolkata",
  "EEE"
);

          if (daysAway === 0) badge = "Today";
          else if (daysAway === 1) badge = "Tomorrow";

          return (
            <Link
              key={show.eventId}
              href={show.bookingUrl}
              target="_blank"
              className="group min-w-[280px] snap-start overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition hover:border-yellow-400 hover:shadow-xl hover:shadow-yellow-500/10"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
 <Image
  src={show.image}
  alt={show.title}
  fill
  sizes="280px"
  className="object-cover transition duration-500 group-hover:scale-105"
/>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                <div className="absolute left-4 top-4 rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                  {badge}
                </div>
              </div>

              <div className="space-y-3 p-5">
                <h3 className="line-clamp-2 text-lg font-bold text-white">
                  {show.title}
                </h3>

                <p className="text-sm text-zinc-400">
{formatInTimeZone(
  start,
  "Asia/Kolkata",
  "EEE • h:mm a"
)}                
</p>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xl font-black text-white">
                    ₹{show.price}
                  </span>

                  <span className="text-sm font-semibold text-yellow-400 transition group-hover:translate-x-1">
                    Book →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
