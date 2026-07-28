import ShowCard from "./ShowCard";
import { Show } from "@/lib/groupShows";

interface Props {
  title: string;
  shows: Show[];
}

export default function ShowSection({ title, shows }: Props) {
  if (!shows.length) return null;

  return (
    <section className="mb-16">
      <div className="mb-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-zinc-800" />

        <h2 className="text-center text-3xl font-extrabold uppercase tracking-[0.2em] text-white">
          {title}
        </h2>

        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {shows.map((show) => (
          <ShowCard key={show.eventId} show={show} />
        ))}
      </div>
    </section>
  );
}
