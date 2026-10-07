/**
 * Pure helpers for turning BookMyShow date/time labels into sessions.
 *
 * Nothing in here touches Playwright or the network, so it can be unit
 * tested offline (see scripts/test-sessions.ts).
 *
 * A "listing" is one BookMyShow event (eventId, e.g. ET00312493).
 * A "session" is one date + time of that listing. A listing can have many.
 */

const IST_OFFSET_MIN = 330; // Asia/Kolkata, no DST
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DURATION_MIN = 90;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const WEEKDAYS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What the browser collector hands back: raw, human-formatted labels. */
export interface RawSession {
  /** e.g. "TUE 28 JUL" or "Tue, 28 Jul 2026" */
  dateLabel: string;
  /** e.g. "9:00 PM" */
  time: string;
  price?: number;
  soldOut?: boolean;
}

export interface Session {
  sessionId: string;
  startDate: string; // ISO with +05:30
  endDate: string; // ISO with +05:30
  date: string; // display label, e.g. "Fri 9 Oct"
  time: string; // display label, e.g. "8:00 PM"
  price?: number;
  availability: "available" | "sold_out";
}

export interface ParsedDateLabel {
  weekday?: number; // 0 = Sunday
  day: number;
  month: number; // 1-12
  year?: number;
}

// ---------------------------------------------------------------------------
// Time zone helpers (IST only, which is all Bengaluru needs)
// ---------------------------------------------------------------------------

/** Y/M/D/h/m of `date` as seen on an IST wall clock. */
export function istParts(date: Date) {
  const s = new Date(date.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth() + 1,
    d: s.getUTCDate(),
    h: s.getUTCHours(),
    mi: s.getUTCMinutes(),
    weekday: s.getUTCDay(),
  };
}

export function toIstIso(
  y: number, m: number, d: number, h: number, mi: number
): string {
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+05:30`;
}

export function formatIstIso(date: Date): string {
  const p = istParts(date);
  return toIstIso(p.y, p.m, p.d, p.h, p.mi);
}

/** "Tue 28 Jul 2026" from any ISO timestamp (used for the fallback date). */
export function labelFromIso(iso: string): string {
  const p = istParts(new Date(iso));
  return `${WEEKDAY_NAMES[p.weekday]} ${p.d} ${MONTH_NAMES[p.m - 1]} ${p.y}`;
}

// ---------------------------------------------------------------------------
// Label parsing
// ---------------------------------------------------------------------------

const WD = "(sun|mon|tue|wed|thu|fri|sat)";
const MO = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)";

// "Tue 28 Jul", "TUE28JUL", "Tue, 28 Jul 2026", "28th Jul"
const DAY_FIRST = new RegExp(
  `^(?:${WD}[a-z]*\\.?,?\\s*)?(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*${MO}[a-z]*\\.?(?:\\s*,?\\s*(\\d{4}))?$`,
  "i"
);
// "Tue, Jul 28", "Jul 28 2026"
const MONTH_FIRST = new RegExp(
  `^(?:${WD}[a-z]*\\.?,?\\s*)?${MO}[a-z]*\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?$`,
  "i"
);

export function parseDateLabel(label: string): ParsedDateLabel | null {
  const t = label.replace(/\s+/g, " ").trim();

  let m = t.match(DAY_FIRST);
  if (m) {
    return {
      weekday: m[1] ? WEEKDAYS[m[1].toLowerCase()] : undefined,
      day: Number(m[2]),
      month: MONTHS[m[3].toLowerCase()],
      year: m[4] ? Number(m[4]) : undefined,
    };
  }

  m = t.match(MONTH_FIRST);
  if (m) {
    return {
      weekday: m[1] ? WEEKDAYS[m[1].toLowerCase()] : undefined,
      day: Number(m[3]),
      month: MONTHS[m[2].toLowerCase()],
      year: m[4] ? Number(m[4]) : undefined,
    };
  }

  return null;
}

/**
 * BookMyShow date tabs usually have no year ("TUE 28 JUL"). Work it out:
 * try last/this/next year, keep only those where the weekday matches (when
 * the label has one), and take the earliest that isn't in the past.
 */
export function resolveDate(
  p: ParsedDateLabel,
  now: Date = new Date()
): { y: number; m: number; d: number } | null {
  if (p.year) return { y: p.year, m: p.month, d: p.day };

  const today = istParts(now);
  const todayUtc = Date.UTC(today.y, today.m - 1, today.d);

  const candidates = [today.y - 1, today.y, today.y + 1]
    .map((y) => ({ y, t: Date.UTC(y, p.month - 1, p.day) }))
    // reject impossible dates (30 Feb, 29 Feb in a non-leap year...)
    .filter((c) => new Date(c.t).getUTCMonth() === p.month - 1)
    .filter(
      (c) => p.weekday === undefined || new Date(c.t).getUTCDay() === p.weekday
    );

  if (!candidates.length) return null;

  // 1 day of slack so "today" isn't thrown out by clock skew
  const upcoming = candidates.filter((c) => c.t >= todayUtc - DAY_MS);
  const pick = upcoming.length ? upcoming[0] : candidates[candidates.length - 1];

  return { y: pick.y, m: p.month, d: p.day };
}

export function parseTime(label: string): { h: number; mi: number } | null {
  const m = label.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\b/i);
  if (!m) return null;

  const h12 = Number(m[1]);
  const mi = m[2] ? Number(m[2]) : 0;

  if (h12 < 1 || h12 > 12 || mi > 59) return null;

  const pm = m[3].toLowerCase() === "p";

  return { h: (h12 % 12) + (pm ? 12 : 0), mi };
}

/** "PT1H10M" -> 70. Returns undefined when it can't be read. */
export function parseIsoDurationMinutes(value?: string): number | undefined {
  if (!value) return undefined;

  const m = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!m) return undefined;

  const total =
    Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);

  return total > 0 ? total : undefined;
}

/** Best guess at how long a show runs, from JSON-LD fields. */
export function durationMinutesFrom(details: {
  duration?: string;
  startDate?: string;
  endDate?: string;
}): number {
  const fromDuration = parseIsoDurationMinutes(details.duration);
  if (fromDuration) return fromDuration;

  if (details.startDate && details.endDate) {
    const diff =
      (Date.parse(details.endDate) - Date.parse(details.startDate)) / 60_000;

    // JSON-LD sometimes spans the whole run (days); ignore anything silly
    if (diff > 0 && diff <= 6 * 60) return Math.round(diff);
  }

  return DEFAULT_DURATION_MIN;
}

// ---------------------------------------------------------------------------
// Session building
// ---------------------------------------------------------------------------

export function buildSessions(
  raw: RawSession[],
  opts: { eventId: string; durationMinutes: number; now?: Date }
): Session[] {
  const now = opts.now ?? new Date();
  const byId = new Map<string, Session>();

  for (const r of raw) {
    const dateParts = parseDateLabel(r.dateLabel);
    const timeParts = parseTime(r.time);

    if (!dateParts || !timeParts) continue;

    const resolved = resolveDate(dateParts, now);
    if (!resolved) continue;

    const startDate = toIstIso(
      resolved.y, resolved.m, resolved.d, timeParts.h, timeParts.mi
    );

    const start = new Date(startDate);

    // The site only lists upcoming shows; anything already started is noise.
    if (start.getTime() <= now.getTime()) continue;

    const sessionId = `${opts.eventId}@${resolved.y}${pad(resolved.m)}${pad(
      resolved.d
    )}T${pad(timeParts.h)}${pad(timeParts.mi)}`;

    const existing = byId.get(sessionId);
    const soldOut = Boolean(r.soldOut);

    if (existing) {
      // same slot seen twice: keep price if we only just found it, and only
      // call it sold out if every sighting said so
      existing.price ??= r.price;
      if (!soldOut) existing.availability = "available";
      continue;
    }

    const weekday = WEEKDAY_NAMES[istParts(start).weekday];

    byId.set(sessionId, {
      sessionId,
      startDate,
      endDate: formatIstIso(
        new Date(start.getTime() + opts.durationMinutes * 60_000)
      ),
      date: `${weekday} ${resolved.d} ${MONTH_NAMES[resolved.m - 1]}`,
      time: `${timeParts.h % 12 === 0 ? 12 : timeParts.h % 12}:${pad(
        timeParts.mi
      )} ${timeParts.h >= 12 ? "PM" : "AM"}`,
      price: r.price,
      availability: soldOut ? "sold_out" : "available",
    });
  }

  return [...byId.values()].sort(
    (a, b) => Date.parse(a.startDate) - Date.parse(b.startDate)
  );
}

// ---------------------------------------------------------------------------
// Cache handling
// ---------------------------------------------------------------------------

interface CachedRecord {
  eventId: string;
  startDate: string;
  scrapedAt?: string;
}

/**
 * Splits the cached records into:
 *   fresh  - listings scraped within the TTL: reuse as-is, skip re-scraping
 *   stale  - listings that need another look (kept as a fallback in case the
 *            re-scrape fails, so a flaky run doesn't wipe good data)
 *
 * Past sessions are dropped either way.
 *
 * Why a TTL at all: the old code skipped any eventId it had ever seen, so a
 * date added to a listing later (or a session that sold out) was never
 * noticed until the single cached date had passed.
 */
export function partitionCache<T extends CachedRecord>(
  records: T[],
  now: Date,
  ttlHours: number
): { fresh: T[]; stale: Map<string, T[]> } {
  const upcoming = records.filter(
    (r) => r.startDate && Date.parse(r.startDate) > now.getTime()
  );

  const byEvent = new Map<string, T[]>();

  for (const r of upcoming) {
    const list = byEvent.get(r.eventId) ?? [];
    list.push(r);
    byEvent.set(r.eventId, list);
  }

  const fresh: T[] = [];
  const stale = new Map<string, T[]>();

  for (const [eventId, list] of byEvent) {
    // records from before this change have no scrapedAt -> 0 -> stale, which
    // forces one full re-scrape and migrates them to per-session records.
    const newest = Math.max(
      ...list.map((r) => Date.parse(r.scrapedAt ?? "") || 0)
    );

    const age = now.getTime() - newest;

    if (ttlHours > 0 && age < ttlHours * 3_600_000) {
      fresh.push(...list);
    } else {
      stale.set(eventId, list);
    }
  }

  return { fresh, stale };
}
