/**
 * Add one event (or a few) to the site from their links, without scraping
 * everything:
 *
 *   npm run add -- https://in.bookmyshow.com/events/some-show/ET00312493
 *   npm run add -- <link> <link> --category="Improv Comedy"
 *
 * It reads that event's page, collects every date and time at Ministry of
 * Comedy, saves them into data/raw-shows.json, then rebuilds public/shows.json.
 * Running it again for the same link refreshes that event.
 *
 * Options
 *   --category="…"  card label (default: keep the existing one, else "Stand up Comedy")
 *   --force         add even if it doesn't look like a Ministry of Comedy show
 *   --dry-run       show what would be added, change nothing
 *   --no-merge      don't rebuild public/shows.json afterwards
 */
import { spawnSync } from "child_process";
import fs from "fs/promises";

import scraperConfig from "../src/config/scraper.json";

import {
  DEFAULT_CATEGORY,
  EventLink,
  addEvent,
  addToAllowList,
  parseEventLink,
  replaceEventRecords,
} from "./lib/addEvent";
import { getContext, launchBrowser } from "./lib/scrapeCore";

const RAW = "data/raw-shows.json";
const CONFIG = "src/config/scraper.json";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a === name || a.startsWith(`${name}=`));
const flagValue = (name: string) => flag(name)?.split("=").slice(1).join("=").replace(/^["']|["']$/g, "");

const inputs = args.filter((a) => !a.startsWith("--"));
const FORCE = Boolean(flag("--force"));
const DRY = Boolean(flag("--dry-run"));
const NO_MERGE = Boolean(flag("--no-merge"));
const CATEGORY = flagValue("--category");

function usage(): never {
  console.log(`
Add an event from its BookMyShow link:

  npm run add -- <link> [<link> ...] [--category="Improv Comedy"] [--force] [--dry-run] [--no-merge]

  e.g.  npm run add -- https://in.bookmyshow.com/events/stand-up-comedy-live/ET00312493

Default category is "${DEFAULT_CATEGORY}" (an existing event keeps its own).
`);
  process.exit(1);
}

async function readRaw(): Promise<any[]> {
  try {
    return JSON.parse(await fs.readFile(RAW, "utf8"));
  } catch {
    return [];
  }
}

async function run() {
  if (!inputs.length) usage();

  const links: EventLink[] = [];

  for (const input of inputs) {
    const parsed = parseEventLink(input);

    if ("error" in parsed) {
      console.error(`❌ ${parsed.error}`);
      process.exit(1);
    }

    links.push(parsed);
  }

  let raw = await readRaw();
  let changed = false;
  const failures: string[] = [];

  const browser = await launchBrowser();

  try {
    const context = await getContext(browser);
    const page = await context.newPage();

    for (const link of links) {
      console.log(`\n🔗 ${link.eventId}  ${link.url}`);

      if ((scraperConfig.ignoredEvents as string[]).includes(link.eventId)) {
        console.log(
          `ℹ️  ${link.eventId} is in "ignoredEvents", so \`npm run sync\` won't refresh it. ` +
          `Remove it from that list in src/config/scraper.json if you want sync to keep it up to date.`
        );
      }

      const outcome = await addEvent(page, link, raw, { category: CATEGORY, force: FORCE });

      if (outcome.kind === "failed") {
        console.error(`❌ ${outcome.reason}`);
        failures.push(link.eventId);
        continue;
      }

      if (outcome.kind === "refused") {
        console.log(`🚫 "${outcome.title}" doesn't look like a Ministry of Comedy show (${outcome.reason}).`);
        console.log(`   Not added. If it really is yours, run again with --force.`);
        failures.push(link.eventId);
        continue;
      }

      if (outcome.kind === "nothing") {
        console.log(`⏭  "${outcome.title}": ${outcome.reason}. Nothing added.`);
        failures.push(link.eventId);
        continue;
      }

      console.log(`✅ "${outcome.title}": ${outcome.records.length} session(s)`);
      outcome.sessions.forEach((s) => console.log(`     ${s}`));

      console.log(
        `   category: ${outcome.category}` +
        (outcome.categorySource === "default"
          ? `  (default; change with --category="…")`
          : outcome.categorySource === "existing"
            ? "  (kept from before)"
            : "")
      );

      if (outcome.note) console.log(`⚠️  ${outcome.note}`);

      if (DRY) continue;

      raw = replaceEventRecords(raw, link.eventId, outcome.records);
      changed = true;

      if (outcome.needsAllowList) {
        await addToAllowList(CONFIG, link.eventId);
        console.log(`📝 Added ${link.eventId} to "allowedEvents" so it isn't filtered out later.`);
      }

      await page.waitForTimeout(1500); // don't hammer BookMyShow
    }
  } finally {
    await browser.close();
  }

  if (DRY) {
    console.log("\n(dry run: nothing was saved)");
    return;
  }

  if (!changed) {
    console.log("\nNothing was added.");
    process.exit(failures.length ? 1 : 0);
  }

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(RAW, JSON.stringify(raw, null, 2));

  console.log(`\n💾 Saved ${raw.length} sessions to ${RAW}`);

  if (!NO_MERGE) {
    console.log("🔄 Rebuilding public/shows.json …\n");

    const merge = spawnSync("npx", ["tsx", "scripts/merge.ts"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    if (merge.status !== 0) {
      console.error("❌ merge failed; run `npm run merge` to see why.");
      process.exit(1);
    }
  } else {
    console.log("Run `npm run merge` to publish it.");
  }

  if (failures.length) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
