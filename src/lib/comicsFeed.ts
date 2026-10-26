/**
 * Turns the mics app's public feed (/comics.json) into the roster the lineup
 * dialog uses. Pure functions plus one small fetch helper; used by the
 * /api/comics route and by `npm run sync-comics`, and covered by
 * scripts/test-comics.ts.
 */
import { Comic, normalizeName, safeUrl } from "./comics";

/** Where the mics app is on the internet (it is served under the website's /mics). */
export const DEFAULT_PUBLIC_MICS_BASE = "https://ministryofcomedy.in/mics";

// ---- Field mapping ------------------------------------------------------------

/**
 * Feed records can name their fields differently; the first of these that holds
 * text wins. Add your own spelling here if one is missing.
 */
export const FIELD_ALIASES = {
  name: ["name", "fullName", "comicName", "comedian", "title", "displayName"],
  id: ["id", "_id", "comicId", "slug"],
  aliases: ["aliases", "otherNames", "otherSpellings", "spellings", "altNames", "alsoKnownAs", "alt", "names"],
  photo: ["photo", "photoUrl", "photoURL", "image", "imageUrl", "imageURL", "picture", "avatar", "profilePic", "profileImage", "img"],
  reel: ["reel", "reelUrl", "reelURL", "reelLink", "instagramReel", "instagramReelUrl", "instagram", "instagramUrl", "instagramURL", "instagramLink", "insta", "instaLink", "ig"],
} as const;

function lookup(record: Record<string, unknown>, key: string): unknown {
  if (key in record) return record[key];

  const found = Object.keys(record).find((k) => k.toLowerCase() === key.toLowerCase());

  return found !== undefined ? record[found] : undefined;
}

function firstText(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = lookup(record, key);

    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

/** A list of names from an array or from "a, b; c" text. */
function nameList(record: Record<string, unknown>, keys: readonly string[]): string[] {
  for (const key of keys) {
    const value = lookup(record, key);

    const list = Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : typeof value === "string"
      ? value.split(/[,;\n]/)
      : [];

    const clean = list.map((v) => v.trim()).filter(Boolean);
    if (clean.length) return clean;
  }

  return [];
}

export interface MapOptions {
  /** the feed's address; relative photo links ("/comics/x.jpg") are resolved against it */
  baseUrl?: string;
  /** feed entries that have an id but no photo field get <photoBase>/comics/<id>.jpg (the mics app's photo route) */
  photoBase?: string;
  /**
   * Public address of the mics app. Photos served by the mics app are rewritten
   * to it, because the app writes links using whatever address it is running on
   * (http://localhost:4000/mics/comics/x.jpg on a laptop).
   */
  publicBase?: string;
}

/** "@aman" / "aman" -> https://www.instagram.com/aman/ ; real links are kept as they are. */
export function instagramLink(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const direct = safeUrl(value);
  if (direct) return direct;

  const handle = value.replace(/^@/, "").trim();

  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : undefined;
}

/**
 *   http://localhost:4000/mics/comics/abhinav-anand.jpg?v=1
 *   -> https://ministryofcomedy.in/mics/comics/abhinav-anand.jpg?v=1
 * Links that aren't the mics app's photo route (a CDN, say) are left alone.
 */
export function toPublicPhoto(url: string, publicBase: string | undefined): string {
  if (!publicBase) return url;

  try {
    const u = new URL(url);
    const m = u.pathname.match(/^(?:\/mics)?\/comics\/(.+)$/);

    return m ? `${publicBase.replace(/\/+$/, "")}/comics/${m[1]}${u.search}` : url;
  } catch {
    return url;
  }
}

export function photoLink(value: string | undefined, opts: MapOptions): string | undefined {
  if (!value) return undefined;

  let url = safeUrl(value);

  if (!url && opts.baseUrl && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      url = safeUrl(new URL(value, opts.baseUrl).href);
    } catch {
      url = undefined;
    }
  }

  return url ? toPublicPhoto(url, opts.publicBase) : undefined;
}

export function toComic(record: Record<string, unknown>, opts: MapOptions = {}): Comic | null {
  const name = firstText(record, FIELD_ALIASES.name);
  if (!name) return null;

  const id = firstText(record, FIELD_ALIASES.id);

  let photo = photoLink(firstText(record, FIELD_ALIASES.photo), opts);

  if (!photo && id && opts.photoBase) {
    photo = photoLink(`${opts.photoBase.replace(/\/+$/, "")}/comics/${encodeURIComponent(id)}.jpg`, opts);
  }

  const aliases = nameList(record, FIELD_ALIASES.aliases).filter(
    (a) => normalizeName(a) !== normalizeName(name)
  );

  return {
    name,
    photo,
    reel: instagramLink(firstText(record, FIELD_ALIASES.reel)),
    ...(aliases.length ? { aliases } : {}),
  };
}

/** A feed may be a bare array or wrapped ({ comics: [...] }). */
export function recordsFromFeed(json: unknown): Record<string, unknown>[] {
  const list = Array.isArray(json)
    ? json
    : json && typeof json === "object"
    ? Object.values(json as object).find(Array.isArray) ?? []
    : [];

  return (list as unknown[]).filter((v): v is Record<string, unknown> => !!v && typeof v === "object");
}

/** Maps raw records, drops nameless ones and duplicates (same name -> keep the fuller entry), sorts A-Z. */
export function buildRoster(records: Record<string, unknown>[], opts: MapOptions = {}): Comic[] {
  const byName = new Map<string, Comic>();

  for (const record of records) {
    const comic = toComic(record, opts);
    if (!comic) continue;

    const key = normalizeName(comic.name);
    const prev = byName.get(key);

    byName.set(
      key,
      prev
        ? {
            ...prev,
            photo: prev.photo ?? comic.photo,
            reel: prev.reel ?? comic.reel,
            aliases: [...new Set([...(prev.aliases ?? []), ...(comic.aliases ?? [])])],
          }
        : comic
    );
  }

  return [...byName.values()]
    .map((c) => JSON.parse(JSON.stringify({ ...c, aliases: c.aliases?.length ? c.aliases : undefined })) as Comic)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Where the feed lives ---------------------------------------------------

/**
 * The comics feed address. MICS_COMICS_URL wins; otherwise it is derived from
 * MICS_LINEUPS_URL, which the website already uses for lineups:
 *   https://x.vercel.app/lineups.json -> https://x.vercel.app/comics.json
 *   https://x.vercel.app              -> https://x.vercel.app/comics.json
 */
export function comicsFeedUrl(env: Record<string, string | undefined>): string | undefined {
  const direct = env.MICS_COMICS_URL?.trim();
  if (direct) return direct;

  const lineups = env.MICS_LINEUPS_URL?.trim();
  if (!lineups) return undefined;

  const clean = lineups.replace(/[?#].*$/, "").replace(/\/+$/, "");

  if (/\/lineups\.json$/i.test(clean)) return clean.replace(/lineups\.json$/i, "comics.json");
  if (/\.json$/i.test(clean)) return clean.replace(/[^/]+$/, "comics.json");

  return `${clean}/comics.json`;
}

/**
 * Downloads and maps the feed. Returns null when it can't be reached, isn't
 * configured, or holds no usable comics, so callers can fall back.
 */
export async function fetchRoster(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
  init: RequestInit = {}
): Promise<Comic[] | null> {
  const feed = comicsFeedUrl(env);
  if (!feed) return null;

  try {
    const res = await fetchImpl(feed, { ...init, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;

    const roster = buildRoster(recordsFromFeed(await res.json()), {
      baseUrl: feed,
      photoBase: feed.replace(/[?#].*$/, "").replace(/\/[^/]*$/, ""), // the feed's folder
      publicBase: env.MICS_PUBLIC_URL?.trim() || DEFAULT_PUBLIC_MICS_BASE,
    });

    return roster.length ? roster : null;
  } catch {
    return null;
  }
}
