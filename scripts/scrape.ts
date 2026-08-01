import scraperConfig from "../src/config/scraper.json";
import { chromium, Page, BrowserContext } from "playwright";
import fs from "fs/promises";
import path from "path";
import { parseISO, isAfter } from "date-fns";

import { parseVenuePage } from "../src/lib/parseVenuePage";
import { parseEventPage } from "../src/lib/parseEventPage";

import { reachTicketPage } from "./bookingFlow";
import { parseTicketPage } from "./parseTicketPage";

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
) {

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

  let eventDetails;

  try {

    eventDetails = parseEventPage(eventHtml);

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

  await reachTicketPage(page);

  //
  // ---------------------------------------
  // Parse ticket page
  // ---------------------------------------
  //

  const ticketDetails =
    await parseTicketPage(page);

  //
  // ---------------------------------------
  // Merge
  // ---------------------------------------
  //

  return {
    ...eventDetails,
    ...ticketDetails,
  };
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

// Keep only future shows
existingShows = existingShows.filter((show) =>
  isAfter(parseISO(show.startDate), now)
);

console.log(
  `📦 Retained ${existingShows.length} upcoming cached shows`
);

const existingIds = new Set(
  existingShows.map((s) => s.eventId)
);

const finalShows = [...existingShows];



const ignoredShows = allShows.filter((show) =>
  scraperConfig.ignoredEvents.includes(show.eventId)
);

ignoredShows.forEach((show) =>
  console.log(`🚫 Ignoring: ${show.title} (${show.eventId})`)
);

const shows = allShows.filter(
  (show) =>
    !scraperConfig.ignoredEvents.includes(show.eventId) &&
    !existingIds.has(show.eventId)
);

console.log(
  `⚡ Skipping ${existingIds.size} cached event(s)`
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

    try {

      const details =
        await fetchEventDetails(
          page,
          summary.bookingUrl
        );

      finalShows.push({

        ...summary,

        ...details,

      });

      console.log("✅ Parsed");

    } catch (error) {

      console.error(
        "❌ Failed:",
        summary.bookingUrl
      );

      console.error(error);

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
    `\n✅ Saved ${finalShows.length} shows`
  );

  await browser.close();
}

run().catch(console.error);
