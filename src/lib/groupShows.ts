import { addDays, dateKey, weekdayOfKey } from "@/lib/calendar";

export interface Show {
  title: string;
  category: string;
  image: string;
  bookingUrl: string;
  eventId: string;
  /** unique per date+time; eventId alone repeats for multi-date listings */
  sessionId?: string;
  description: string;
  venue: string;
  address: string;
  startDate: string;
  endDate: string;
  duration: string;
  price: string;
  currency: string;
  performers: string[];
  languages: string[];
}

export interface ShowSection {
  title: string;
  shows: Show[];
}

/**
 * Mon-Thu run the same mics every day, so listing them days in advance just
 * repeats the same card down the page. They stay in the data; they simply
 * aren't advertised until their own day, when they show up under "Tonight".
 *
 * Shown: today (and anything still on stage past midnight), the coming
 * weekend, and everything after it. Hidden: the days in between.
 *
 * Days are India dates, so this is the same on any server or phone time zone.
 */
export function isDisplayed(show: { startDate: string }, now: Date = new Date()): boolean {
  const today = dateKey(now);
  const key = dateKey(show.startDate);

  return key <= today || key >= firstWeekendKeyFrom(today);
}

/** First weekend day still ahead (Fri; Sat on a Friday; Sun on a Saturday; next Fri on a Sunday). */
function firstWeekendKeyFrom(today: string): string {
  const dow = weekdayOfKey(today); // 0 = Sunday ... 6 = Saturday

  if (dow === 5) return addDays(today, 1);
  if (dow === 6) return addDays(today, 1);

  return addDays(today, (5 - dow + 7) % 7);
}

/**
 * Sorts the upcoming shows into the sections the page displays:
 *
 *   Tonight      today
 *   Friday / Saturday / Sunday    the coming weekend (what's left of it)
 *   Coming Soon  everything after that Sunday
 *
 * Mid-week days between today and the weekend get no section (see
 * isDisplayed); a show on such a day is "Tonight" once its day arrives.
 */
export function groupShows(shows: Show[], now: Date = new Date()): ShowSection[] {
  const sorted = shows
    .filter((show) => isDisplayed(show, now))
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));

  const today = dateKey(now);
  const dow = weekdayOfKey(today);

  const weekend: { title: string; key: string }[] = [];

  if (dow !== 5 && dow !== 6) {
    weekend.push({ title: "Friday", key: addDays(today, (5 - dow + 7) % 7) });
  }

  if (dow !== 6) {
    weekend.push({ title: "Saturday", key: addDays(today, (6 - dow + 7) % 7) });
  }

  weekend.push({ title: "Sunday", key: addDays(today, dow === 0 ? 7 : 7 - dow) });

  const lastWeekendKey = weekend[weekend.length - 1].key;
  const keyOf = (show: Show) => dateKey(show.startDate);

  const sections: ShowSection[] = [
    // `<=` so a late show still on stage just after midnight stays under Tonight
    { title: "Tonight", shows: sorted.filter((s) => keyOf(s) <= today) },
    ...weekend.map(({ title, key }) => ({
      title,
      shows: sorted.filter((s) => keyOf(s) === key),
    })),
    { title: "Coming Soon", shows: sorted.filter((s) => keyOf(s) > lastWeekendKey) },
  ];

  return sections.filter((section) => section.shows.length > 0);
}
