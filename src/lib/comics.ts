/**
 * Comic roster used by the "View lineup" dialog. The roster lives in
 * public/comics.json, written by `npm run comics` from your Firebase.
 */

export interface Comic {
  name: string;
  /** profile photo URL */
  photo?: string;
  /** Instagram reel / profile link */
  reel?: string;
  /** other spellings of the name (the mics app stores these), also matched */
  aliases?: string[];
}

/** One row of the dialog: a performer on the show, with roster details if we have them. */
export interface LineupEntry extends Comic {
  /** true when the performer was found in the roster */
  known: boolean;
}

/**
 * "Aman  Jotwani", "aman jotwani " and "Aman Jotwani." all compare equal.
 * Accents and punctuation are ignored, so "Nayab sadaf" matches "Nayab Sadaf",
 * and a trailing "(Comic)" / "(Comedian)" is dropped, the same as the mics app.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\((comic|comedian)\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Keeps only http(s) links, so a stray "javascript:" value can never become an href. */
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

/** Matches a show's performer names (BookMyShow spelling) to roster entries. */
export function resolveLineup(performers: string[], roster: Comic[]): LineupEntry[] {
  const byName = new Map<string, Comic>();

  const add = (key: string, comic: Comic) => {
    if (!key) return;

    // first one wins, but never let a later duplicate lose a photo/reel the first lacks
    const existing = byName.get(key);
    byName.set(key, existing ? { ...existing, photo: existing.photo ?? comic.photo, reel: existing.reel ?? comic.reel } : comic);
  };

  // real names first, so an alias can never steal another comic's own name
  for (const comic of roster) add(normalizeName(comic.name), comic);
  for (const comic of roster) for (const alias of comic.aliases ?? []) {
    const key = normalizeName(alias);
    if (!byName.has(key)) add(key, comic);
  }

  const seen = new Set<string>();
  const out: LineupEntry[] = [];

  for (const raw of performers) {
    const name = raw.trim();
    const match = byName.get(normalizeName(name));

    // one row per person, even if the bill spells them two ways
    const identity = normalizeName(match ? match.name : name);

    if (!identity || seen.has(identity)) continue;
    seen.add(identity);

    out.push(
      match
        ? { name: match.name, photo: safeUrl(match.photo), reel: safeUrl(match.reel), known: true }
        : { name, known: false }
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Loading (browser). The roster is fetched once, the first time anyone opens a
// lineup, and shared by every card on the page.
// ---------------------------------------------------------------------------

let cached: Promise<Comic[]> | null = null;

export function loadComics(): Promise<Comic[]> {
  if (!cached) {
    cached = fetch("/comics.json")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => (Array.isArray(data) ? (data as Comic[]) : []))
      .catch(() => {
        cached = null; // let a later open try again
        return [];
      });
  }

  return cached;
}

// ---------------------------------------------------------------------------
// Stand-in avatar for comics without a photo
// ---------------------------------------------------------------------------

const AVATAR_EMOJI = [
  "🎤", "😂", "🤡", "🎭", "😎", "🤪", "😜", "🦄", "🐸", "🔥", "🌮", "👻",
  "🦊", "🐼", "🐙", "🥸", "🤠", "🦁", "🐯", "🦉", "🐧", "🍕", "🚀", "🌈",
];

/**
 * A "random" emoji for a comic with no photo. It is picked from the name, so
 * the same comic always gets the same one (no flicker between renders, no
 * server/browser mismatch) while different comics get different ones.
 */
export function emojiFor(name: string): string {
  let hash = 5381;

  for (const ch of normalizeName(name)) hash = ((hash << 5) + hash + ch.charCodeAt(0)) >>> 0;

  return AVATAR_EMOJI[hash % AVATAR_EMOJI.length];
}
