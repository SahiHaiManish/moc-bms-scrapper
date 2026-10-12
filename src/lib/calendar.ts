import { formatInTimeZone } from "date-fns-tz";

/**
 * Date maths for the schedule calendar. Everything is done on India time:
 * the venue is in Bengaluru, so "Saturday" means Saturday there, whatever
 * time zone the visitor's phone or the server happens to be in.
 */

const TZ = "Asia/Kolkata";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface DayBucket {
  /** "2026-10-10" (India date) */
  key: string;
  weekday: string; // "Sat"
  day: number; // 10
  month: string; // "Oct"
  weekdayLong: string; // "Saturday"
  monthLong: string; // "October"
  count: number; // shows on that day
  isToday: boolean;
  isTomorrow: boolean;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** 0 = Sunday ... 6 = Saturday, for a "yyyy-MM-dd" key. */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "2026-10-31" + 1 -> "2026-11-01". */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** India calendar date of a moment, as "yyyy-MM-dd". */
export function dateKey(when: Date | string): string {
  return formatInTimeZone(typeof when === "string" ? new Date(when) : when, TZ, "yyyy-MM-dd");
}

/** One bucket per India date that has at least one show, oldest first. */
export function bucketByDate(shows: { startDate: string }[], now: Date): DayBucket[] {
  const today = dateKey(now);
  const tomorrow = dateKey(new Date(now.getTime() + 24 * 3_600_000)); // India has no DST

  const counts = new Map<string, number>();

  for (const show of shows) {
    const key = dateKey(show.startDate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.keys()].sort().map((key) => {
    const [y, m, d] = key.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

    return {
      key,
      weekday: WEEKDAYS[wd],
      day: d,
      month: MONTHS[m - 1],
      weekdayLong: WEEKDAYS_LONG[wd],
      monthLong: MONTHS_LONG[m - 1],
      count: counts.get(key)!,
      isToday: key === today,
      isTomorrow: key === tomorrow,
    };
  });
}

/** Heading for a day's list: "Tonight", "Tomorrow", or "Sat, 10 Oct". */
export function dayTitle(b: DayBucket): string {
  if (b.isToday) return "Tonight";
  if (b.isTomorrow) return "Tomorrow";

  return `${b.weekday}, ${b.day} ${b.month}`;
}

/** Screen-reader label: "Saturday 10 October, 2 shows". */
export function spokenDay(b: DayBucket): string {
  return `${b.weekdayLong} ${b.day} ${b.monthLong}, ${b.count} ${b.count === 1 ? "show" : "shows"}`;
}

/**
 * Validates a ?date= value from the URL: only accepted if some show is on
 * that day, so an old or hand-edited link quietly falls back to "All".
 */
export function pickDate(param: string | null | undefined, buckets: DayBucket[]): string | null {
  if (!param || !DATE_KEY.test(param)) return null;

  return buckets.some((b) => b.key === param) ? param : null;
}
