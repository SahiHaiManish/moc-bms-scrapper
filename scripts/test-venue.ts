/**
 * Offline tests for the India / Ministry-of-Comedy rules.
 *   npx tsx scripts/test-venue.ts        (run from the project root)
 * Uses your saved venue page and data/raw-shows.json when they exist.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

import config from "../src/config/scraper.json";
import { parseVenuePage } from "../src/lib/parseVenuePage";
import {
  VenueConfig,
  filterVenueCards,
  isAtVenue,
  regionCookies,
  venueCodeFromUrl,
} from "./lib/venueFilter";

const cfg = config.venue as VenueConfig;
const allowed = config.allowedEvents as string[];

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log("India / Bengaluru");

test("region cookies carry Bengaluru, India and are manual", () => {
  const [rgn, geo] = regionCookies(cfg, Date.parse("2026-10-08T00:00:00Z"));
  const decoded = JSON.parse(decodeURIComponent(rgn.value));

  assert.equal(rgn.name, "rgn");
  assert.equal(rgn.domain, "in.bookmyshow.com");
  assert.equal(decoded.regionCode, "BANG");
  assert.equal(decoded.countryCode, "IN");
  assert.ok(rgn.expires > Date.parse("2026-10-08T00:00:00Z") / 1000);
  assert.equal(JSON.parse(decodeURIComponent(geo.value))["x-location-selection"], "manual");
});

test("venue cards: foreign host and other regions are dropped, unknown region kept", () => {
  const mk = (url: string, regionCode?: string) => ({ title: "t", bookingUrl: url, regionCode });
  const { kept, dropped } = filterVenueCards(
    [
      mk("https://in.bookmyshow.com/events/a/ET1", "BANG"),
      mk("https://in.bookmyshow.com/events/b/ET2", "MUMBAI"),
      mk("https://ae.bookmyshow.com/events/c/ET3", "BANG"),
      mk("https://in.bookmyshow.com/events/d/ET4"),
      mk("not a url", "BANG"),
    ],
    cfg
  );

  assert.deepEqual(kept.map((c) => c.bookingUrl.slice(-3)), ["ET1", "ET4"]);
  assert.equal(dropped.length, 3);
});

if (fs.existsSync("playwright/page.html")) {
  test("your saved venue page: all 26 cards are Bengaluru + in.bookmyshow.com", () => {
    const cards = parseVenuePage(fs.readFileSync("playwright/page.html", "utf8"));
    const { kept, dropped } = filterVenueCards(cards, cfg);

    assert.equal(cards.length, 26);
    assert.ok(cards.every((c) => c.regionCode === "BANG"));
    assert.equal(kept.length, 26);
    assert.equal(dropped.length, 0);
  });
}

console.log("Ministry of Comedy only");

test("rejects other clubs, other cities, foreign currency, and empty data", () => {
  const bad = [
    { venue: "The Grin Club", address: "Indiranagar, Bengaluru, Karnataka, India", currency: "INR" },
    { venue: "Ministry Of Comedy: Andheri", address: "Andheri West, Mumbai, Maharashtra, India", currency: "INR" },
    { venue: "Ministry Of Comedy: Koramangala", address: "Koramangala, Bengaluru, India", currency: "USD" },
    { venue: "Comedy Cellar", address: "117 MacDougal St, New York, NY 10012, USA", currency: "USD" },
    { venue: "", address: "", currency: "" }, // e.g. the 2023 "The Comedy Theatre" leftover
  ];

  for (const e of bad) {
    assert.equal(isAtVenue(e, cfg).ok, false, JSON.stringify(e));
  }
});

test("allowedEvents overrides the venue check", () => {
  assert.equal(isAtVenue({ eventId: "ET9", venue: "Somewhere Else" }, cfg, ["ET9"]).ok, true);
});

if (fs.existsSync("data/raw-shows.json")) {
  test("every confirmed Ministry of Comedy event in your data passes", () => {
    const raw = JSON.parse(fs.readFileSync("data/raw-shows.json", "utf8"));
    const real = raw.filter((s: any) => s.venue);       // 19 have a venue
    const failed = real.filter((s: any) => !isAtVenue(s, cfg, allowed).ok);

    assert.ok(real.length >= 15, `expected many events, got ${real.length}`);
    assert.deepEqual(failed.map((s: any) => s.title), []);
  });

  test("…and the venue-less 2023 leftover is the one that doesn't", () => {
    const raw = JSON.parse(fs.readFileSync("data/raw-shows.json", "utf8"));
    const rejected = raw.filter((s: any) => !isAtVenue(s, cfg, allowed).ok);

    assert.deepEqual(rejected.map((s: any) => s.eventId), ["ET00349647"]);
  });
}

test("venue code is read from date-time urls", () => {
  assert.equal(venueCodeFromUrl("https://in.bookmyshow.com/events/x/ET1/date-time/MCBK?a=1"), "MCBK");
  assert.equal(venueCodeFromUrl("https://in.bookmyshow.com/events/x/ET1/date-time/abcd"), "ABCD");
  assert.equal(venueCodeFromUrl("https://in.bookmyshow.com/events/x/ET1"), null);
});

console.log(`\n${passed} venue tests passed`);
