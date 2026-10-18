/**
 * "Tonight" at the club: the shows behind /tonight (page) and /tonight.png
 * (the poster for the WhatsApp groups).
 *
 * Reads public/shows.json, the same file the home page uses, so lineups
 * published from /mics/lineup show up here too.
 */

import fs from "fs";
import path from "path";

// Self-contained on purpose: no imports from the rest of the site, so this
// works whatever else the repo has.

const TZ = "Asia/Kolkata";

/** Public address used in the caption and on the poster. */
export const PUBLIC_SITE = "https://ministryofcomedy.in";

/** Shows starting before this hour the next morning still count as "tonight". */
const LATE_NIGHT_CUTOFF_HOUR = 6;

/** The fields of a public/shows.json entry this file uses. */
interface ShowRecord {
  eventId: string;
  sessionId?: string;
  title: string;
  startDate: string;
  bookingUrl: string;
  price?: number | string;
  performers?: string[];
  languages?: string[];
  /** Faces for the poster, added by `npm run lineup` / merge from /mics. */
  posterPhotos?: { name: string; url: string }[];
  /** "sold_out" when BookMyShow showed this session as sold out at scrape time */
  availability?: string;
}

export interface TonightShow {
  id: string;
  title: string;
  time: string; // "10:00 PM"
  startDate: string;
  performers: string[];
  price: string | null; // "₹249"
  languages: string[];
  bookingUrl: string; // absolute
  photos: { name: string; url: string }[]; // 2 at most
  soldOut: boolean; // as scraped from BookMyShow; the /tonight page can override it
}

export interface Tonight {
  /** India date, "2026-10-17" */
  date: string;
  weekday: string; // "Saturday"
  dayMonth: string; // "17 October"
  shows: TonightShow[];
}

/** India-time parts of a moment. */
function ist(when: Date | string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(typeof when === "string" ? new Date(when) : when);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    key: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

/** "2026-10-31" + 1 -> "2026-11-01" */
function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 22:00 -> "10:00 PM" */
function clock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * BookMyShow page titles sometimes leak into listings:
 * "Best In StandUp! (Koramangala) comedy-shows Event Tickets Bengaluru - BookMyShow"
 * -> "Best In StandUp!"
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s+[a-z-]*shows?\s+Event Tickets.*$/i, "")
    .replace(/\s*-\s*BookMyShow\s*$/i, "")
    .replace(/\s*\(Koramangala\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** BookMyShow adds "(Comic)" / "(Comedian)" to tell namesakes apart: "Manish Jain (Comic)" -> "Manish Jain". */
function cleanName(name: string): string {
  return String(name)
    .replace(/\s*\((?:comic|comedian|stand[- ]?up(?: comedian)?|artist)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readShows(): ShowRecord[] {
  const file = path.join(process.cwd(), "public", "shows.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function absolute(href: string): string {
  return href.startsWith("/") ? `${PUBLIC_SITE}${href}` : href;
}

function priceLabel(show: ShowRecord): string | null {
  const n = Number(show.price);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `₹${n.toLocaleString("en-IN")}`;
}

/**
 * Tonight's shows in India time. `date` ("2026-10-17") picks another night,
 * for previewing; anything else means today.
 */
export function getTonight(date?: string | null, now: Date = new Date()): Tonight {
  const day = date && DATE_KEY.test(date) ? date : ist(now).key;
  const nextDay = addDays(day, 1);

  const shows = readShows()
    .filter((s) => {
      const t = ist(s.startDate);
      if (t.key === day) return true;
      // Past-midnight shows belong to the night before.
      if (t.key === nextDay) return t.hour < LATE_NIGHT_CUTOFF_HOUR;
      return false;
    })
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate))
    .map((s) => ({
      id: s.sessionId ?? `${s.eventId}@${s.startDate}`,
      title: cleanTitle(s.title),
      time: (({ hour, minute }) => clock(hour, minute))(ist(s.startDate)),
      startDate: s.startDate,
      performers: (s.performers ?? []).map(cleanName).filter(Boolean),
      price: priceLabel(s),
      languages: s.languages ?? [],
      bookingUrl: absolute(s.bookingUrl),
      soldOut: s.availability === "sold_out",
      photos: (s.posterPhotos ?? [])
        .filter((p) => p && typeof p.url === "string" && /^https?:\/\//.test(p.url))
        .slice(0, 2)
        .map((p) => ({ name: cleanName(p.name), url: p.url })),
    }));

  const [, month, dom] = day.split("-").map(Number);

  return {
    date: day,
    weekday: ist(new Date(`${day}T12:00:00+05:30`)).weekday,
    dayMonth: `${dom} ${MONTHS[month - 1]}`,
    shows,
  };
}

// The WhatsApp message lives in ./tonightCaption (no file access, so the
// /tonight page can rebuild it in the browser when BOGO / sold out change).
export { tonightCaption } from "./tonightCaption";
