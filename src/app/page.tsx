import fs from "fs/promises";
import path from "path";

import ShowSection from "@/components/ShowSection";
import { Show, groupShows } from "@/lib/groupShows";

export default async function HomePage() {
  const filePath = path.join(process.cwd(), "public", "shows.json");

  const json = await fs.readFile(filePath, "utf8");
  const shows: Show[] = JSON.parse(json);

  const sections = groupShows(shows);

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

            <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-300">
              Discover the best stand-up comedy shows happening at Ministry of
              Comedy. Updated automatically from BookMyShow so you never miss a
              great night out.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <div className="rounded-full border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm">
                🎤 Live Stand-up
              </div>

              <div className="rounded-full border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm">
                📍 Bengaluru
              </div>

              <div className="rounded-full border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm">
                🎟 Instant Booking
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shows */}

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        {sections.map((section) => (
          <ShowSection
            key={section.title}
            title={section.title}
            shows={section.shows}
          />
        ))}
      </section>

      {/* Footer */}

      <footer className="border-t border-zinc-900 py-10">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-zinc-500">
          <p>
            Show information is sourced from BookMyShow and refreshed
            periodically.
          </p>

          <p className="mt-2">
            © {new Date().getFullYear()} Ministry of Comedy
          </p>
        </div>
      </footer>
    </main>
  );
}
