/**
 * npm run lineup
 *
 * Pulls the lineups published from /mics/lineup and writes the names into
 * `performers` in public/shows.json, without rescraping BookMyShow.
 * (`npm run merge` / `npm run sync` do the same as part of their run.)
 *
 * Commit and push public/shows.json afterwards; Vercel redeploys.
 */
import fs from "fs";
import path from "path";

import { applyLineups, loadLineups, reportLineups } from "./lib/lineups";
import { addPosterPhotos, loadComics, reportPhotos } from "./lib/photos";

const showsPath = path.join(process.cwd(), "public", "shows.json");

async function main() {
  const current = JSON.parse(fs.readFileSync(showsPath, "utf8"));
  const [{ lineups, source }, { comics }] = await Promise.all([loadLineups(), loadComics()]);

  if (!lineups.length) console.log(`No published lineups (source: ${source}).`);

  const { shows: withLineups, updated, unmatched } = applyLineups(current, lineups);
  if (lineups.length) reportLineups(updated, unmatched);

  const { shows, missing } = addPosterPhotos(withLineups, lineups, comics);
  reportPhotos(shows, missing);

  const before = JSON.stringify(current, null, 2);
  const after = JSON.stringify(shows, null, 2);

  if (before === after) {
    console.log("\n✅ shows.json already has these lineups and photos. Nothing to commit.");
    return;
  }

  fs.writeFileSync(showsPath, after);
  console.log(`\n✅ Updated public/shows.json (${updated.length} lineup(s)). Commit and push to publish.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
