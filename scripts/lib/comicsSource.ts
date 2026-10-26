/**
 * Turns whatever Firebase returns into a clean Comic[]. Pure functions, no
 * network, so they are covered by scripts/test-comics.ts.
 */
import { Comic, normalizeName, safeUrl } from "../../src/lib/comics";

// ---- Firestore REST value decoding ------------------------------------------

type FsValue = Record<string, any>;

export function decodeFirestoreValue(v: FsValue): unknown {
  if (!v || typeof v !== "object") return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decodeFirestoreValue);
  if ("mapValue" in v) {
    return Object.fromEntries(
      Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, decodeFirestoreValue(x as FsValue)])
    );
  }
  return undefined;
}

export function decodeFirestoreDoc(doc: { name?: string; fields?: Record<string, FsValue> }): Record<string, unknown> {
  const fields = Object.fromEntries(
    Object.entries(doc.fields ?? {}).map(([k, v]) => [k, decodeFirestoreValue(v)])
  );

  return { _id: doc.name?.split("/").pop(), ...fields };
}

// ---- Field mapping ------------------------------------------------------------

/**
 * Your Firebase documents can name their fields differently; the first
 * of these that holds text wins. Add your own spelling here if one is missing.
 */
export const FIELD_ALIASES = {
  name: ["name", "fullName", "comicName", "comedian", "title", "displayName"],
  id: ["id", "_id", "comicId", "slug"],
  aliases: ["aliases", "otherNames", "otherSpellings", "spellings", "altNames", "alsoKnownAs", "alt", "names"],
  photo: ["photo", "photoUrl", "photoURL", "image", "imageUrl", "imageURL", "picture", "avatar", "profilePic", "profileImage", "img"],
  reel: ["reel", "reelUrl", "reelURL", "reelLink", "instagramReel", "instagramReelUrl", "instagram", "instagramUrl", "instagramURL", "instagramLink", "insta", "instaLink", "ig"],
} as const;

function firstText(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  // exact match first, then case-insensitive
  const lower = new Map(Object.keys(record).map((k) => [k.toLowerCase(), k]));

  for (const key of keys) {
    const actual = key in record ? key : lower.get(key.toLowerCase());
    const value = actual !== undefined ? record[actual] : undefined;

    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

export interface MapOptions {
  /** the feed's address; relative photo links ("/comics/x.jpg") are resolved against it */
  baseUrl?: string;
  /** feed entries that have an id but no photo field get <photoBase>/comics/<id>.jpg (the mics app's photo route) */
  photoBase?: string;
  /** e.g. "my-app.appspot.com": turns a storage path like "comics/aman.jpg" into a URL */
  storageBucket?: string;
}

/** "@aman" / "aman" -> https://www.instagram.com/aman/ ; real links are kept as they are. */
export function instagramLink(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const direct = safeUrl(value);
  if (direct) return direct;

  const handle = value.replace(/^@/, "").trim();

  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : undefined;
}

export function photoLink(value: string | undefined, opts: MapOptions): string | undefined {
  if (!value) return undefined;

  const direct = safeUrl(value);
  if (direct) return direct;

  if (opts.baseUrl && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      return safeUrl(new URL(value, opts.baseUrl).href);
    } catch {
      return undefined;
    }
  }

  if (opts.storageBucket && !/^(gs:|data:|javascript:)/i.test(value)) {
    return `https://firebasestorage.googleapis.com/v0/b/${opts.storageBucket}/o/${encodeURIComponent(
      value.replace(/^\/+/, "")
    )}?alt=media`;
  }

  return undefined;
}

/** A list of names from an array or from "a, b; c" text. */
function nameList(record: Record<string, unknown>, keys: readonly string[]): string[] {
  const lower = new Map(Object.keys(record).map((k) => [k.toLowerCase(), k]));

  for (const key of keys) {
    const actual = key in record ? key : lower.get(key.toLowerCase());
    const value = actual !== undefined ? record[actual] : undefined;

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

export function toComic(record: Record<string, unknown>, opts: MapOptions = {}): Comic | null {
  const name = firstText(record, FIELD_ALIASES.name);
  if (!name) return null;

  const id = firstText(record, FIELD_ALIASES.id) ?? (typeof record._id === "number" ? String(record._id) : undefined);

  let photo = photoLink(firstText(record, FIELD_ALIASES.photo), opts);
  if (!photo && id && opts.photoBase) {
    photo = safeUrl(`${opts.photoBase.replace(/\/+$/, "")}/comics/${encodeURIComponent(id)}.jpg`);
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
    .map((c) => JSON.parse(JSON.stringify({ ...c, aliases: c.aliases?.length ? c.aliases : undefined })) as Comic) // drop undefined/empty keys
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
