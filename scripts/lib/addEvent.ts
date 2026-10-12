import fs from "fs/promises";
import { Page } from "playwright";

import { slotLabel } from "./clashes";
import {
  ALLOWED_EVENTS,
  VENUE,
  fetchEventDetails,
  sessionRecords,
} from "./scrapeCore";
import { isAtVenue } from "./venueFilter";

/**
 * Add ONE event, from its link, without scraping the whole venue page.
 * (CLI wrapper: scripts/add.ts.)  Kept free of file/process handling so it
 * can be tested with a fake browser page.
 */

/** What the card chip says when we can't learn it from the event page. */
export const DEFAULT_CATEGORY = "Stand up Comedy";

export interface EventLink {
  eventId: string; // "ET00312493"
  url: string; // clean link, no query string
}

const EVENT_PATH = /^\/(events|plays|sports|activities)\/([^/]+)\/(ET\d{8})(?:\/|$)/i;

/**
 * Accepts the link as copied from the browser: query strings, a trailing
 * "/date-time/MCBK", capitals and so on are all fine.
 */
export function parseEventLink(input: string): EventLink | { error: string } {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    return { error: `"${input}" doesn't look like a link.` };
  }

  if (url.host !== VENUE.host) {
    return { error: `Expected a ${VENUE.host} link, but this one is for ${url.host}.` };
  }

  const match = url.pathname.match(EVENT_PATH);

  if (!match) {
    return {
      error:
        "Couldn't find an event id (ET…) in that link. It should look like " +
        `https://${VENUE.host}/events/<show-name>/ET00312493`,
    };
  }

  const eventId = match[3].toUpperCase();

  return { eventId, url: `${url.origin}/${match[1].toLowerCase()}/${match[2]}/${eventId}` };
}

/** Replace every record of `eventId` with `records`; everything else untouched. */
export function replaceEventRecords<T extends { eventId: string; startDate: string }>(
  existing: T[],
  eventId: string,
  records: T[]
): T[] {
  return [...existing.filter((r) => r.eventId !== eventId), ...records].sort(
    (a, b) => Date.parse(a.startDate) - Date.parse(b.startDate)
  );
}

export type AddOutcome =
  | {
      kind: "added";
      title: string;
      records: any[];
      /** "Fri 9 Oct 8:00 PM" for each session */
      sessions: string[];
      category: string;
      categorySource: "flag" | "existing" | "default";
      /** the event isn't recognised as ours: the id must go into allowedEvents */
      needsAllowList: boolean;
      note?: string;
    }
  | { kind: "refused"; title: string; reason: string }
  | { kind: "nothing"; title: string; reason: string }
  | { kind: "failed"; reason: string };

export async function addEvent(
  page: Page,
  link: EventLink,
  previous: { eventId: string; category?: string; language?: string[] }[],
  opts: { category?: string; force?: boolean; now?: Date } = {}
): Promise<AddOutcome> {
  let scraped;

  try {
    scraped = await fetchEventDetails(page, link.url);
  } catch (error) {
    return { kind: "failed", reason: `Couldn't read the event page: ${(error as Error).message}` };
  }

  const { details, sessions } = scraped;

  // The parser hands back an empty "partial" event (instead of throwing) when
  // a page has no event data at all, e.g. a captcha or block page.
  if (!details.title && !details.venue && !details.startDate) {
    return {
      kind: "failed",
      reason:
        "The page had no event data. BookMyShow may have shown a captcha or block page; " +
        "check the browser window, then try again.",
    };
  }

  const title = details.title || link.eventId;
  const now = opts.now ?? new Date();

  // Is this a Ministry of Comedy show? Adding by hand is allowed to override
  // that, but only on purpose (--force).
  const normalCheck = isAtVenue({ ...details, eventId: link.eventId }, VENUE, ALLOWED_EVENTS);

  if (!normalCheck.ok && !opts.force) {
    return { kind: "refused", title, reason: normalCheck.reason };
  }

  const existing = previous.find((r) => r.eventId === link.eventId);

  const [category, categorySource] = opts.category
    ? ([opts.category, "flag"] as const)
    : existing?.category
      ? ([existing.category, "existing"] as const)
      : ([DEFAULT_CATEGORY, "default"] as const);

  const base = {
    category,
    language: existing?.language ?? [],
    regionCode: VENUE.region.regionCode,
    ...details,
    eventId: link.eventId,
    bookingUrl: link.url,
  };

  const scrapedAt = now.toISOString();

  let records: any[];
  let note: string | undefined;

  if (sessions.length) {
    records = sessionRecords(base, details, sessions, scrapedAt);
  } else {
    // Couldn't read the date list. Fall back to the one date in the page data
    // (what `npm run sync` does), but only if it hasn't already happened.
    if (!(Date.parse(details.startDate) > now.getTime())) {
      return { kind: "nothing", title, reason: "no upcoming dates found for this event" };
    }

    records = [{ ...base, venue: details.venue || VENUE.name, scrapedAt }];
    note = "Couldn't read the full list of dates, so only the date in the event data was added.";
  }

  return {
    kind: "added",
    title,
    records,
    sessions: records.map((r) => slotLabel(r.startDate)),
    category,
    categorySource,
    needsAllowList: !normalCheck.ok,
    note,
  };
}

/**
 * Remember an event id in "allowedEvents", so `sync` and `merge` keep a show
 * that was added by hand with --force. Everything else in the file is kept.
 */
export async function addToAllowList(configPath: string, eventId: string): Promise<void> {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));

  config.allowedEvents = [...new Set([...(config.allowedEvents ?? []), eventId])];

  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
}
