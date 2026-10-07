import fs from "fs";
import path from "path";

import { findClashes, sessionIdOf } from "./lib/clashes";

interface Show {
  eventId: string;
  title?: string;
  startDate?: string;
  sessionId?: string;
  [key: string]: unknown;
}

interface AdminConfig {
  /** hide a whole listing, every date */
  hidden: string[];
  /**
   * hide one listing on one date/time only. Use this when a producer lists the
   * same show several times: keep one, hide the others for that slot.
   * Format: "<eventId>@<YYYYMMDD>T<HHmm>"  e.g. "ET00512943@20261011T1900"
   * (`npm run merge` prints the exact line to paste for every clash).
   */
  hiddenSessions?: string[];
  manual: unknown[];
  featured: string[];
  order: string[];
}

const rawPath = path.join(process.cwd(), "data", "raw-shows.json");
// src/config/admin.json is the file the site itself reads (see src/app/page.tsx)
const adminPath = path.join(process.cwd(), "src", "config", "admin.json");
const outputPath = path.join(process.cwd(), "public", "shows.json");

const rawShows: Show[] = fs.existsSync(rawPath)
  ? JSON.parse(fs.readFileSync(rawPath, "utf8"))
  : [];

const admin: AdminConfig = fs.existsSync(adminPath)
  ? JSON.parse(fs.readFileSync(adminPath, "utf8"))
  : {
      hidden: ["ET00455315"],
      manual: [],
      featured: [],
      order: [],
    };

const hiddenEvents = new Set(admin.hidden ?? []);
const hiddenSessions = new Set(admin.hiddenSessions ?? []);

const visibleShows = rawShows.filter(
  (show) =>
    !hiddenEvents.has(show.eventId) &&
    !hiddenSessions.has(sessionIdOf(show))
);

// A hiddenSessions entry that matches nothing is almost always a typo.
const knownSessionIds = new Set(rawShows.map(sessionIdOf));

for (const id of hiddenSessions) {
  if (!knownSessionIds.has(id)) {
    console.warn(`⚠️ hiddenSessions: "${id}" matches no scraped session (typo, or already past?)`);
  }
}

// ---------------------------------------------------------------------------
// Same venue + same start time but different listings = the same show listed
// more than once. We never guess which one you want; we list them.
// ---------------------------------------------------------------------------

const clashes = findClashes(visibleShows);

for (const clash of clashes) {
  console.warn(`\n⚠️ ${clash.shows.length} listings share ${clash.label}:`);

  for (const show of clash.shows) {
    console.warn(`     ${sessionIdOf(show)}   ${show.title ?? ""}`);
  }
}

if (clashes.length) {
  console.warn(
    `\n   → resolve them interactively with:  npm run pick`
  );
}

fs.writeFileSync(
  outputPath,
  JSON.stringify(visibleShows, null, 2)
);

console.log(
  `\n✅ Merged ${visibleShows.length} visible shows (from ${rawShows.length} total)` +
    (clashes.length ? ` — ${clashes.length} time slot(s) have duplicate listings` : "")
);
