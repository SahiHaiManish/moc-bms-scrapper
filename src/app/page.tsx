import Hero from "@/components/Hero";
import LiveSchedule from "@/components/LiveSchedule";
import MidnightRefresh from "@/components/MidnightRefresh";
import ShowBoard from "@/components/ShowBoard";
import { Analytics } from "@vercel/analytics/next";

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { parseISO } from "date-fns";

import { Show } from "@/lib/groupShows";

export default async function HomePage() {
  const filePath = path.join(process.cwd(), "public", "shows.json");

  const json = await fs.readFile(filePath, "utf8");

  const shows: Show[] = JSON.parse(json);

  const sortedShows = [...shows].sort(
    (a, b) =>
      parseISO(a.startDate).getTime() -
      parseISO(b.startDate).getTime()
  );

  const adminPath = path.join(
    process.cwd(),
    "src/config",
    "admin.json"
  );

  const admin = fsSync.existsSync(adminPath)
    ? JSON.parse(fsSync.readFileSync(adminPath, "utf8"))
    : {
        featured: [],
        videos: {},
      };

  const featuredShow =
    sortedShows.find((show) =>
      admin.featured?.includes(show.eventId)
    ) ?? sortedShows[0];

  return (
    <main className="min-h-screen bg-black text-white">
      <MidnightRefresh />

      <Hero />

      <ShowBoard shows={sortedShows} />

<Analytics/>

      <section
        id="shows"
        className="mx-auto max-w-7xl px-6 py-10 lg:px-8"
      >
        <LiveSchedule
          shows={sortedShows}
featuredIds={admin.featured}          
          videos={admin.videos}
        />
      </section>

      <footer className="border-t border-zinc-900 py-12">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-zinc-500">
            Show information is sourced from
            BookMyShow and refreshed
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
