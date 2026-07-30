import Hero from "@/components/Hero";
import fs from "fs/promises";
import path from "path";
import { parseISO } from "date-fns";
import fsSync from "fs";


import ShowSection from "@/components/ShowSection";
import FeaturedShow from "@/components/FeaturedShow";
import NextShow from "@/components/NextShow";
import WeekStrip from "@/components/WeekStrip";

import { Show, groupShows } from "@/lib/groupShows";

import MidnightRefresh from "@/components/MidnightRefresh";

export default async function HomePage() {
  const filePath = path.join(process.cwd(), "public", "shows.json");

  const json = await fs.readFile(filePath, "utf8");

  const shows: Show[] = JSON.parse(json);

  const sortedShows = [...shows].sort(
    (a, b) =>
      parseISO(a.startDate).getTime() -
      parseISO(b.startDate).getTime()
  );

const adminPath = path.join(process.cwd(), "src/config", "admin.json");

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

	 <MidnightRefresh />
      {/* Hero */}
<Hero />

<section
  id="shows"
  className="mx-auto max-w-7xl px-6 py-10 lg:px-8"
>

<div className="mb-16">

{featuredShow.eventId === sortedShows[0].eventId ? (  

    <div className="mx-auto max-w-sm">

<NextShow
  shows={sortedShows}
  videos={admin.videos}
/>

    </div>

  ) : (

    <div className="flex flex-wrap justify-center gap-8">

      <div className="w-full max-w-sm">

<NextShow
  shows={sortedShows}
  videos={admin.videos}
/>
      </div>

      <div className="w-full max-w-sm">

        <FeaturedShow
          show={featuredShow}
          title="EDITOR'S PICK"
          featured
	 videoId={admin.videos?.[featuredShow.eventId]}
        />

      </div>

    </div>

  )}

</div>

 {/*  <WeekStrip shows={sortedShows} /> */}

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
