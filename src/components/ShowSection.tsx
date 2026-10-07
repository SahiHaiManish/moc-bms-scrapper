import ShowCard, { CardTag } from "./ShowCard";
import { Show } from "@/lib/groupShows";
import { showKey } from "@/lib/showKey";

interface Props {
  title: string;
  shows: Show[];
  /** listings (eventId) to tag as featured */
  featuredIds?: string[];
  /** eventId -> YouTube id */
  videos?: Record<string, string>;
  /** the one card that gets the "Next up" tag */
  nextKey?: string;
  /** the card that gets the "Live now" tag */
  liveKey?: string;
}

export default function ShowSection({
  title,
  shows,
  featuredIds = [],
  videos,
  nextKey,
  liveKey,
}: Props) {
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
        {shows.map((show) => {
          const key = showKey(show);
          const tags: CardTag[] = [];

          if (key === liveKey) tags.push("live");
          if (key === nextKey) tags.push("next");
          if (featuredIds.includes(show.eventId)) tags.push("featured");

          return (
            <ShowCard
              key={key}
              show={show}
              tags={tags}
              videoId={videos?.[show.eventId]}
            />
          );
        })}
      </div>
    </section>
  );
}
