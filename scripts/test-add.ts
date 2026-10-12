/**
 * Tests `npm run add` end-to-end against a FAKE browser page:
 *   - the event page is your real saved page (playwright/event.html, ET00312493)
 *   - the date/time page is a small interactive fixture
 *   npm i -D jsdom @types/jsdom   (one-off)      npx tsx scripts/test-add.ts
 * Nothing touches BookMyShow, and nothing in your project is modified.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JSDOM } from "jsdom";

import { spawnSync } from "node:child_process";

import { addEvent, addToAllowList, parseEventLink, replaceEventRecords } from "./lib/addEvent";

const PROJECT = process.cwd();                       // before we move into a temp dir
const ADD_CLI = path.resolve("scripts/add.ts");

const EVENT_HTML = fs.readFileSync(path.resolve("playwright/event.html"), "utf8");

// fetchEventDetails may write debug files into ./playwright; keep that out of your project
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "moc-add-")));
fs.mkdirSync("playwright");

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

// --- fixtures ---------------------------------------------------------------

const ist = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" })
      .formatToParts(d).map((p) => [p.type, p.value])
  );
  return `${parts.weekday} ${parts.day} ${parts.month}`;
};

/** an interactive date picker: clicking a date swaps the time slots */
function dateTimePage(days: Record<string, string[]>, disabled = false) {
  const tabs = Object.keys(days)
    .map((d) => `<div role="button" ${disabled ? 'aria-disabled="true"' : ""}>${d}</div>`)
    .join("");

  return `<body><div id="strip">${tabs}</div><div id="slots"></div><script>
    var data=${JSON.stringify(days)};
    function show(k){document.getElementById('slots').innerHTML=(data[k]||[]).map(function(t){return '<div>'+t+'</div>'}).join('');}
    document.querySelectorAll('#strip div').forEach(function(b){b.addEventListener('click',function(){show(b.textContent)})});
    show(Object.keys(data)[0]);
  </script></body>`;
}

/** minimal stand-in for a Playwright page */
function fakePage(eventHtml: string, dateTimeHtml: string) {
  let dom: JSDOM | null = null;
  let url = "";

  return {
    goto: async (u: string) => {
      url = u;
      dom = null;

      if (u.includes("/date-time/")) {
        dom = new JSDOM(dateTimeHtml, { runScripts: "dangerously", url: "https://in.bookmyshow.com/" });
        (dom.window as any).__MOC_SKIP_VISIBILITY = true;
      }
    },
    url: () => url,
    title: async () => "fixture",
    content: async () => (dom ? dom.serialize() : eventHtml),
    waitForTimeout: (ms: number) => new Promise((r) => setTimeout(r, Math.min(ms, 20))),
    waitForResponse: () => new Promise((r) => setTimeout(() => r(null), 20)),
    screenshot: async () => {},
    evaluate: async (script: string) => JSON.parse(JSON.stringify((dom!.window as any).eval(script))),
    on() {}, off() {},
    locator: (sel: string) => ({
      first: () => ({
        scrollIntoViewIfNeeded: async () => {},
        click: async () => (dom!.window as any).document.querySelector(sel).click(),
        evaluate: async (f: any) => f((dom!.window as any).document.querySelector(sel)),
      }),
    }),
  } as any;
}

/** rewrite the event page's JSON-LD (venue, start date ...) */
function editEvent(html: string, edit: (event: any) => void) {
  return html.replace(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi, (whole, body) => {
    try {
      const json = JSON.parse(body);
      for (const item of Array.isArray(json) ? json : [json]) {
        if (item && /Event/.test(String(item["@type"]))) edit(item);
      }
      return whole.replace(body, () => JSON.stringify(json));
    } catch {
      return whole;
    }
  });
}

const LINK = { eventId: "ET00312493", url: "https://in.bookmyshow.com/events/stand-up-comedy-live/ET00312493" };
const TWO_DAYS = { [ist(1)]: ["8:00 PM", "10:00 PM"], [ist(2)]: ["6:30 PM"] };

(async () => {
  console.log("links");

  await test("accepts links as people copy them", () => {
    const want = { eventId: "ET00312493", url: LINK.url };

    assert.deepEqual(parseEventLink(LINK.url), want);
    assert.deepEqual(parseEventLink(LINK.url + "?webview=true&utm=x#top"), want);
    assert.deepEqual(parseEventLink(LINK.url + "/date-time/MCBK"), want);
    assert.deepEqual(parseEventLink("  " + LINK.url.replace("ET0", "et0") + "  "), want);
  });

  await test("rejects things that aren't an event link, with a helpful message", () => {
    for (const bad of ["ET00312493", "not a link", "https://ae.bookmyshow.com/events/x/ET00312493", "https://in.bookmyshow.com/explore/c/venues/x/mcbk"]) {
      const r = parseEventLink(bad);
      assert.ok("error" in r && r.error.length > 10, bad);
    }
  });

  console.log("adding an event");

  await test("reads the event and every date + time at the venue", async () => {
    const out = await addEvent(fakePage(EVENT_HTML, dateTimePage(TWO_DAYS)), LINK, []);

    assert.equal(out.kind, "added");
    if (out.kind !== "added") return;

    assert.equal(out.records.length, 3);
    assert.equal(out.sessions.length, 3);
    assert.equal(out.needsAllowList, false);

    for (const r of out.records) {
      assert.equal(r.eventId, "ET00312493");
      assert.equal(r.bookingUrl, LINK.url);
      assert.equal(r.venue, "Ministry Of Comedy: Koramangala");
      assert.equal(r.category, "Stand up Comedy");
      assert.equal(r.regionCode, "BANG");
      assert.equal(typeof r.price, "number");
      assert.ok(Array.isArray(r.performers));
      assert.match(r.startDate, /\+05:30$/);
      assert.ok(r.sessionId.startsWith("ET00312493@") && r.scrapedAt);
    }

    assert.equal(new Set(out.records.map((r) => r.sessionId)).size, 3);
    assert.deepEqual(out.records.map((r) => r.time), ["8:00 PM", "10:00 PM", "6:30 PM"]);
  });

  await test("adding again refreshes that event only, keeping its category", async () => {
    const previous = [
      { eventId: "ET00312493", category: "Improv Comedy", language: ["Hindi"], startDate: "2099-01-01T20:00:00+05:30" },
      { eventId: "ET99999999", category: "Stand up Comedy", startDate: "2099-02-01T20:00:00+05:30" },
    ];

    const out = await addEvent(fakePage(EVENT_HTML, dateTimePage(TWO_DAYS)), LINK, previous);
    assert.equal(out.kind, "added");
    if (out.kind !== "added") return;

    assert.equal(out.category, "Improv Comedy");
    assert.equal(out.categorySource, "existing");
    assert.deepEqual(out.records[0].language, ["Hindi"]);

    const raw = replaceEventRecords(previous as any, "ET00312493", out.records);
    assert.equal(raw.filter((r) => r.eventId === "ET00312493").length, 3);        // old record replaced
    assert.equal(raw.filter((r) => r.eventId === "ET99999999").length, 1);        // the other event untouched
    assert.deepEqual(raw.map((r) => r.startDate), [...raw.map((r) => r.startDate)].sort((a, b) => Date.parse(a) - Date.parse(b)));
  });

  await test("--category overrides", async () => {
    const out = await addEvent(fakePage(EVENT_HTML, dateTimePage(TWO_DAYS)), LINK, [{ eventId: "ET00312493", category: "Improv Comedy" }], { category: "Storytelling" });
    assert.ok(out.kind === "added" && out.category === "Storytelling" && out.categorySource === "flag");
  });

  console.log("things that shouldn't just get added");

  const otherClub = editEvent(EVENT_HTML, (e) => {
    e.location = { ...e.location, name: "The Grin Club", address: { ...(e.location?.address ?? {}), streetAddress: "Linking Road, Bandra, Mumbai" } };
  });

  await test("another club's event is refused, and --force adds it AND flags it for the allow-list", async () => {
    const refused = await addEvent(fakePage(otherClub, dateTimePage(TWO_DAYS)), LINK, []);
    assert.ok(refused.kind === "refused" && /The Grin Club/.test(refused.reason));

    const forced = await addEvent(fakePage(otherClub, dateTimePage(TWO_DAYS)), LINK, [], { force: true });
    assert.ok(forced.kind === "added" && forced.needsAllowList === true && forced.records.length === 3);
  });

  await test("a page that can't be read is reported, not saved", async () => {
    const out = await addEvent(fakePage("<html><body>captcha</body></html>", dateTimePage(TWO_DAYS)), LINK, []);
    assert.equal(out.kind, "failed");
  });

  await test("a listing whose only date has already passed adds nothing", async () => {
    // slots but no date strip, and the event's own date is in the past
    const past = editEvent(EVENT_HTML, (e) => { e.startDate = "2020-01-01T21:00:00+05:30"; });
    const out = await addEvent(fakePage(past, "<body><div>9:00 PM</div></body>"), LINK, []);
    assert.equal(out.kind, "nothing");
  });

  await test("if the date list can't be read, falls back to the event's own (upcoming) date, with a warning", async () => {
    const soon = editEvent(EVENT_HTML, (e) => { e.startDate = new Date(Date.now() + 2 * 86_400_000).toISOString(); });
    const out = await addEvent(fakePage(soon, dateTimePage({ [ist(1)]: ["8:00 PM"], [ist(2)]: ["8:00 PM"] }, true)), LINK, []);
    assert.ok(out.kind === "added" && out.records.length === 1 && /full list of dates/.test(out.note ?? ""));
  });

  console.log("command line");

  const cli = (...args: string[]) =>
    spawnSync("npx", ["tsx", ADD_CLI, ...args], { cwd: PROJECT, encoding: "utf8" });

  await test("no link -> usage help, nothing launched", () => {
    const r = cli();
    assert.equal(r.status, 1);
    assert.match(r.stdout, /npm run add/);
  });

  await test("a bad link is rejected before any browser opens", () => {
    for (const bad of ["not-a-link", "https://example.com/events/x/ET00312493", "https://in.bookmyshow.com/events/x"]) {
      const r = cli(bad);
      assert.equal(r.status, 1, bad);
      assert.match(r.stderr, /❌/, bad);
    }
  });

  await test("--force's allow-list edit keeps the rest of the config and never duplicates", async () => {
    const file = path.join(process.cwd(), "scraper.json");
    fs.writeFileSync(file, JSON.stringify({ ignoredEvents: ["ET1"], venue: { code: "MCBK" }, allowedEvents: ["ET2"] }));

    await addToAllowList(file, "ET3");
    await addToAllowList(file, "ET3");

    const after = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(after.allowedEvents, ["ET2", "ET3"]);
    assert.deepEqual(after.ignoredEvents, ["ET1"]);
    assert.deepEqual(after.venue, { code: "MCBK" });
  });

  console.log(`\n${passed} add-event tests passed`);
})();
