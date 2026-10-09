/** Offline tests for src/lib/countdown.ts.   npx tsx scripts/test-countdown.ts */
import assert from "node:assert/strict";
import { formatClock, remaining, spokenLabel, urgency } from "../src/lib/countdown";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

const NOW = Date.parse("2026-10-08T12:00:00+05:30");
const at = (h: number, m = 0, s = 0, d = 0) => NOW + (((d * 24 + h) * 60 + m) * 60 + s) * 1000;

test("7h 14m 32s away", () => {
  const r = remaining(at(7, 14, 32), NOW);
  assert.deepEqual([r.days, r.hours, r.minutes, r.seconds], [0, 7, 14, 32]);
  assert.equal(formatClock(r), "07:14:32");
});

test("days are split out for far-away shows", () => {
  assert.equal(formatClock(remaining(at(7, 14, 32, 2), NOW)), "2d 07:14:32");
});

test("rounds up, and never goes negative", () => {
  assert.equal(remaining(NOW + 400, NOW).totalSeconds, 1);      // 0.4s left shows 00:00:01
  assert.equal(remaining(NOW, NOW).totalSeconds, 0);
  assert.equal(remaining(NOW - 5000, NOW).totalSeconds, 0);     // already started
});

test("clock rolls over cleanly at minute and hour boundaries", () => {
  assert.equal(formatClock(remaining(at(1), NOW)), "01:00:00");
  assert.equal(formatClock(remaining(at(1) - 1000, NOW)), "00:59:59");
  assert.equal(formatClock(remaining(at(0, 10), NOW)), "00:10:00");
});

test("urgency steps at 1 hour and 10 minutes", () => {
  assert.equal(urgency(7200), "far");
  assert.equal(urgency(3600), "far");
  assert.equal(urgency(3599), "soon");
  assert.equal(urgency(600), "soon");
  assert.equal(urgency(599), "imminent");
  assert.equal(urgency(0), "imminent");
});

test("screen-reader label is coarse and grammatical", () => {
  assert.equal(spokenLabel(remaining(at(7, 14, 32), NOW)), "Starts in 7 hours 14 minutes");
  assert.equal(spokenLabel(remaining(at(1, 1), NOW)), "Starts in 1 hour 1 minute");
  assert.equal(spokenLabel(remaining(at(0, 0, 20), NOW)), "Starts in 1 minute");
  assert.equal(spokenLabel(remaining(at(3, 0, 0, 1), NOW)), "Starts in 1 day 3 hours");
  assert.equal(spokenLabel(remaining(NOW, NOW)), "Starting now");
});

console.log(`\n${passed} countdown tests passed`);
