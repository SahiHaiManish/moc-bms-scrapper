import scraperConfig from "../src/config/scraper.json";
import { chromium, Page, BrowserContext } from "playwright";
import fs from "fs/promises";
import path from "path";

import { parseVenuePage } from "../src/lib/parseVenuePage";
import { parseEventPage } from "../src/lib/parseEventPage";

import { collectSessions } from "./collectSessions";
import {
  Session,
  buildSessions,
  durationMinutesFrom,
  partitionCache,
} from "./lib/sessions";

// Re-scrape a listing if it was last scraped more than this many hours ago.
// New dates get added to listings over time, so cached listings must expire.
// Override: SCRAPE_TTL_HOURS=6 npm run scrape      Ignore cache: --force
const TTL_HOURS = Number(process.env.SCRAPE_TTL_HOURS ?? 12);
const FORCE = process.argv.includes("--force");
// Scrape just one listing while debugging:  npm run scrape -- --only=ET00312493
const ONLY = process.argv
  .find((a) => a.startsWith("--only="))
  ?.split("=")[1];

const VENUE_URL =
  "https://in.bookmyshow.com/explore/c/venues/ministry-of-comedy-koramangala/mcbk";

const STORAGE_FILE = "playwright/chromium-state.json";

async function getContext(browser: any): Promise<BrowserContext> {
  try {
    await fs.access(STORAGE_FILE);

    console.log("✅ Using saved browser state");

    return browser.newContext({
      storageState: STORAGE_FILE,
    });

  } catch {

    console.log("🆕 Starting fresh browser");

    return browser.newContext();
  }
}

async function chooseBengaluru(
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

async function fetchEventDetails(
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

  //
  // ---------------------------------------
  // Every date + time this listing sells
  // ---------------------------------------
  //

  const rawSessions = await collectSessions(
    page,
    url,
    {
      eventId: details.eventId || eventIdFromUrl(url),
      fallbackDateIso: details.startDate || undefined,
    }
  );

  const sessions = buildSessions(rawSessions, {
    eventId: details.eventId || eventIdFromUrl(url),
    durationMinutes: durationMinutesFrom(details),
  });

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

function eventIdFromUrl(url: string) {
  return (
    new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? ""
  );
}

async function run() {

  const browser = await chromium.launch({

    headless: false,

    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",

    channel: undefined,

    args: [
      "--disable-blink-features=AutomationControlled",
    ],

  });

  const context =
    await getContext(browser);

  const page =
    await context.newPage();

  //
  // ---------------------------------------
  // Venue page
  // ---------------------------------------
  //

  await page.goto(VENUE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await chooseBengaluru(
    page,
    context
  );

  await page.waitForTimeout(3000);

  const venueHtml =
    await page.content();

const allShows = parseVenuePage(venueHtml);

console.log(
  allShows.map((show) => ({
    id: show.eventId,
    title: show.title,
  }))
);

const rawPath = path.join("data", "raw-shows.json");

let existingShows: any[] = [];

try {
  existingShows = JSON.parse(
    await fs.readFile(rawPath, "utf8")
  );
} catch {
  existingShows = [];
}

const now = new Date();

// Past sessions are dropped. Listings scraped within the TTL are reused as-is;
// older ones are re-scraped (their old records are kept only as a fallback in
// case the re-scrape fails).
const { fresh, stale } = partitionCache(
  existingShows,
  now,
  FORCE || ONLY ? 0 : TTL_HOURS
);

const freshIds = new Set(fresh.map((s) => s.eventId));

console.log(
  `📦 Reusing ${fresh.length} session(s) from ${freshIds.size} recently scraped listing(s)`
);

const finalShows: any[] = [...fresh];

const ignoredShows = allShows.filter((show) =>
  scraperConfig.ignoredEvents.includes(show.eventId)
);

ignoredShows.forEach((show) =>
  console.log(`🚫 Ignoring: ${show.title} (${show.eventId})`)
);

const shows = allShows.filter(
  (show) =>
    !scraperConfig.ignoredEvents.includes(show.eventId) &&
    !freshIds.has(show.eventId) &&
    (!ONLY || show.eventId === ONLY)
);

console.log(
  `🚫 Ignoring ${allShows.length - shows.length} event(s)`
);


  //
  // ---------------------------------------
  // Visit every event
  // ---------------------------------------
  //

  for (let i = 0; i < shows.length; i++) {

    const summary = shows[i];

    console.log(
      `\n[${i + 1}/${shows.length}] ${summary.title}`
    );

    const scrapedAt = new Date().toISOString();

    try {

      const { details, sessions } =
        await fetchEventDetails(
          page,
          summary.bookingUrl
        );

      const base = {
        ...summary,
        ...details,
        // the venue page is the source of truth for identity
        eventId: summary.eventId || details.eventId,
        bookingUrl: summary.bookingUrl || details.bookingUrl,
      };

      if (sessions.length) {

        for (const session of sessions) {
          finalShows.push({
            ...base,
            ...session,
            // keep the listing price when a session has none of its own
            price: session.price ?? details.price,
            scrapedAt,
          });
        }

        console.log(
          `✅ ${sessions.length} session(s): ` +
          sessions.map((s) => `${s.date} ${s.time}`).join(" | ")
        );

      } else if (stale.has(summary.eventId)) {

        // collector found nothing but we have older data: keep it
        finalShows.push(...stale.get(summary.eventId)!);

        console.warn("⚠️ No sessions found, keeping previous data");

      } else {

        // last resort = the old behaviour: the single JSON-LD session
        finalShows.push({ ...base, scrapedAt });

        console.warn("⚠️ No sessions found, saved JSON-LD date only");
      }

    } catch (error) {

      console.error(
        "❌ Failed:",
        summary.bookingUrl
      );

      console.error(error);

      // don't lose a listing we already knew about
      if (stale.has(summary.eventId)) {
        finalShows.push(...stale.get(summary.eventId)!);
      }

    }

    //
    // Don't hammer BookMyShow
    //

    await page.waitForTimeout(1500);
  }

  //
  // ---------------------------------------
  // Save JSON
  // ---------------------------------------
  //

  // Listings we didn't visit (no longer on the venue page): keep their
  // upcoming sessions, as before, rather than silently dropping them.
  const visited = new Set(shows.map((s) => s.eventId));

  for (const [eventId, records] of stale) {
    if (!visited.has(eventId)) finalShows.push(...records);
  }

  finalShows.sort(
    (a, b) => Date.parse(a.startDate) - Date.parse(b.startDate)
  );

  await fs.mkdir("data", {
    recursive: true,
  });

  await fs.writeFile(
    path.join(
      "data",
      "raw-shows.json"
    ),
    JSON.stringify(
      finalShows,
      null,
      2
    )
  );

  console.log(
    `\n✅ Saved ${finalShows.length} sessions`
  );

  await browser.close();
}

run().catch(console.error);
