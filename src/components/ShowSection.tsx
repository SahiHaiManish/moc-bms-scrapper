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
    <section className="mb-10 sm:mb-16">
      <div className="mb-5 flex items-center gap-3 sm:mb-8 sm:gap-4">
        <div className="h-px flex-1 bg-zinc-800" />

        <h2 className="whitespace-nowrap text-center text-xl font-extrabold uppercase tracking-[0.15em] text-white sm:text-3xl sm:tracking-[0.2em]">
          {title}
        </h2>

        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-8 xl:grid-cols-3">
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
