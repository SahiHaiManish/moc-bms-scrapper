import fs from "fs";
import path from "path";

import { slotOf, type PublishedLineup } from "./lineups";

/**
 * Faces for the /tonight poster, written into shows.json as `posterPhotos`:
 * [{ name, url }], 2 at most per show.
 *
 *  - Shows with a lineup published from /mics/lineup: the photos ticked there.
 *  - Other shows (BookMyShow) with 1 or 2 performers, a solo or a double bill:
 *    those performers, matched by name against /mics/comics.
 *  - Anything else: no photos. Bigger BookMyShow lineups need a human to choose.
 *
 * Photos live in the mics app; the poster loads them from these URLs.
 */

export interface PosterPhoto {
  name: string;
  url: string;
}

interface Comic {
  id: string;
  name: string;
  aliases?: string[];
  photo: string;
}

interface ShowLike {
  title?: string;
  eventId: string;
  startDate?: string;
  performers?: unknown;
  posterPhotos?: PosterPhoto[];
  [key: string]: unknown;
}

const MAX_PHOTOS = 2;
const DEFAULT_LINEUPS_URL = "https://ministryofcomedy.in/mics/lineups.json";

export const COMICS_CACHE = path.join(process.cwd(), "data", "comics.json");

/** Where the mics app lives: taken from MICS_LINEUPS_URL so both use the same host. */
function micsOrigin(): string {
  const url = process.env.MICS_LINEUPS_URL;
  try {
    return new URL(url && url !== "off" ? url : DEFAULT_LINEUPS_URL).origin;
  } catch {
    return new URL(DEFAULT_LINEUPS_URL).origin;
  }
}

const absolute = (url: string) => (url.startsWith("/") ? `${micsOrigin()}${url}` : url);

/** Same rules as names.js in the mics app: "Manish Jain (Comic)" -> "manish jain". */
export function normName(name: unknown): string {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\((?:comic|comedian|stand[- ]?up(?: comedian)?|artist)\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clean(raw: unknown): Comic[] {
  const list = (raw as { comics?: unknown })?.comics;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (c): c is Comic => !!c && typeof c.id === "string" && typeof c.name === "string" && typeof c.photo === "string"
  );
}

/** /mics/comics.json, cached in data/comics.json for offline runs. */
export async function loadComics(): Promise<{ comics: Comic[]; source: string }> {
  const url = process.env.MICS_COMICS_URL || `${micsOrigin()}/mics/comics.json`;

  if (process.env.MICS_LINEUPS_URL !== "off") {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      fs.mkdirSync(path.dirname(COMICS_CACHE), { recursive: true });
      fs.writeFileSync(COMICS_CACHE, JSON.stringify(body, null, 2));
      return { comics: clean(body), source: url };
    } catch (err) {
      console.warn(`⚠️ Couldn't fetch comic photos from ${url} (${(err as Error).message}); using the last saved copy.`);
    }
  }

  if (fs.existsSync(COMICS_CACHE)) {
    return {
      comics: clean(JSON.parse(fs.readFileSync(COMICS_CACHE, "utf8"))),
      source: path.relative(process.cwd(), COMICS_CACHE),
    };
  }
  return { comics: [], source: "none" };
}

export function addPosterPhotos<T extends ShowLike>(
  shows: T[],
  lineups: PublishedLineup[],
  comics: Comic[]
): { shows: T[]; missing: { show: T; names: string[] }[] } {
  const bySlot = new Map(lineups.map((l) => [l.slot, l]));

  const index = new Map<string, Comic>();
  for (const c of comics) {
    for (const n of [c.name, ...(c.aliases ?? [])]) {
      const k = normName(n);
      if (k && !index.has(k)) index.set(k, c);
    }
  }

  const missing: { show: T; names: string[] }[] = [];

  const out = shows.map((show) => {
    const { posterPhotos: _old, ...rest } = show; // never keep last run's choice
    void _old;
    const slot = show.startDate ? slotOf(show.startDate) : null;
    const lineup = slot ? bySlot.get(slot) : undefined;

    let photos: PosterPhoto[] = [];

    if (lineup) {
      photos = (lineup.photos ?? []).slice(0, MAX_PHOTOS).map((p) => ({ name: p.name, url: absolute(p.url) }));
    } else {
      const performers = Array.isArray(show.performers) ? show.performers.map(String).filter(Boolean) : [];
      if (performers.length >= 1 && performers.length <= MAX_PHOTOS) {
        const without: string[] = [];
        for (const name of performers) {
          const c = index.get(normName(name));
          if (c) photos.push({ name, url: absolute(c.photo) });
          else without.push(name);
        }
        if (without.length) missing.push({ show, names: without });
      }
    }

    return (photos.length ? { ...rest, posterPhotos: photos } : rest) as T;
  });

  return { shows: out, missing };
}

export function reportPhotos<T extends ShowLike>(shows: T[], missing: { show: T; names: string[] }[]) {
  const withPhotos = shows.filter((s) => s.posterPhotos?.length).length;
  if (withPhotos) console.log(`📸 ${withPhotos} show(s) have poster photos.`);

  const names = new Map<string, string>();
  for (const m of missing) for (const n of m.names) if (!names.has(normName(n))) names.set(normName(n), n);
  if (names.size) {
    console.warn(
      `📷 No photo yet for: ${[...names.values()].join(", ")}. Add them at /mics/comics ` +
        `(or add the spelling above as an "other spelling" of an existing comic).`
    );
  }
}
