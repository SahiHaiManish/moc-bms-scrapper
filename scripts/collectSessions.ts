import { Page } from "playwright";
import fs from "fs/promises";

import { SCAN_DATE_TABS, SCAN_TIME_SLOTS } from "./lib/domScanners";
import { RawSession, labelFromIso } from "./lib/sessions";
import { findBookButton } from "./bookingFlow";

const DEFAULT_VENUE_CODE = "MCBK"; // Ministry Of Comedy: Koramangala
const VIEW_TIMEOUT_MS = 12_000;
const SLOTS_ONLY_GRACE_MS = 5_000;
const MAX_SCAN_PASSES = 8; // safety net for date strips that load more on scroll

interface DateTab {
  index: number;
  label: string;
  disabled: boolean;
}

interface TimeSlot {
  time: string;
  price?: number;
  soldOut: boolean;
}

const DEBUG = Boolean(process.env.DEBUG_SESSIONS);

/**
 * BookMyShow's "Book Now" button links to
 *   <event url>/date-time/<venueCode>
 * (it is in the page's __INITIAL_STATE__), so we can go there directly
 * instead of clicking through the booking dialog.
 */
export function dateTimeUrl(
  bookingUrl: string,
  venueCode = DEFAULT_VENUE_CODE
): string {
  const url = new URL(bookingUrl);

  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/date-time\/.*$/, "");
  url.pathname += `/date-time/${venueCode}`;

  return url.toString();
}

const scanTabs = (page: Page) =>
  page.evaluate(SCAN_DATE_TABS) as Promise<DateTab[]>;

const scanSlots = (page: Page) =>
  page.evaluate(SCAN_TIME_SLOTS) as Promise<TimeSlot[]>;

/**
 * Polls until the date strip has rendered.
 *
 * The time pills and the date strip don't necessarily render together. If we
 * returned as soon as we saw *either*, we could start scanning before the date
 * strip existed, conclude "single date", and only ever read the first day.
 * So: tabs => go. Slots without tabs => wait a grace period first, since that
 * is also what a genuine single-date listing looks like.
 */
async function waitForDateView(page: Page): Promise<boolean> {
  const deadline = Date.now() + VIEW_TIMEOUT_MS;
  let slotsFirstSeen = 0;

  while (Date.now() < deadline) {
    const [tabs, slots] = await Promise.all([
      scanTabs(page).catch(() => [] as DateTab[]),
      scanSlots(page).catch(() => [] as TimeSlot[]),
    ]);

    if (tabs.length) return true;

    if (slots.length) {
      slotsFirstSeen ||= Date.now();

      if (Date.now() - slotsFirstSeen >= SLOTS_ONLY_GRACE_MS) return true;
    }

    await page.waitForTimeout(400);
  }

  return false;
}

async function openDateTimeView(
  page: Page,
  bookingUrl: string,
  venueCode: string
): Promise<void> {
  // 1) straight to the date-time page
  await page.goto(dateTimeUrl(bookingUrl, venueCode), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  if (await waitForDateView(page)) return;

  // 2) fall back to clicking Book Now on the event page, once
  await page.goto(bookingUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await page.waitForTimeout(3000);

  const book = await findBookButton(page);

  if (book) {
    await book.scrollIntoViewIfNeeded().catch(() => {});
    await book.click({ force: true }).catch(() => {});

    if (await waitForDateView(page)) return;
  }

  throw new Error("Could not find a date/time view for this listing.");
}

async function clickDate(page: Page, label: string): Promise<void> {
  // Re-scan right before clicking: the strip may have re-rendered since
  // the last scan, which would make an old data-moc-date index stale.
  const tabs = await scanTabs(page);
  const tab = tabs.find((t) => t.label === label);

  if (!tab) throw new Error(`Date tab vanished: ${label}`);

  const target = page.locator(`[data-moc-date="${tab.index}"]`).first();

  try {
    await target.scrollIntoViewIfNeeded({ timeout: 3000 });
    await target.click({ timeout: 4000 });
  } catch {
    // overlay in the way? click it programmatically instead
    await target.evaluate((el: HTMLElement) => el.click());
  }
}

/** Reads the slot list once it has stopped changing. */
async function readStableSlots(page: Page): Promise<TimeSlot[]> {
  const signature = (s: TimeSlot[]) =>
    s.map((x) => `${x.time}|${x.soldOut}|${x.price ?? ""}`).join(",");

  await page.waitForTimeout(600);

  let last = await scanSlots(page);
  const deadline = Date.now() + 4000;

  while (Date.now() < deadline) {
    await page.waitForTimeout(350);

    const next = await scanSlots(page);

    if (signature(next) === signature(last)) return next;

    last = next;
  }

  return last;
}

/** DEBUG_SESSIONS=1: dump every JSON response so an API parser can be built. */
function attachNetworkDump(page: Page, eventId: string): () => void {
  let n = 0;
  const dir = `playwright/debug/${eventId}`;

  const handler = async (res: import("playwright").Response) => {
    const type = res.request().resourceType();

    if (type !== "fetch" && type !== "xhr") return;

    try {
      const body = await res.text();
      const name = `${String(++n).padStart(2, "0")}.json`;

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        `${dir}/${name}`,
        JSON.stringify({ url: res.url(), status: res.status(), body })
      );
    } catch {
      /* body not available (redirect, aborted, ...) */
    }
  };

  page.on("response", handler);

  return () => page.off("response", handler);
}

async function dumpFailure(page: Page, eventId: string) {
  await fs.mkdir("playwright", { recursive: true });

  await page
    .screenshot({ path: `playwright/sessions-failed-${eventId}.png`, fullPage: true })
    .catch(() => {});

  await fs.writeFile(
    `playwright/sessions-failed-${eventId}.html`,
    await page.content()
  );

  console.log(`📸 Saved playwright/sessions-failed-${eventId}.html/.png`);
}

export interface CollectOptions {
  eventId: string;
  /** JSON-LD startDate; used only if the page has times but no date tabs */
  fallbackDateIso?: string;
  venueCode?: string;
}

/**
 * Returns every (date, time) the listing is currently selling for the venue.
 * Throws if no date/time view could be found at all.
 */
export async function collectSessions(
  page: Page,
  bookingUrl: string,
  opts: CollectOptions
): Promise<RawSession[]> {
  const stopDump = DEBUG ? attachNetworkDump(page, opts.eventId) : () => {};

  try {
    await openDateTimeView(
      page,
      bookingUrl,
      opts.venueCode ?? DEFAULT_VENUE_CODE
    );

    const out: RawSession[] = [];
    const done = new Set<string>();

    console.log(
      `   🔎 date view: ${page.url()}  (${(await scanTabs(page)).length} date tab(s), ${(await scanSlots(page)).length} slot(s) visible)`
    );

    // Date strips can be long and horizontally scrolled; keep scanning until
    // a pass turns up no date we haven't visited yet.
    for (let pass = 0; pass < MAX_SCAN_PASSES; pass++) {
      const tabs = await scanTabs(page);
      const todo = tabs.filter((t) => !done.has(t.label));

      if (!todo.length) break;

      for (const tab of todo) {
        done.add(tab.label);

        if (tab.disabled) {
          console.log(`   ⏭  ${tab.label} (no shows)`);
          continue;
        }

        // If clicking a date triggers a request, wait for it so we don't read
        // the previous date's slots while the new ones are still loading.
        const responded = page
          .waitForResponse(
            (r) => ["fetch", "xhr"].includes(r.request().resourceType()),
            { timeout: 1500 }
          )
          .catch(() => null);

        await clickDate(page, tab.label);
        await responded;

        const slots = await readStableSlots(page);

        console.log(
          `   📅 ${tab.label}: ${slots.map((s) => s.time).join(", ") || "—"}`
        );

        for (const s of slots) {
          out.push({
            dateLabel: tab.label,
            time: s.time,
            price: s.price,
            soldOut: s.soldOut,
          });
        }
      }
    }

    // No tab strip at all: a single-date listing. Times belong to the one
    // date we already know from JSON-LD.
    if (!done.size && opts.fallbackDateIso) {
      const slots = await scanSlots(page);
      const dateLabel = labelFromIso(opts.fallbackDateIso);

      for (const s of slots) {
        out.push({ dateLabel, time: s.time, price: s.price, soldOut: s.soldOut });
      }
    }

    if (!out.length) await dumpFailure(page, opts.eventId);

    return out;
  } catch (error) {
    await dumpFailure(page, opts.eventId).catch(() => {});
    throw error;
  } finally {
    stopDump();
  }
}
