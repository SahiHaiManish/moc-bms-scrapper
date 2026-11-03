/**
 * Offline tests for the scraping fixes.   npx tsx scripts/test-synopsis.ts
 * Optionally also checks your own saved pages: put BookMyShow event pages in
 * playwright/ (the scraper saves failed ones there) or set MOC_FIXTURES=<dir>.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { parseEventPage } from "../src/lib/parseEventPage";
import {
  bannerFromDom, cleanPageTitle, isoFromAnalytics, looksLikePageTitle, priceFromDom, priceFromText, readEventPage,
} from "../src/lib/synopsisState";
import { firstPrice, mergeListing } from "./lib/mergeDetails";

// the parser logs a lot; keep the test output readable
const realLog = console.log, realWarn = console.warn;
const quiet = <T,>(fn: () => T): T => { console.log = () => {}; console.warn = () => {}; try { return fn(); } finally { console.log = realLog; console.warn = realWarn; } };

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

// ---- fixtures: the real structure of an event page, cut down -----------------

const BANNER = "https://assets-in.bmscdn.com/nmcms/events/banner/desktop/media-desktop-yogi-0-2026-10-1.jpg";

function stateHtml(opts: { price?: string; primary?: boolean; title?: string; pageTitle?: string; img?: boolean } = {}) {
  const state = {
    eventsSynopsisApi: {
      queries: {
        getPrimaryData: { data: { widgets: opts.primary === false ? {} : { EVENT_BANNER: { cards: [{ image: { url: BANNER } }] } } } },
        getPrimarySessionData: {
          data: {
            meta: { analytics: { title: "Yogi Mayandi and Friends", event_code: "ET00999999", category: "Comedy Shows", start_date_time: "20261212|1800", end_date_time: "20261212|2000" } },
            header: { text: [{ components: [{ type: "text", text: opts.title ?? "Yogi Mayandi and Friends- A Tamil Comedy Show" }] }] },
            widgets: { BOOK_CTA: { cards: [{ text: [{ components: [{ text: opts.price ?? "₹199" }] }, { components: [{ text: "Available" }] }] }] } },
          },
        },
      },
    },
  };

  return `<html><head><title>${opts.pageTitle ?? "Yogi Mayandi and Friends- A Tamil Comedy Show comedy-shows Event Tickets Bengaluru - BookMyShow"}</title>
<meta property="og:image" content=""><meta property="og:title" content="">
<script type="application/ld+json">{"@type":"WebSite","name":"BookMyShow"}</script></head>
<body>${opts.img ? `<img src="${BANNER}" alt="">` : ""}<script>window.__INITIAL_STATE__ = ${JSON.stringify(state)};</script></body></html>`;
}

const LD_EVENT = (extra: object) => `<script type="application/ld+json">${JSON.stringify({
  "@type": "Event", name: "Ministry of Comedy Live", url: "https://in.bookmyshow.com/events/x/ET00111111",
  startDate: "2026-12-05T20:00:00+05:30", endDate: "2026-12-05T22:00:00+05:30",
  location: { name: "Ministry Of Comedy: Koramangala", address: { streetAddress: "Koramangala" } }, ...extra,
})}</script>`;

// ---- titles ------------------------------------------------------------------

test("browser-tab titles are cleaned, real titles untouched", () => {
  const cases: [string, string][] = [
    ["Yogi Mayandi and Friends- A Tamil Comedy Show comedy-shows Event Tickets Bengaluru - BookMyShow", "Yogi Mayandi and Friends- A Tamil Comedy Show"],
    ["Ministry of Comedy Presents! (Koramangala) comedy-shows Event Tickets Bengaluru - BookMyShow", "Ministry of Comedy Presents! (Koramangala)"],
    ["Two Piece Comedy Shows Event Tickets - BookMyShow", "Two Piece"],
    ["Ranmal Jain LIVE - New Material Hindi Storytelling Play Tickets - BookMyShow", "Ranmal Jain LIVE - New Material Hindi Storytelling Play"],
    ["Unscripted Improv Comedy Show - One &amp; A Half Men comedy-shows Event Tickets Bengaluru - BookMyShow", "Unscripted Improv Comedy Show - One & A Half Men"],
    ["Chalta Hai Comedy comedy-shows  Mumbai - BookMyShow", "Chalta Hai Comedy"],
    ["Toxic Pyaar: Relationship Comedy!", "Toxic Pyaar: Relationship Comedy!"],
    ["Standup Comedy Live - Tickets Night", "Standup Comedy Live - Tickets Night"],
  ];
  for (const [raw, want] of cases) assert.equal(cleanPageTitle(raw), want, raw);
  assert.equal(cleanPageTitle(""), "");
});

test("looksLikePageTitle flags tab text only", () => {
  assert.equal(looksLikePageTitle("Yogi Mayandi comedy-shows Event Tickets Bengaluru - BookMyShow"), true);
  assert.equal(looksLikePageTitle("Toxic Pyaar: Relationship Comedy!"), false);
  assert.equal(looksLikePageTitle("Main Ab Bhi Wahin Hun Hindi storytelling Play in Bengaluru"), false);
});

// ---- small readers -----------------------------------------------------------

test("prices and dates", () => {
  assert.equal(priceFromText("₹199"), 199);
  assert.equal(priceFromText("₹ 1,499 onwards"), 1499);
  assert.equal(priceFromText("Available"), 0);
  assert.equal(isoFromAnalytics("20261212|1800"), "2026-12-12T18:00:00+05:30");
  assert.equal(isoFromAnalytics("garbage"), "");
  assert.equal(priceFromDom("<p>Tickets ₹399</p><script>var a='₹5'</script>"), 399);
  assert.equal(priceFromDom("<p>₹ 499</p><p>₹299</p>"), 299);
  assert.equal(priceFromDom("<p>free</p>"), 0);
  assert.equal(bannerFromDom(`<img src="${BANNER}">`), BANNER);
  assert.equal(bannerFromDom(`<img src="https://x.com/other.jpg">`), "");
});

// ---- the page reader ---------------------------------------------------------

test("event page with no event JSON-LD: clean title, price, image, category-free, dates", () => {
  const r = readEventPage(stateHtml());
  assert.deepEqual(r, { eventId: "ET00999999", title: "Yogi Mayandi and Friends- A Tamil Comedy Show", category: "Comedy Shows", price: 199, image: BANNER, startDate: "2026-12-12T18:00:00+05:30", endDate: "2026-12-12T20:00:00+05:30" });
});

test("photo missing from the data block (server sent it early): taken from the page's <img>", () => {
  assert.equal(readEventPage(stateHtml({ primary: false })).image, "");
  assert.equal(readEventPage(stateHtml({ primary: false, img: true })).image, BANNER);
});

test("no data block at all: still a clean title and a visible price", () => {
  const r = readEventPage(`<title>Dum Hona Usme Comedy Shows Event Tickets - BookMyShow</title><body><img src="${BANNER}"><p>₹399</p></body>`);
  assert.equal(r.title, "Dum Hona Usme"); assert.equal(r.price, 399); assert.equal(r.image, BANNER); assert.equal(r.eventId, "");
});

test("never throws on junk", () => {
  for (const html of ["", "<html>", "window.__INITIAL_STATE__ = {broken", "window.__INITIAL_STATE__ = {};</script>"]) {
    assert.doesNotThrow(() => readEventPage(html));
  }
});

// ---- parseEventPage (the old behaviour is kept, the gaps are filled) -----------

test("parseEventPage without JSON-LD no longer returns a browser-tab title, 0 price, empty image", () => {
  const d = quiet(() => parseEventPage(stateHtml({ img: true })));
  assert.equal(d.title, "Yogi Mayandi and Friends- A Tamil Comedy Show");
  assert.equal(d.price, 199); assert.equal(d.currency, "INR");
  assert.equal(d.image, BANNER);
  assert.equal(d.eventId, "ET00999999");
  assert.equal(d.startDate, "2026-12-12T18:00:00+05:30");
});

test("parseEventPage with JSON-LD: its values win, gaps (image, price) are filled from the page", () => {
  const full = quiet(() => parseEventPage(stateHtml().replace("</head>", LD_EVENT({ image: "https://ld/img.jpg", offers: { lowPrice: 299, priceCurrency: "INR" } }) + "</head>")));
  assert.equal(full.image, "https://ld/img.jpg"); assert.equal(full.price, 299); assert.equal(full.title, "Ministry of Comedy Live");

  const gaps = quiet(() => parseEventPage(stateHtml().replace("</head>", LD_EVENT({}) + "</head>")));
  assert.equal(gaps.image, BANNER); assert.equal(gaps.price, 199); assert.equal(gaps.title, "Ministry of Comedy Live");
});

// ---- merging with the venue card ---------------------------------------------

test("mergeListing: empty or zero details never overwrite the venue card", () => {
  const card = { title: "Yogi Mayandi and Friends", image: "https://card/poster.jpg", category: "Comedy Shows", language: ["Tamil"], eventId: "E", bookingUrl: "u" };
  const m = mergeListing(card, { title: "", image: "", price: 0, performers: [], languages: [], description: "", venue: "Ministry Of Comedy" });
  assert.equal(m.image, "https://card/poster.jpg"); assert.equal(m.title, "Yogi Mayandi and Friends"); assert.equal(m.price, undefined);
  assert.deepEqual(m.language, ["Tamil"]); assert.equal(m.venue, "Ministry Of Comedy"); assert.equal(m.category, "Comedy Shows");
  assert.deepEqual(m.performers, [], "an empty list is kept as a list, never a missing field (the dialog reads it)");
  assert.deepEqual(m.languages, []);
});

test("mergeListing: real details win; a browser-tab title loses to the card title", () => {
  const card = { title: "Card Title", image: "https://card/p.jpg" };
  const real = mergeListing(card, { title: "Page Title", image: "https://page/i.jpg", price: 249, performers: ["A"] });
  assert.deepEqual([real.title, real.image, real.price, real.performers], ["Page Title", "https://page/i.jpg", 249, ["A"]]);

  const tab = mergeListing(card, { title: "X comedy-shows Event Tickets Bengaluru - BookMyShow" });
  assert.equal(tab.title, "Card Title");
  assert.equal(mergeListing({}, { title: "X comedy-shows Event Tickets Bengaluru - BookMyShow" }).title, "X");
});

test("mergeListing: an empty list never wipes a non-empty one", () => {
  assert.deepEqual(mergeListing({ performers: ["A"], language: ["Tamil"] }, { performers: [], language: [] }).performers, ["A"]);
  assert.deepEqual(mergeListing({ language: ["Tamil"] }, { language: [] }).language, ["Tamil"]);
  assert.deepEqual(mergeListing({}, { performers: ["B"] }).performers, ["B"]);
});

test("firstPrice picks the first real price, never a 0", () => {
  assert.equal(firstPrice(undefined, 0, 199, 299), 199);
  assert.equal(firstPrice(499, 199), 499);
  assert.equal(firstPrice(undefined, 0, NaN, "abc"), 0);
  assert.equal(firstPrice("249"), 249);
});

// ---- your own saved pages (skipped when there are none) -------------------------

const dir = process.env.MOC_FIXTURES ?? "playwright";
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^failed-ET\d+\.html$/.test(f)) : [];

if (files.length) {
  test(`${files.length} saved event page(s): every one gets a clean title and an image`, () => {
    for (const f of files) {
      const d = quiet(() => parseEventPage(fs.readFileSync(path.join(dir, f), "utf8")));
      assert.ok(d.title && !looksLikePageTitle(d.title), `${f}: title "${d.title}"`);
      assert.ok(/^https?:\/\//.test(d.image), `${f}: image "${d.image}"`);
    }
  });
} else {
  console.log("  (no saved pages in ./playwright: skipping the real-page check)");
}

console.log(`\n${passed} scrape-fix tests passed`);
