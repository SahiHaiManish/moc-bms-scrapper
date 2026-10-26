/**
 * Pulls the comics roster (name, photo, Instagram reel) from the mics app's
 * public feed and writes public/comics.json for the "View lineup" dialog.
 *
 *   npm run sync-comics
 *
 * The feed is the same one the website already reads for lineups and poster
 * photos, so no Firebase access is needed here. The address comes from
 * MICS_COMICS_URL, or is derived from MICS_LINEUPS_URL (set it in .env.local
 * if it is only configured on Vercel).
 *
 * Safe by design: if the feed can't be reached or comes back empty, the
 * existing public/comics.json is left untouched.
 */
import fs from "node:fs";
import path from "node:path";

import { buildRoster, comicsFeedUrl, recordsFromFeed } from "./lib/comicsSource";

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const OUT = path.join(process.cwd(), "public", "comics.json");

async function main() {
  const feed = comicsFeedUrl(process.env);

  if (!feed) {
    console.error(
      "No feed address. Set MICS_LINEUPS_URL (the mics app's .vercel.app address, as on Vercel) " +
        "or MICS_COMICS_URL in .env.local."
    );
    process.exit(1);
  }

  const res = await fetch(feed, { signal: AbortSignal.timeout(20_000) });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} from ${feed}\n${(await res.text()).slice(0, 300)}`);
  }

  const json = await res.json();
  const records = recordsFromFeed(json);

  const roster = buildRoster(records, {
    baseUrl: feed,
    photoBase: feed.replace(/\/comics\.json$/i, ""),
  });

  if (roster.length === 0) {
    console.error(`The feed answered but no comics could be read (${records.length} record(s)) from ${feed}`);
    if (records[0]) console.error("First record's fields:", Object.keys(records[0]).join(", "));
    console.error("If the field names differ, add them to FIELD_ALIASES in scripts/lib/comicsSource.ts. public/comics.json was left unchanged.");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(roster, null, 2) + "\n");

  console.log(
    `Wrote ${roster.length} comics to public/comics.json ` +
      `(${roster.filter((c) => c.photo).length} with photo, ${roster.filter((c) => c.reel).length} with reel)`
  );
}

main().catch((err) => {
  console.error("Could not fetch comics:", err.message ?? err);
  console.error("public/comics.json was left unchanged.");
  process.exit(1);
});
