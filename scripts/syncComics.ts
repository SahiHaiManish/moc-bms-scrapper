/**
 * OPTIONAL. The website reads the comics feed live (src/app/api/comics), so
 * you do not need this after adding a comic. It saves a snapshot to
 * public/comics.json, which the website falls back to if the feed is ever
 * unreachable.
 *
 *   npm run sync-comics
 *
 * The feed address comes from MICS_COMICS_URL, or is derived from
 * MICS_LINEUPS_URL (set it in .env.local). Photo links are always rewritten to
 * the public address (MICS_PUBLIC_URL, default https://ministryofcomedy.in/mics),
 * so running this against localhost:4000 still gives links that work online.
 *
 * If the feed can't be reached or is empty, public/comics.json is left untouched.
 */
import fs from "node:fs";
import path from "node:path";

import { fetchRoster } from "../src/lib/comicsFeed";

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
  if (!process.env.MICS_COMICS_URL && !process.env.MICS_LINEUPS_URL) {
    console.error("No feed address. Set MICS_LINEUPS_URL (the mics app's address) or MICS_COMICS_URL in .env.local.");
    process.exit(1);
  }

  const roster = await fetchRoster(process.env);

  if (!roster) {
    console.error("Could not read any comics from the feed (unreachable, an error, or empty). public/comics.json was left unchanged.");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(roster, null, 2) + "\n");

  console.log(
    `Wrote ${roster.length} comics to public/comics.json ` +
      `(${roster.filter((c) => c.photo).length} with photo, ${roster.filter((c) => c.reel).length} with reel)`
  );
}

main();
