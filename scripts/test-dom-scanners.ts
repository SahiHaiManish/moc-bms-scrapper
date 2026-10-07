/**
 * Tests the in-page scanners (scripts/lib/domScanners.ts) without a browser.
 *
 *   npm i -D jsdom @types/jsdom        (one-off)
 *   npx tsx scripts/test-dom-scanners.ts                      # built-in fixtures
 *   npx tsx scripts/test-dom-scanners.ts playwright/sessions-failed-ET0001.html
 *
 * With a file argument it just prints what the scanners find in that page,
 * which is the fastest way to debug a "0 sessions found" run: open the HTML
 * the scraper dumped, see what the scanners see, tweak domScanners.ts, repeat.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

import { SCAN_DATE_TABS, SCAN_TIME_SLOTS } from "./lib/domScanners";

function scan(html: string) {
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  const win = dom.window as any;

  // jsdom has no layout, so every element looks invisible without this.
  win.__MOC_SKIP_VISIBILITY = true;

  return {
    document: win.document as Document,
    // JSON round-trip: jsdom arrays come from another realm and would fail
    // assert.deepEqual's prototype check.
    tabs: JSON.parse(JSON.stringify(win.eval(SCAN_DATE_TABS))) as {
      index: number; label: string; disabled: boolean;
    }[],
    slots: JSON.parse(JSON.stringify(win.eval(SCAN_TIME_SLOTS))) as {
      time: string; price?: number; soldOut: boolean;
    }[],
  };
}

// ---------------------------------------------------------------------------
// CLI mode: inspect a saved page
// ---------------------------------------------------------------------------

if (process.argv[2]) {
  const { tabs, slots } = scan(fs.readFileSync(process.argv[2], "utf8"));
  console.log("date tabs :", tabs);
  console.log("time slots:", slots);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("date tabs");

test("stacked <span>s inside buttons, disabled day flagged", () => {
  const { tabs, document } = scan(`
    <div>
      <button><span>TUE</span><span>28</span><span>JUL</span></button>
      <button><span>WED</span><span>29</span><span>JUL</span></button>
      <button disabled><span>THU</span><span>30</span><span>JUL</span></button>
    </div>`);

  assert.equal(tabs.length, 3);
  assert.deepEqual(tabs.map((t) => t.disabled), [false, false, true]);
  // the scanner tagged the <button>, not an inner span
  assert.equal(
    document.querySelector('[data-moc-date="0"]')?.tagName,
    "BUTTON"
  );
});

test("<li role=tab> with 'Fri, 9 Oct'; hidden duplicate strip collapses", () => {
  const { tabs } = scan(`
    <ul role="tablist">
      <li role="tab">Fri, 9 Oct</li><li role="tab">Sat, 10 Oct</li>
    </ul>
    <ul class="mobile-copy">
      <li role="tab">Fri, 9 Oct</li><li role="tab">Sat, 10 Oct</li>
    </ul>`);

  assert.deepEqual(tabs.map((t) => t.label), ["Fri, 9 Oct", "Sat, 10 Oct"]);
});

test("climbs to the outer wrapper that only holds that one date", () => {
  const { document, tabs } = scan(
    `<ul><li id="x"><div><span>Fri 9 Oct</span></div></li><li><div><span>Sat 10 Oct</span></div></li></ul>`
  );
  assert.equal(tabs.length, 2);
  assert.equal(document.querySelector('[data-moc-date="0"]')?.id, "x");
});

test("ignores prose and date ranges", () => {
  const { tabs } = scan(`
    <p>Tue 28 Jul 2026 - Wed 29 Jul 2026</p>
    <p>Doors open on Fri 9 Oct at 7pm, show begins later in the evening</p>`);
  assert.equal(tabs.length, 0);
});

test("falls back to 'day month' only on clickable elements", () => {
  const { tabs } = scan(`
    <p>28 Jul</p>
    <button>29 Jul</button>
    <button>30 Jul</button>`);
  assert.deepEqual(tabs.map((t) => t.label), ["29 Jul", "30 Jul"]);
});

console.log("time slots");

test("pills with sub-labels, price, and sold-out states", () => {
  const { slots } = scan(`
    <div>Ministry Of Comedy: Koramangala</div>
    <ul>
      <li><button><span>9:00 PM</span><span>Fast Filling</span></button></li>
      <li><button>6:00 PM</button></li>
      <li><div>8:00 PM ₹499</div></li>
      <li><button disabled>7:00 PM</button></li>
      <li><button>5:00 PM Sold Out</button></li>
    </ul>`);

  assert.deepEqual(
    slots.map((s) => [s.time, s.soldOut, s.price]),
    [
      ["9:00 PM", false, undefined],
      ["6:00 PM", false, undefined],
      ["8:00 PM", false, 499],
      ["7:00 PM", true, undefined],
      ["5:00 PM", true, undefined],
    ]
  );
});

test("containers holding several times, and prose, are not slots", () => {
  const { slots } = scan(`
    <div>9:00 PM 6:00 PM</div>
    <footer>Gates open at 8:00 PM, show starts 9:00 PM</footer>
    <p>Show runs 9:00 PM to 10:10 PM</p>`);
  assert.equal(slots.length, 0);
});

test("same time reported by wrapper + inner span is merged (sold-out wins)", () => {
  const { slots } = scan(
    `<button><span>7:30 PM</span> <em>Sold Out</em></button>`
  );
  assert.equal(slots.length, 1);
  assert.equal(slots[0].soldOut, true);
});

test("'Doors 8' is not mistaken for a price", () => {
  const { slots } = scan(`<div>9:00 PM Doors 8</div>`);
  assert.equal(slots[0].price, undefined);
});

console.log(`\n${passed} DOM scanner tests passed`);
