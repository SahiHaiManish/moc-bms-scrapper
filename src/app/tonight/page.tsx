import type { Metadata } from "next";

import { getTonight, tonightCaption } from "@/lib/tonight";

import ShareTonight from "./ShareTonight";

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

  // Changes whenever the shows do, so phones never show yesterday's poster.
  const version = encodeURIComponent(
    tonight.shows.map((s) => `${s.id}:${s.performers.join("|")}:${s.photos.map((p) => p.url).join("|")}`).join(",") || "none"
  )
    .replace(/%/g, "")
    .slice(-200);
  const posterUrl = `/tonight.png?date=${tonight.date}&v=${version}`;
  const storyUrl = `/tonight.png?date=${tonight.date}&format=story&v=${version}`;

  return (
    <main className="body min-h-screen bg-black px-4 py-8 text-white sm:py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
        <div className="mx-auto w-full max-w-md lg:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG, shown as is */}
          <img
            src={posterUrl}
            alt={`Tonight at Ministry of Comedy, ${tonight.weekday} ${tonight.dayMonth}`}
            width={1080}
            height={1350}
            className="h-auto w-full rounded-xl border border-zinc-800"
          />
        </div>

        <div className="flex flex-1 flex-col gap-5">
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

          <ShareTonight
            posterUrl={posterUrl}
            fileName={`moc-tonight-${tonight.date}.png`}
            storyUrl={storyUrl}
            storyFileName={`moc-tonight-story-${tonight.date}.png`}
            caption={caption}
          />

          <details className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm">
            <summary className="cursor-pointer font-semibold text-zinc-300">Message that goes with it</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-zinc-300">{caption}</pre>
          </details>
        </div>
      </div>
    </main>
  );
}
