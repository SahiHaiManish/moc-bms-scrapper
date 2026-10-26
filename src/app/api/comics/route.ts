import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { Comic } from "@/lib/comics";
import { DEFAULT_PUBLIC_MICS_BASE, fetchRoster, toPublicPhoto } from "@/lib/comicsFeed";

// Always runs on the server; the CDN keeps each answer for 5 minutes (below),
// so the mics app is asked at most about once every 5 minutes, not per visitor.
export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

/**
 * The comics roster for the "View lineup" dialog, read live from the mics
 * app's feed, so a comic added there shows up here within minutes with no
 * deploy and no command to run. If the feed can't be reached, the last
 * `npm run sync-comics` snapshot (public/comics.json) is used instead.
 */
export async function GET() {
  const live = await fetchRoster(process.env);

  if (live) return NextResponse.json(live, { headers: { "Cache-Control": CACHE } });

  let snapshot: Comic[] = [];

  try {
    const parsed = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "comics.json"), "utf8"));
    if (Array.isArray(parsed)) {
      // snapshots written before the rewrite existed may still point at localhost
      const base = process.env.MICS_PUBLIC_URL?.trim() || DEFAULT_PUBLIC_MICS_BASE;

      snapshot = (parsed as Comic[]).map((c) => (c.photo ? { ...c, photo: toPublicPhoto(c.photo, base) } : c));
    }
  } catch {
    /* no snapshot either: the dialog just lists names */
  }

  // a short cache so a recovering feed is picked up quickly
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
