import Image from "next/image";
import { Calendar, Clock, MapPin, Ticket } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Show } from "@/lib/groupShows";

interface Props {
  show: Show;
}

export default function ShowCard({ show }: Props) {
  const start = parseISO(show.startDate);

  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition-all duration-300 hover:-translate-y-1 hover:border-yellow-400 hover:shadow-2xl hover:shadow-yellow-500/10">
      <div className="relative aspect-[16/9] overflow-hidden">
 <Image
  src={show.image}
  alt={show.title}
  fill
 sizes="(max-width: 640px) 100vw,
         (max-width: 1280px) 50vw,
         33vw"
  className="object-cover transition duration-500 group-hover:scale-105"
/>

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/40 to-transparent" />

        <div className="absolute bottom-4 left-4 rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-black">
          {show.category}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="line-clamp-2 text-xl font-bold leading-snug text-white">
            {show.title}
          </h3>

          {show.performers.length > 0 && (
            <p className="mt-2 text-sm text-zinc-400">
              Featuring{" "}
              <span className="text-zinc-200">
                {show.performers.join(", ")}
              </span>
            </p>
          )}
        </div>

        <div className="space-y-2 text-sm text-zinc-300">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-yellow-400" />
            <span>{format(start, "EEEE, d MMM yyyy")}</span>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={16} className="text-yellow-400" />
            <span>{format(start, "h:mm a")}</span>
          </div>

          <div className="flex items-start gap-2">
            <MapPin
              size={16}
              className="mt-0.5 shrink-0 text-yellow-400"
            />
            <span className="line-clamp-2">{show.venue}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Tickets from
            </p>

            <p className="text-2xl font-bold text-white">
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
