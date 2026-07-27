import ShowCard from "./ShowCard";
import { Show } from "@/types/show";

interface Props {
  title: string;
  shows: Show[];
}

export default function ShowSection({
  title,
  shows,
}: Props) {

  if (shows.length === 0) return null;

  return (

    <section className="mb-20">

      <h2 className="heading mb-8 text-5xl">
        {title}
      </h2>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

        {shows.map((show) => (

          <ShowCard
            key={show.id}
            show={show}
          />

        ))}

      </div>

    </section>

  );

}
