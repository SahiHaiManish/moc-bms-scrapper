/**
 * Offline tests for scripts/lib/sessions.ts.   Run:  npx tsx scripts/test-sessions.ts
 * No browser, no network, no extra dependencies.
 */
import assert from "node:assert/strict";

import {
  buildSessions,
  durationMinutesFrom,
  labelFromIso,
  parseDateLabel,
  parseIsoDurationMinutes,
  parseTime,
  partitionCache,
  resolveDate,
} from "./lib/sessions";

let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

// "Now" for every test: Wed 7 Oct 2026, 11:00 IST
const NOW = new Date("2026-10-07T11:00:00+05:30");

console.log("parseDateLabel");

test("stacked tab text with no separators (textContent of spans)", () => {
  assert.deepEqual(parseDateLabel("TUE28JUL"), {
    weekday: 2, day: 28, month: 7, year: undefined,
  });
});

test("spaced, comma, ordinal and year variants", () => {
  assert.equal(parseDateLabel("Fri 9 Oct")?.day, 9);
  assert.equal(parseDateLabel("Fri, 9 Oct")?.month, 10);
  assert.equal(parseDateLabel("Sat 10th Oct")?.day, 10);
  assert.equal(parseDateLabel("Tue 28 Jul 2026")?.year, 2026);
  assert.equal(parseDateLabel("Sept 5")?.month, 9);
  assert.equal(parseDateLabel("Today"), null);
});

console.log("resolveDate (year inference)");

test("picks this year when the date is still ahead", () => {
  const p = parseDateLabel("Fri 9 Oct")!;
  assert.deepEqual(resolveDate(p, NOW), { y: 2026, m: 10, d: 9 });
});

test("rolls over to next year across new year, validated by weekday", () => {
  // 1 Jan 2027 is a Friday
  const late = new Date("2026-12-28T10:00:00+05:30");
  assert.deepEqual(resolveDate(parseDateLabel("Fri 1 Jan")!, late), {
    y: 2027, m: 1, d: 1,
  });
});

test("weekday disambiguates the year", () => {
  // 9 Oct 2026 is a Friday; 9 Oct 2027 is a Saturday.
  assert.equal(resolveDate(parseDateLabel("Fri 9 Oct")!, NOW)?.y, 2026);
  // "Sat 9 Oct" can't be 2026, so it must resolve to 2027
  assert.equal(resolveDate(parseDateLabel("Sat 9 Oct")!, NOW)?.y, 2027);
});

test("rejects impossible dates", () => {
  assert.equal(resolveDate(parseDateLabel("30 Feb")!, NOW), null);
});

console.log("parseTime / durations");

test("12-hour clock edge cases", () => {
  assert.deepEqual(parseTime("12:00 AM"), { h: 0, mi: 0 });
  assert.deepEqual(parseTime("12:30 PM"), { h: 12, mi: 30 });
  assert.deepEqual(parseTime("8:00 PM"), { h: 20, mi: 0 });
  assert.deepEqual(parseTime("7pm"), { h: 19, mi: 0 });
  assert.equal(parseTime("13:00 PM"), null);
});

test("ISO durations", () => {
  assert.equal(parseIsoDurationMinutes("PT1H10M"), 70);
  assert.equal(parseIsoDurationMinutes("PT90M"), 90);
  assert.equal(parseIsoDurationMinutes("garbage"), undefined);
});

test("duration falls back to start/end, then to a default", () => {
  assert.equal(
    durationMinutesFrom({
      startDate: "2026-10-10T18:00:00+05:30",
      endDate: "2026-10-10T19:15:00+05:30",
    }),
    75
  );
  // an end date days later means "end of the run", not show length
  assert.equal(
    durationMinutesFrom({
      startDate: "2026-07-28T21:00:00+05:30",
      endDate: "2026-07-29T21:00:00+05:30",
    }),
    90
  );
});

console.log("buildSessions");

test("one listing, three days: Fri 8pm, Sat 6pm, Sun 5pm -> three sessions", () => {
  const sessions = buildSessions(
    [
      { dateLabel: "FRI 9 OCT", time: "8:00 PM", price: 499 },
      { dateLabel: "SAT 10 OCT", time: "6:00 PM", price: 499 },
      { dateLabel: "SUN 11 OCT", time: "5:00 PM", price: 399, soldOut: true },
    ],
    { eventId: "ET00000001", durationMinutes: 70, now: NOW }
  );

  assert.equal(sessions.length, 3);
  assert.deepEqual(
    sessions.map((s) => s.startDate),
    [
      "2026-10-09T20:00:00+05:30",
      "2026-10-10T18:00:00+05:30",
      "2026-10-11T17:00:00+05:30",
    ]
  );
  assert.equal(sessions[0].endDate, "2026-10-09T21:10:00+05:30");
  assert.equal(sessions[0].sessionId, "ET00000001@20261009T2000");
  assert.equal(sessions[2].availability, "sold_out");
  assert.equal(sessions[0].date, "Fri 9 Oct");
});

test("two shows on the same day stay separate", () => {
  const sessions = buildSessions(
    [
      { dateLabel: "SAT 10 OCT", time: "6:00 PM" },
      { dateLabel: "SAT 10 OCT", time: "8:30 PM" },
    ],
    { eventId: "ET00000002", durationMinutes: 60, now: NOW }
  );
  assert.equal(sessions.length, 2);
});

test("exact duplicates collapse; sold-out only if every sighting says so", () => {
  const sessions = buildSessions(
    [
      { dateLabel: "SAT 10 OCT", time: "6:00 PM", soldOut: true },
      { dateLabel: "Sat, 10 Oct 2026", time: "6:00 pm", price: 299 },
    ],
    { eventId: "ET00000003", durationMinutes: 60, now: NOW }
  );
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].availability, "available");
  assert.equal(sessions[0].price, 299);
});

test("sessions that already started are dropped; junk labels ignored", () => {
  const sessions = buildSessions(
    [
      { dateLabel: "WED 7 OCT", time: "9:00 AM" }, // earlier today
      { dateLabel: "WED 7 OCT", time: "9:00 PM" }, // tonight
      { dateLabel: "Tomorrow", time: "7:00 PM" }, // unparseable
    ],
    { eventId: "ET00000004", durationMinutes: 60, now: NOW }
  );
  assert.deepEqual(
    sessions.map((s) => s.startDate),
    ["2026-10-07T21:00:00+05:30"]
  );
});

test("labelFromIso round-trips through the parser", () => {
  const label = labelFromIso("2026-07-28T21:00:00+05:30");
  assert.equal(label, "Tue 28 Jul 2026");
  assert.equal(parseDateLabel(label)?.weekday, 2);
});

console.log("partitionCache");

test("fresh listings are reused, stale ones re-scraped, past sessions dropped", () => {
  const hours = (h: number) =>
    new Date(NOW.getTime() - h * 3_600_000).toISOString();

  const records = [
    // scraped 2h ago -> fresh
    { eventId: "A", startDate: "2026-10-09T20:00:00+05:30", scrapedAt: hours(2) },
    { eventId: "A", startDate: "2026-10-10T18:00:00+05:30", scrapedAt: hours(2) },
    // scraped 30h ago -> stale
    { eventId: "B", startDate: "2026-10-12T20:00:00+05:30", scrapedAt: hours(30) },
    // legacy record, no scrapedAt -> stale (forces migration)
    { eventId: "C", startDate: "2026-10-15T20:00:00+05:30" },
    // already happened -> gone
    { eventId: "D", startDate: "2026-10-01T20:00:00+05:30", scrapedAt: hours(1) },
  ];

  const { fresh, stale } = partitionCache(records, NOW, 12);

  assert.deepEqual(fresh.map((r) => r.eventId), ["A", "A"]);
  assert.deepEqual([...stale.keys()].sort(), ["B", "C"]);
  assert.equal(stale.has("D"), false);
});

test("ttl of 0 (--force) makes everything stale", () => {
  const { fresh, stale } = partitionCache(
    [{ eventId: "A", startDate: "2026-10-09T20:00:00+05:30", scrapedAt: NOW.toISOString() }],
    NOW,
    0
  );
  assert.equal(fresh.length, 0);
  assert.equal(stale.size, 1);
});

console.log(`\n${passed} tests passed`);
