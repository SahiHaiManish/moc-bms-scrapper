import scraperConfig from "../../src/config/scraper.json";
import { chromium, Page, BrowserContext } from "playwright";
import fs from "fs/promises";

import { parseEventPage } from "../../src/lib/parseEventPage";

import { collectSessions } from "../collectSessions";
import { Session, buildSessions, durationMinutesFrom } from "./sessions";
import { VenueConfig, regionCookies } from "./venueFilter";

/**
 * Everything needed to scrape ONE event, shared by:
 *   npm run sync   (scripts/scrape.ts)  every event on the venue page
 *   npm run add    (scripts/add.ts)     one event, from its link
 * so both behave identically.
 */

export const VENUE = scraperConfig.venue as VenueConfig;
export const ALLOWED_EVENTS = scraperConfig.allowedEvents as string[];

export async function launchBrowser() {
  return chromium.launch({

    headless: false,

    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",

    channel: undefined,

    args: [
      "--disable-blink-features=AutomationControlled",
    ],

  });
}

export const STORAGE_FILE = "playwright/chromium-state.json";

// BookMyShow localises by IP + cookies. Pin India explicitly so a VPN, a
// travelling laptop or a stale state file can't change what we scrape.
const CONTEXT_OPTIONS = {
  locale: "en-IN",
  timezoneId: "Asia/Kolkata",
  extraHTTPHeaders: { "Accept-Language": "en-IN,en;q=0.9" },
};

export async function getContext(browser: any): Promise<BrowserContext> {
  let context: BrowserContext;

  try {
    await fs.access(STORAGE_FILE);

    console.log("✅ Using saved browser state");

    context = await browser.newContext({
      ...CONTEXT_OPTIONS,
      storageState: STORAGE_FILE,
    });

  } catch {

    console.log("🆕 Starting fresh browser");

    context = await browser.newContext(CONTEXT_OPTIONS);
  }

  // Always (re)assert the city, whatever the saved state says.
  await context.addCookies(regionCookies(VENUE));

  console.log(
    `🇮🇳 Region pinned: ${VENUE.region.regionName} (${VENUE.region.regionCode}, ${VENUE.region.countryCode})`
  );

  return context;
}

export async function chooseBengaluru(
  page: Page,
  context: BrowserContext
) {
  try {

    await page.waitForSelector("text=Bengaluru", {
      timeout: 4000,
    });

    console.log("📍 Selecting Bengaluru");

    await page.getByText("Bengaluru", {
      exact: true,
    }).click();

    await page.waitForLoadState("networkidle");

    await context.storageState({
      path: STORAGE_FILE,
    });

    console.log("💾 Browser state saved");

  } catch {

    console.log("👍 Bengaluru already selected");

  }
}

export async function fetchEventDetails(
  page: Page,
  url: string
): Promise<{
  details: ReturnType<typeof parseEventPage>;
  sessions: Session[];
}> {

  //
  // ---------------------------------------
  // Open event page
  // ---------------------------------------
  //

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForTimeout(5000);

  //
  // ---------------------------------------
  // Parse event page
  // ---------------------------------------
  //

  const eventHtml = await page.content();

console.log(await page.title());
console.log(page.url());
console.log(
  "JSON-LD scripts:",
  (
    eventHtml.match(
      /application\/ld\+json/g
    ) || []
  ).length
);

  let details: ReturnType<typeof parseEventPage>;

  try {

    details = parseEventPage(eventHtml);

  } catch (error) {

    const slug =
      url.split("/").filter(Boolean).at(-1) ?? "unknown";

    await fs.writeFile(
      `playwright/failed-${slug}.html`,
      eventHtml
    );

    throw error;
  }

  //
  // ---------------------------------------
  // Navigate booking flow
  // ---------------------------------------
  //

if (process.env.DEBUG_SCRAPE) {
console.log("========== BEFORE BOOKING ==========");
console.log("URL:", page.url());
console.log("TITLE:", await page.title());

await page.screenshot({
  path: "playwright/before-booking.png",
  fullPage: true,
});

await fs.writeFile(
  "playwright/before-booking.html",
  await page.content()
);

console.log("====================================");
}

  //
  // ---------------------------------------
  // Every date + time this listing sells
  // ---------------------------------------
  //

  let sessions: Session[] = [];

  try {
    const rawSessions = await collectSessions(
      page,
      url,
      {
        eventId: details.eventId || eventIdFromUrl(url),
        fallbackDateIso: details.startDate || undefined,
        venueCode: VENUE.code,
      }
    );

    sessions = buildSessions(rawSessions, {
      eventId: details.eventId || eventIdFromUrl(url),
      durationMinutes: durationMinutesFrom(details),
    });

  } catch (error) {
    console.warn(`⚠️ Could not read sessions: ${(error as Error).message}`);
  }

  //
  // JSON-LD only ever describes ONE session, so it is just a sanity check.
  //

  if (
    sessions.length &&
    details.startDate &&
    !sessions.some(
      (s) => Date.parse(s.startDate) === Date.parse(details.startDate)
    )
  ) {
    console.warn(
      `⚠️ JSON-LD start ${details.startDate} not among collected sessions`
    );
  }

  return { details, sessions };
}

export function eventIdFromUrl(url: string) {
  return (
    new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? ""
  );
}


/**
 * One saved record per session (date + time) of a listing. `base` carries the
 * listing-level fields (title, image, category, ...).
 */
export function sessionRecords(
  base: Record<string, unknown>,
  details: { venue?: string; price?: number },
  sessions: Session[],
  scrapedAt: string
) {
  return sessions.map((session) => ({
    ...base,
    // an event page without venue data still sold seats at our venue
    venue: details.venue || VENUE.name,
    ...session,
    // keep the listing price when a session has none of its own
    price: session.price ?? details.price,
    scrapedAt,
  }));
}
