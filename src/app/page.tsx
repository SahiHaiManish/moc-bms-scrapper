
import fs from "fs/promises";
import path from "path";
import { parseISO } from "date-fns";
import fsSync from "fs";


import ShowSection from "@/components/ShowSection";
import FeaturedShow from "@/components/FeaturedShow";
import WeekStrip from "@/components/WeekStrip";

import { Show, groupShows } from "@/lib/groupShows";

export default async function HomePage() {
  const filePath = path.join(process.cwd(), "public", "shows.json");

  const json = await fs.readFile(filePath, "utf8");

  const shows: Show[] = JSON.parse(json);

  const sortedShows = [...shows].sort(
    (a, b) =>
      parseISO(a.startDate).getTime() -
      parseISO(b.startDate).getTime()
  );

const adminPath = path.join(process.cwd(), "config", "admin.json");

const admin = fsSync.existsSync(adminPath)
  ? JSON.parse(fsSync.readFileSync(adminPath, "utf8"))
  : {
      featured: [],
    };

const featuredShow =
  sortedShows.find((show) =>
    admin.featured?.includes(show.eventId)
  ) ?? sortedShows[0];

  const sections = groupShows(sortedShows);

  return (
    <main className="min-h-screen bg-black text-white">

      {/* Hero */}

      <section className="relative overflow-hidden border-b border-zinc-900">

        <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 via-transparent to-transparent" />

        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">

          <div className="max-w-3xl">

            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-yellow-400">
              Bengaluru
            </p>

            <h1 className="text-5xl font-black leading-tight tracking-tight md:text-7xl">
              Ministry of
              <br />
              Comedy
            </h1>

            <p className="mt-8 text-lg leading-8 text-zinc-300">
              The easiest way to discover every upcoming show at
              <span className="font-semibold text-white">
                {" "}
                Ministry of Comedy.
              </span>

              <br />

              Updated automatically from BookMyShow.
            </p>

          </div>

        </div>

      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">

        {featuredShow && (
          <FeaturedShow show={featuredShow} />
        )}

        <WeekStrip shows={sortedShows} />

        {sections.map((section) => (
          <ShowSection
            key={section.title}
            title={section.title}
            shows={section.shows}
          />
        ))}

      </section>

      <footer className="border-t border-zinc-900 py-12">

        <div className="mx-auto max-w-7xl px-6 text-center">

          <p className="text-zinc-500">
            Show information is sourced from BookMyShow and refreshed
            periodically.
          </p>

          <p className="mt-3 text-sm text-zinc-600">
            © {new Date().getFullYear()} Ministry of Comedy
          </p>

        </div>

      </footer>

    </main>
  );
}
