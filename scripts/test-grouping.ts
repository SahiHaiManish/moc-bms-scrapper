/**
 * Offline tests for src/lib/groupShows.ts.   npx tsx scripts/test-grouping.ts
 * Main property: on every day of the week, each displayed show appears in
 * exactly one section; mid-week (Mon-Thu) days are only hidden in advance and
 * appear as "Tonight" on their own day.
 */
import assert from "node:assert/strict";
import { Show, groupShows, isDisplayed } from "../src/lib/groupShows";
import { addDays, dateKey, weekdayOfKey } from "../src/lib/calendar";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

// Mon 5 Oct 2026 ... Sun 11 Oct 2026, all at 12:00 India time
const NOWS: Record<string, Date> = Object.fromEntries(
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => [
    d, new Date(`2026-10-${String(5 + i).padStart(2, "0")}T12:00:00+05:30`),
  ])
);

const show = (id: string, iso: string): Show => ({
  title: id, eventId: id, sessionId: id, category: "", image: "", bookingUrl: "", description: "", venue: "", address: "",
  startDate: iso, endDate: iso, duration: "", price: "", currency: "", performers: [], languages: [],
});

/** one show at 20:00 India time every day from `now` for `days` days (plus tonight at 23:00) */
function daily(now: Date, days = 21): Show[] {
  const today = dateKey(now);
  const out = [show("d0", `${today}T23:00:00+05:30`)];
  for (let i = 1; i < days; i++) out.push(show(`d${i}`, `${addDays(today, i)}T20:00:00+05:30`));
  return out;
}

const titles = (now: Date) => groupShows(daily(now), now).map((s) => s.title);
const byTitle = (now: Date) =>
  Object.fromEntries(groupShows(daily(now), now).map((s) => [s.title, s.shows.map((x) => x.title)]));

test("every displayed show lands in exactly one section; hidden ones are only the mid-week days", () => {
  for (const [name, now] of Object.entries(NOWS)) {
    const shows = daily(now);
    const placed = groupShows(shows, now).flatMap((s) => s.shows.map((x) => x.sessionId));
    const expected = shows.filter((s) => isDisplayed(s, now)).map((s) => s.sessionId);

    assert.deepEqual([...placed].sort(), [...expected].sort(), `${name}: sections != displayed shows`);
    assert.equal(new Set(placed).size, placed.length, `${name}: a show appears twice`);

    // anything not displayed is strictly between today and the coming weekend, and is Mon-Thu
    for (const s of shows.filter((x) => !isDisplayed(x, now))) {
      const k = dateKey(s.startDate);
      assert.ok(k > dateKey(now), `${name}: hid a show from today`);
      assert.ok([1, 2, 3, 4].includes(weekdayOfKey(k)), `${name}: hid a non-Mon-Thu day ${k}`);
    }
  }
});

test("sections per weekday: no 'This week' any more", () => {
  assert.deepEqual(titles(NOWS.Mon), ["Tonight", "Friday", "Saturday", "Sunday", "Coming Soon"]);
  assert.deepEqual(titles(NOWS.Tue), ["Tonight", "Friday", "Saturday", "Sunday", "Coming Soon"]);
  assert.deepEqual(titles(NOWS.Thu), ["Tonight", "Friday", "Saturday", "Sunday", "Coming Soon"]);
  assert.deepEqual(titles(NOWS.Fri), ["Tonight", "Saturday", "Sunday", "Coming Soon"]);
  assert.deepEqual(titles(NOWS.Sat), ["Tonight", "Sunday", "Coming Soon"]);
  assert.deepEqual(titles(NOWS.Sun), ["Tonight", "Friday", "Saturday", "Sunday", "Coming Soon"]);
});

test("Monday: Tue-Thu are not shown ahead of time; the weekend is", () => {
  const g = byTitle(NOWS.Mon);
  assert.deepEqual(g["Tonight"], ["d0"]);
  assert.deepEqual(g["Friday"], ["d4"]);
  assert.ok(!Object.values(g).flat().some((t) => ["d1", "d2", "d3"].includes(t)));
});

test("Sunday: Mon-Thu hidden, next weekend gets its sections, Coming Soon starts after it", () => {
  const g = byTitle(NOWS.Sun);
  assert.deepEqual(g["Tonight"], ["d0"]);
  assert.deepEqual([g["Friday"], g["Saturday"], g["Sunday"]], [["d5"], ["d6"], ["d7"]]);
  assert.equal(g["Coming Soon"][0], "d8");
  assert.ok(!Object.values(g).flat().some((t) => ["d1", "d2", "d3", "d4"].includes(t)));
});

test("a hidden mid-week show appears under Tonight when its own day arrives", () => {
  // Wednesday 7 Oct 20:00 is hidden on Monday 5 Oct ...
  const wed = show("wed", "2026-10-07T20:00:00+05:30");
  assert.equal(isDisplayed(wed, NOWS.Mon), false);
  assert.deepEqual(groupShows([wed], NOWS.Mon), []);
  assert.equal(isDisplayed(wed, NOWS.Tue), false);

  // ... but on Wednesday (even early morning) it is Tonight
  for (const at of ["2026-10-07T00:05:00+05:30", "2026-10-07T12:00:00+05:30", "2026-10-07T19:59:00+05:30"]) {
    assert.deepEqual(
      groupShows([wed], new Date(at)).map((s) => [s.title, s.shows.map((x) => x.title)]),
      [["Tonight", ["wed"]]],
      at
    );
  }
});

test("weekend sections keep their meaning on Thu / Sat", () => {
  assert.deepEqual([byTitle(NOWS.Thu)["Friday"], byTitle(NOWS.Thu)["Saturday"], byTitle(NOWS.Thu)["Sunday"]], [["d1"], ["d2"], ["d3"]]);
  assert.deepEqual(byTitle(NOWS.Sat)["Sunday"], ["d1"]);
  assert.equal(byTitle(NOWS.Sat)["Coming Soon"][0], "d2");
});

test("a show still on stage just after midnight stays under Tonight", () => {
  const now = new Date("2026-10-12T00:10:00+05:30"); // Mon, just after midnight
  const g = groupShows([show("late", "2026-10-11T23:59:00+05:30"), show("next", "2026-10-12T21:00:00+05:30")], now);
  assert.deepEqual(g.map((s) => [s.title, s.shows.map((x) => x.title)]), [["Tonight", ["late", "next"]]]);
});

test("empty sections are never returned; no shows -> no sections", () => {
  assert.deepEqual(groupShows([], NOWS.Sun), []);
  assert.ok(groupShows(daily(NOWS.Wed), NOWS.Wed).every((s) => s.shows.length > 0));
});

console.log(`\n${passed} grouping tests passed`);
