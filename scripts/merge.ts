import fs from "fs";
import path from "path";

const rawPath = path.join(process.cwd(), "data", "raw-shows.json");
const adminPath = path.join(process.cwd(), "config", "admin.json");
const outputPath = path.join(process.cwd(), "public", "shows.json");

const rawShows = fs.existsSync(rawPath)
  ? JSON.parse(fs.readFileSync(rawPath, "utf8"))
  : [];


const admin = fs.existsSync(adminPath)
  ? JSON.parse(fs.readFileSync(adminPath, "utf8"))
  : {
      hidden: ["ET00314475",
"ET00436601",
"ET00316055",
"ET00436929",
"ET00477193"],
      manual: [],
      featured: [],
      order: [],
    };

const visibleShows = rawShows.filter(
  (show) => !admin.hidden.includes(show.eventId)
);

fs.writeFileSync(
  outputPath,
  JSON.stringify(visibleShows, null, 2)
);

console.log(
  `✅ Merged ${visibleShows.length} visible shows (from ${rawShows.length} total)`
);
