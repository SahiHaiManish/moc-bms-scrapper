/**
 * Choose which listing to show when the same show is listed more than once.
 *
 *   npm run pick                         walk through every clash, pick a winner
 *   npm run pick -- --list               compact schedule with session ids
 *   npm run pick -- --list --search=late only rows whose title contains "late"
 *
 * Decisions are written to "hiddenSessions" in src/config/admin.json (a .bak
 * copy is made first). Then run `npm run merge` to rebuild public/shows.json.
 */
import fs from "fs";
import path from "path";
import readline from "node:readline";

import {
  Clash,
  ShowLike,
  findClashes,
  sessionIdOf,
  slotLabel,
} from "./lib/clashes";

const rawPath = path.join(process.cwd(), "data", "raw-shows.json");
const adminPath = path.join(process.cwd(), "src", "config", "admin.json");

const args = process.argv.slice(2);
const LIST = args.includes("--list");
const SEARCH = args
  .find((a) => a.startsWith("--search="))
  ?.slice("--search=".length)
  .toLowerCase();

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

if (!fs.existsSync(rawPath)) {
  console.error(`No ${rawPath} yet. Run "npm run scrape" first.`);
  process.exit(1);
}

const raw: ShowLike[] = JSON.parse(fs.readFileSync(rawPath, "utf8"));

const admin: Record<string, any> = fs.existsSync(adminPath)
  ? JSON.parse(fs.readFileSync(adminPath, "utf8"))
  : {};

const hiddenEvents = new Set<string>(admin.hidden ?? []);
const hiddenSessions = new Set<string>(admin.hiddenSessions ?? []);

const now = Date.now();

/** What the site would show right now, i.e. what merge.ts keeps. */
const visible = () =>
  raw.filter(
    (s) =>
      s.startDate &&
      Date.parse(s.startDate) > now &&
      !hiddenEvents.has(s.eventId) &&
      !hiddenSessions.has(sessionIdOf(s))
  );

function save() {
  if (!fs.existsSync(`${adminPath}.bak`) && fs.existsSync(adminPath)) {
    fs.copyFileSync(adminPath, `${adminPath}.bak`);
  }

  admin.hiddenSessions = [...hiddenSessions].sort();

  fs.writeFileSync(adminPath, JSON.stringify(admin, null, 2) + "\n");
}

const money = (s: ShowLike) => (s.price ? `₹${s.price}` : "");

// ---------------------------------------------------------------------------
// --list : a readable schedule instead of digging through shows.json
// ---------------------------------------------------------------------------

function printList() {
  const shows = visible()
    .filter((s) => !SEARCH || (s.title ?? "").toLowerCase().includes(SEARCH))
    .sort((a, b) => Date.parse(a.startDate!) - Date.parse(b.startDate!));

  const clashing = new Set(
    findClashes(visible()).flatMap((c) => c.shows.map(sessionIdOf))
  );

  let lastDay = "";

  for (const s of shows) {
    const label = slotLabel(s.startDate!); // "Thu 8 Oct 11:00 PM"
    const day = label.replace(/ \d{1,2}:\d{2} [AP]M$/, "");
    const time = label.slice(day.length + 1);

    if (day !== lastDay) {
      console.log(`\n${day}`);
      lastDay = day;
    }

    console.log(
      `  ${time.padStart(8)}  ${sessionIdOf(s).padEnd(25)} ${(s.title ?? "")
        .slice(0, 44)
        .padEnd(44)} ${money(s).padEnd(6)}${
        clashing.has(sessionIdOf(s)) ? " ⚠️ duplicate" : ""
      }`
    );
  }

  console.log(`\n${shows.length} session(s)`);
}

// ---------------------------------------------------------------------------
// Interactive picking
// ---------------------------------------------------------------------------

const rl = readline.createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();

/** Prompt + read one line. Returns null when input ends (Ctrl+D / pipe end). */
async function ask(prompt: string): Promise<string | null> {
  process.stdout.write(prompt);

  const { value, done } = await lines.next();

  return done ? null : String(value).trim().toLowerCase();
}

const pairKey = (c: Clash) =>
  [...new Set(c.shows.map((s) => s.eventId))].sort().join("+");

async function pickLoop() {
  let clashes = findClashes(visible());

  if (!clashes.length) {
    console.log("✅ No duplicate listings at the same time. Nothing to pick.");
    return;
  }

  console.log(
    `Found ${clashes.length} time slot(s) with more than one listing.\n` +
      `Pick the one to KEEP. The others are hidden for that slot only.\n`
  );

  const skipped = new Set<number>();
  let decided = 0;

  for (;;) {
    clashes = findClashes(visible()).filter((c) => !skipped.has(c.startMs));

    const clash = clashes[0];

    if (!clash) break;

    console.log(`─── ${clash.label} ${"─".repeat(30)}`);

    clash.shows.forEach((s, i) => {
      console.log(`  ${i + 1}) ${s.title}`);
      console.log(`     ${sessionIdOf(s)}  ${money(s)}`);
      if (s.image) console.log(`     poster: ${s.image}`);
    });

    const answer = await ask(
      `Keep which? [1-${clash.shows.length}, s = skip, q = quit] `
    );

    if (answer === null || answer === "q") break;

    if (answer === "s" || answer === "") {
      skipped.add(clash.startMs);
      continue;
    }

    const choice = Number(answer);

    if (!Number.isInteger(choice) || choice < 1 || choice > clash.shows.length) {
      console.log("  Please enter one of the numbers above.\n");
      continue;
    }

    const keep = clash.shows[choice - 1];

    hide(clash, keep.eventId);
    decided++;

    // Producers relist the same pair for many dates; offer to settle them all.
    const same = findClashes(visible()).filter(
      (c) => pairKey(c) === pairKey(clash)
    );

    if (same.length) {
      console.log(
        `\n  The same ${pairKey(clash).split("+").length} listings also clash on ${same.length} more slot(s):\n` +
          same.map((c) => `    • ${c.label}`).join("\n")
      );

      const all = await ask(`  Keep "${keep.title}" on all of them too? [Y/n] `);

      if (all === null) break;

      if (all !== "n") {
        for (const c of same) hide(c, keep.eventId);
        decided += same.length;
      }
    }

    save();
    console.log("  💾 saved\n");
  }

  if (decided) save();

  console.log(
    decided
      ? `\n✅ Resolved ${decided} slot(s). Now run:  npm run merge`
      : `\nNothing changed.`
  );
}

function hide(clash: Clash, keepEventId: string) {
  for (const s of clash.shows) {
    if (s.eventId !== keepEventId) hiddenSessions.add(sessionIdOf(s));
  }
}

// ---------------------------------------------------------------------------

(async () => {
  try {
    if (LIST) printList();
    else await pickLoop();
  } finally {
    rl.close();
  }
})();
