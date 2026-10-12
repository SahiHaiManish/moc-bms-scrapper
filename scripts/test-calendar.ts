/** Offline tests for src/lib/calendar.ts.   npx tsx scripts/test-calendar.ts */
import assert from "node:assert/strict";
import { bucketByDate, dateKey, dayTitle, pickDate, spokenDay } from "../src/lib/calendar";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

// Thu 8 Oct 2026, 11:00 IST
const NOW = new Date("2026-10-08T11:00:00+05:30");
const at = (iso: string) => ({ startDate: iso });

test("a show belongs to its INDIA date, even when UTC says another day", () => {
  // 00:30 IST on 9 Oct is 19:00 UTC on 8 Oct; a naive UTC date would file it under the 8th
  assert.equal(dateKey("2026-10-09T00:30:00+05:30"), "2026-10-09");
  // 23:59 IST on 8 Oct is 18:29 UTC the same day
  assert.equal(dateKey("2026-10-08T23:59:00+05:30"), "2026-10-08");
  // the same instant written in UTC gives the same India date
  assert.equal(dateKey("2026-10-08T19:00:00Z"), "2026-10-09");
});

test("dates are bucketed, counted and sorted, with today/tomorrow flagged", () => {
  const b = bucketByDate(
    [
      at("2026-10-10T20:00:00+05:30"),
      at("2026-10-08T21:00:00+05:30"),
      at("2026-10-10T18:00:00+05:30"),
      at("2026-10-09T23:00:00+05:30"),
      at("2026-10-10T22:30:00+05:30"),
    ],
    NOW
  );

  assert.deepEqual(b.map((x) => [x.key, x.count]), [["2026-10-08", 1], ["2026-10-09", 1], ["2026-10-10", 3]]);
  assert.deepEqual(b.map((x) => [x.isToday, x.isTomorrow]), [[true, false], [false, true], [false, false]]);
  assert.deepEqual([b[2].weekday, b[2].day, b[2].month], ["Sat", 10, "Oct"]);
});

test("late-night shows stay on the right day; no empty days are invented", () => {
  const b = bucketByDate([at("2026-10-08T23:59:00+05:30"), at("2026-10-12T00:30:00+05:30")], NOW);
  assert.deepEqual(b.map((x) => x.key), ["2026-10-08", "2026-10-12"]); // nothing for 9, 10, 11
});

test("today/tomorrow still correct when the visitor's clock is just before India midnight", () => {
  const lateNow = new Date("2026-10-08T23:50:00+05:30");
  const b = bucketByDate([at("2026-10-08T23:59:00+05:30"), at("2026-10-09T20:00:00+05:30")], lateNow);
  assert.deepEqual(b.map((x) => [x.isToday, x.isTomorrow]), [[true, false], [false, true]]);
});

test("month and year boundaries sort and label correctly", () => {
  const now = new Date("2026-12-30T10:00:00+05:30");
  const b = bucketByDate([at("2027-01-02T20:00:00+05:30"), at("2026-12-31T21:00:00+05:30")], now);
  assert.deepEqual(b.map((x) => x.key), ["2026-12-31", "2027-01-02"]);
  assert.equal(b[1].weekdayLong, "Saturday"); // 2 Jan 2027 is a Saturday
  assert.equal(b[1].monthLong, "January");
});

test("headings and spoken labels", () => {
  const [today, tomorrow, later] = bucketByDate(
    [at("2026-10-08T21:00:00+05:30"), at("2026-10-09T21:00:00+05:30"), at("2026-10-10T21:00:00+05:30"), at("2026-10-10T19:00:00+05:30")],
    NOW
  );
  assert.equal(dayTitle(today), "Tonight");
  assert.equal(dayTitle(tomorrow), "Tomorrow");
  assert.equal(dayTitle(later), "Sat, 10 Oct");
  assert.equal(spokenDay(later), "Saturday 10 October, 2 shows");
  assert.equal(spokenDay(today), "Thursday 8 October, 1 show");
});

test("?date= is accepted only when a show is on that day", () => {
  const b = bucketByDate([at("2026-10-10T20:00:00+05:30")], NOW);
  assert.equal(pickDate("2026-10-10", b), "2026-10-10");
  assert.equal(pickDate("2026-10-11", b), null);   // valid format, no shows
  assert.equal(pickDate("yesterday", b), null);    // junk
  assert.equal(pickDate("2026-10-10<script>", b), null);
  assert.equal(pickDate(null, b), null);
});

console.log(`\n${passed} calendar tests passed`);
