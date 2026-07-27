import Image from "next/image";
import { Calendar, Clock, MapPin, Ticket } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Show } from "@/lib/groupShows";

interface Props {
  show: Show;
}

export default function FeaturedShow({ show }: Props) {
  const start = parseISO(show.startDate);

  return (
    <section className="mb-16 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
      <div className="grid lg:grid-cols-2">
        <div className="relative min-h-[340px]">
 
<Image
    src={show.image}
    alt={show.title}
    fill
    priority
    sizes="(max-width: 1024px) 100vw, 50vw"
    className="object-cover"
/>
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
        </div>

        <div className="flex flex-col justify-center p-8 lg:p-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Next Show
          </p>

          <h2 className="text-4xl font-black leading-tight text-white">
            {show.title}
          </h2>

          {show.performers.length > 0 && (
            <p className="mt-4 text-lg text-zinc-300">
              Featuring{" "}
              <span className="font-semibold text-white">
                {show.performers.join(", ")}
              </span>
            </p>
          )}

          <div className="mt-8 space-y-3 text-zinc-300">
            <div className="flex items-center gap-3">
              <Calendar className="text-yellow-400" size={18} />
              {format(start, "EEEE, d MMMM")}
            </div>

            <div className="flex items-center gap-3">
              <Clock className="text-yellow-400" size={18} />
              {format(start, "h:mm a")}
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="text-yellow-400" size={18} />
              {show.venue}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">
                Tickets from
              </p>

              <p className="text-4xl font-black text-white">
                ₹{show.price}
              </p>
            </div>

            <a
              href={show.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-xl bg-yellow-400 px-8 py-4 font-bold text-black transition hover:bg-yellow-300"
            >
              <Ticket size={20} />
              Book Tickets
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
