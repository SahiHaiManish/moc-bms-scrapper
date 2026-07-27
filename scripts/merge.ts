import fs from "fs";
import path from "path";

const rawPath = path.join(process.cwd(), "data", "raw-shows.json");
const adminPath = path.join(process.cwd(), "config", "admin.json");
const outputPath = path.join(process.cwd(), "public", "shows.json");

const rawShows = fs.existsSync(rawPath)
  ? JSON.parse(fs.readFileSync(rawPath, "utf8"))
  : [];

const admin = JSON.parse(fs.readFileSync(adminPath, "utf8"));

// For now, just copy raw data.
// Later we'll:
// - hide shows
// - add manual shows
// - reorder
// - pin featured

fs.writeFileSync(outputPath, JSON.stringify(rawShows, null, 2));

console.log(`✅ Merged ${rawShows.length} shows`);
