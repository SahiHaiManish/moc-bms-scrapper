import fs from "fs/promises";
import path from "path";

import scraperConfig from "../src/config/scraper.json";

import { parseVenuePage } from "../src/lib/parseVenuePage";

import { partitionCache } from "./lib/sessions";
import { filterVenueCards, isAtVenue } from "./lib/venueFilter";
import {
  ALLOWED_EVENTS,
  VENUE,
  chooseBengaluru,
  fetchEventDetails,
  getContext,
  launchBrowser,
  sessionRecords,
} from "./lib/scrapeCore";

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

async function run() {

  const browser = await launchBrowser();

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

const venueCards = parseVenuePage(venueHtml);

const { kept: allShows, dropped: offRegion } = filterVenueCards(
  venueCards,
  VENUE
);

offRegion.forEach(({ card, reason }) =>
  console.log(`🌍 Dropped ${card.title} (${card.eventId}): ${reason}`)
);

if (!allShows.length) {
  throw new Error(
    `The venue page gave no ${VENUE.region.regionName} / ${VENUE.host} events ` +
    `(${venueCards.length} card(s) seen). Not touching data/raw-shows.json. ` +
    `Check your network/VPN and re-run.`
  );
}

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

// Clean out records from earlier runs that are not Ministry of Comedy shows.
const notOurs = existingShows.filter(
  (s) => !isAtVenue(s, VENUE, ALLOWED_EVENTS).ok
);

if (notOurs.length) {
  const names = [...new Set(notOurs.map((s) => `${s.title} (${s.eventId})`))];

  console.log(`🧹 Removing ${notOurs.length} cached record(s) that are not Ministry of Comedy shows:`);
  names.forEach((n) => console.log(`     - ${n}`));

  existingShows = existingShows.filter(
    (s) => isAtVenue(s, VENUE, ALLOWED_EVENTS).ok
  );
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
const skipped: { id: string; title: string; reason: string }[] = [];

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

      const venueCheck = isAtVenue(
        { ...details, eventId: summary.eventId },
        VENUE,
        ALLOWED_EVENTS
      );

      if (!venueCheck.ok && !sessions.length) {

        // Not at our venue and sells nothing there: not ours, don't save it.
        skipped.push({
          id: summary.eventId,
          title: summary.title,
          reason: venueCheck.reason,
        });

        console.log(`🚫 Not a Ministry of Comedy show (${venueCheck.reason}): skipped`);

      } else if (sessions.length) {

        finalShows.push(
          ...sessionRecords(base, details, sessions, scrapedAt)
        );

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

  if (skipped.length) {
    console.log(`\n🚫 Skipped ${skipped.length} event(s) that are not at ${VENUE.name}:`);
    skipped.forEach((s) => console.log(`   ${s.id}  ${s.title}  — ${s.reason}`));
    console.log(`   (wrongly skipped? add the id to "allowedEvents" in src/config/scraper.json)`);
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

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
