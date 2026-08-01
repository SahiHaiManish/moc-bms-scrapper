import Hero from "@/components/Hero";
import fs from "fs/promises";
import path from "path";
import { parseISO, addMinutes, isAfter, isBefore } from "date-fns";
import fsSync from "fs";


import ShowSection from "@/components/ShowSection";
import FeaturedShow from "@/components/FeaturedShow";
import NextShow from "@/components/NextShow";
import WeekStrip from "@/components/WeekStrip";

import { Show, groupShows } from "@/lib/groupShows";

import MidnightRefresh from "@/components/MidnightRefresh";
import WeekendTicker from "@/components/WeekendTicker";
import ShowBoard from "@/components/ShowBoard";


export default async function HomePage() {
  const filePath = path.join(process.cwd(), "public", "shows.json");

  const json = await fs.readFile(filePath, "utf8");

  const shows: Show[] = JSON.parse(json);

  const sortedShows = [...shows].sort(
    (a, b) =>
      parseISO(a.startDate).getTime() -
      parseISO(b.startDate).getTime()
  );

const now = new Date();

const liveShow = sortedShows.find((show) => {
  const start = parseISO(show.startDate);

  return (
    isBefore(start, now) &&
    isAfter(addMinutes(start, 30), now)
  );
});

const upcomingShows = sortedShows.filter(
  (show) => parseISO(show.startDate) > now
);

const weekendTitles = [
  ...new Set(sortedShows.map((show) => show.title))
];


const adminPath = path.join(process.cwd(), "src/config", "admin.json");

const admin = fsSync.existsSync(adminPath)
  ? JSON.parse(fsSync.readFileSync(adminPath, "utf8"))
  : {
      featured: [],
    };

const featuredShow =
  upcomingShows.find((show) =>
    admin.featured?.includes(show.eventId)
  ) ?? upcomingShows[0];

const sections = groupShows(upcomingShows);

  return (
    <main className="min-h-screen bg-black text-white">

	 <MidnightRefresh />
      {/* Hero */}
<Hero />
<ShowBoard shows={upcomingShows} />

<section
  id="shows"
  className="mx-auto max-w-7xl px-6 py-10 lg:px-8"
>

{liveShow && (
  <div className="mb-10 mx-auto max-w-sm">
    <FeaturedShow
      show={liveShow}
      title="NOW PLAYING"
      live
    />
  </div>
)}

<div className="mb-16">

{featuredShow.eventId === sortedShows[0].eventId ? (  

    <div className="mx-auto max-w-sm">

<NextShow
  shows={upcomingShows}
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
