import type { Metadata } from "next";

import { getTonight, tonightCaption } from "@/lib/tonight";

import TonightStudio from "./TonightStudio";

export const metadata: Metadata = {
  title: "Tonight · Ministry of Comedy",
  description: "Tonight's shows at Ministry of Comedy, Koramangala.",
  robots: { index: false, follow: false },
};

/**
 * /tonight              tonight's poster + WhatsApp caption, ready to share
 * /tonight?date=2026-10-18   preview another night
 */
export default async function TonightPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  const tonight = getTonight(typeof date === "string" ? date : null);
  const caption = tonightCaption(tonight);

  // Changes whenever the shows, names or photos do, so phones never show a stale poster.
  let h = 5381;
  const sig = tonight.shows.map((s) => `${s.id}:${s.performers.join("|")}:${s.photos.map((p) => p.url).join("|")}`).join(",");
  for (let i = 0; i < sig.length; i++) h = ((h * 33) ^ sig.charCodeAt(i)) >>> 0;
  const version = h.toString(36);
  const query = `date=${tonight.date}&v=${version}`;

  return (
    <main className="body min-h-screen bg-black px-4 py-8 text-white sm:py-12">
      <TonightStudio
        query={query}
        date={tonight.date}
        alt={`Tonight at Ministry of Comedy, ${tonight.weekday} ${tonight.dayMonth}`}
        caption={caption}
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
            {tonight.weekday} · {tonight.dayMonth}
          </p>
          <h1 className="heading mt-1 text-5xl tracking-wide">
            {tonight.shows.length
              ? `${tonight.shows.length} show${tonight.shows.length === 1 ? "" : "s"} tonight`
              : "No shows tonight"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Poster and message are built from the website&apos;s schedule, including lineups
            published from /mics. Tap Share, pick your groups, send.
          </p>
        </div>
      </TonightStudio>
    </main>
  );
}
