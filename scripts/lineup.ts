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

const showsPath = path.join(process.cwd(), "public", "shows.json");

async function main() {
  const current = JSON.parse(fs.readFileSync(showsPath, "utf8"));
  const { lineups, source } = await loadLineups();

  if (!lineups.length) {
    console.log(`No published lineups (source: ${source}). shows.json left as it is.`);
    return;
  }

  const { shows, updated, unmatched } = applyLineups(current, lineups);
  reportLineups(updated, unmatched);

  const before = JSON.stringify(current, null, 2);
  const after = JSON.stringify(shows, null, 2);

  if (before === after) {
    console.log("\n✅ shows.json already has these lineups. Nothing to commit.");
    return;
  }

  fs.writeFileSync(showsPath, after);
  console.log(`\n✅ Updated ${updated.length} show(s) in public/shows.json. Commit and push to publish.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
