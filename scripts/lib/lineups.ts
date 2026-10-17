import fs from "fs";
import path from "path";

import { istParts } from "./sessions";

/**
 * Lineups published from /mics/lineup ("Publish to website").
 *
 * The mics app serves them at /mics/lineups.json. Each one is keyed by its
 * show's date and start time, "20261016T2359" — the same thing every
 * sessionId here ends in ("ET00476821@20261016T2359"), so a lineup lands on
 * whichever listing starts at that moment, whatever BookMyShow calls it.
 */

export interface PublishedLineup {
  slot: string; // "20261016T2359"
  day?: string;
  time?: string;
  performers: string[];
  /** Up to 2 faces ticked on /mics/lineup; url may be relative to the mics app. */
  photos?: { name: string; url: string }[];
  publishedAt?: string;
}

interface ShowLike {
  eventId: string;
  title?: string;
  startDate?: string;
  performers?: unknown;
  [key: string]: unknown;
}

const DEFAULT_URL = "https://ministryofcomedy.in/mics/lineups.json";

/** Last copy fetched, so merge still applies lineups when offline. */
export const LINEUPS_CACHE = path.join(process.cwd(), "data", "lineups.json");

const pad = (n: number) => String(n).padStart(2, "0");

export function slotOf(startDate: string): string | null {
  const t = Date.parse(startDate);
  if (Number.isNaN(t)) return null;
  const p = istParts(new Date(t));
  return `${p.y}${pad(p.m)}${pad(p.d)}T${pad(p.h)}${pad(p.mi)}`;
}

function clean(raw: unknown): PublishedLineup[] {
  const list = Array.isArray((raw as { lineups?: unknown })?.lineups)
    ? (raw as { lineups: unknown[] }).lineups
    : [];

  return list.flatMap((l) => {
    const x = l as Partial<PublishedLineup>;
    if (typeof x.slot !== "string" || !/^\d{8}T\d{4}$/.test(x.slot)) return [];
    const performers = (Array.isArray(x.performers) ? x.performers : [])
      .map((n) => String(n).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!performers.length) return [];
    const photos = (Array.isArray(x.photos) ? x.photos : []).filter(
      (p) => p && typeof p.name === "string" && typeof p.url === "string"
    );
    return [{ ...x, slot: x.slot, performers, photos }];
  });
}

/**
 * Fetches the published lineups (MICS_LINEUPS_URL, default the live site) and
 * caches them in data/lineups.json. If the fetch fails, uses that cache.
 * Set MICS_LINEUPS_URL=off to skip the fetch entirely.
 */
export async function loadLineups(): Promise<{
  lineups: PublishedLineup[];
  source: string;
}> {
  const url = process.env.MICS_LINEUPS_URL || DEFAULT_URL;

  if (url !== "off") {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const lineups = clean(body);
      fs.mkdirSync(path.dirname(LINEUPS_CACHE), { recursive: true });
      fs.writeFileSync(LINEUPS_CACHE, JSON.stringify(body, null, 2));
      return { lineups, source: url };
    } catch (err) {
      console.warn(
        `⚠️ Couldn't fetch lineups from ${url} (${(err as Error).message}); using the last saved copy.`
      );
    }
  }

  if (fs.existsSync(LINEUPS_CACHE)) {
    return {
      lineups: clean(JSON.parse(fs.readFileSync(LINEUPS_CACHE, "utf8"))),
      source: path.relative(process.cwd(), LINEUPS_CACHE),
    };
  }

  return { lineups: [], source: "none" };
}

/**
 * Puts each lineup's names into `performers` of every show starting at that
 * slot. Shows with no published lineup are left exactly as they are.
 */
export function applyLineups<T extends ShowLike>(
  shows: T[],
  lineups: PublishedLineup[]
): { shows: T[]; updated: { show: T; lineup: PublishedLineup }[]; unmatched: PublishedLineup[] } {
  const bySlot = new Map(lineups.map((l) => [l.slot, l]));
  const used = new Set<string>();
  const updated: { show: T; lineup: PublishedLineup }[] = [];

  const out = shows.map((show) => {
    const slot = show.startDate ? slotOf(show.startDate) : null;
    const lineup = slot ? bySlot.get(slot) : undefined;
    if (!lineup) return show;

    used.add(lineup.slot);
    const next = {
      ...show,
      performers: [...lineup.performers],
      lineupPublishedAt: lineup.publishedAt ?? null,
    };
    updated.push({ show: next, lineup });
    return next;
  });

  return { shows: out, updated, unmatched: lineups.filter((l) => !used.has(l.slot)) };
}

export function reportLineups(
  updated: { show: ShowLike; lineup: PublishedLineup }[],
  unmatched: PublishedLineup[]
) {
  for (const { show, lineup } of updated) {
    console.log(`🎤 ${lineup.slot}  ${show.title ?? show.eventId}: ${lineup.performers.join(", ")}`);
  }
  for (const l of unmatched) {
    console.warn(
      `⚠️ Lineup for ${l.day ?? ""} ${l.time ?? ""} (${l.slot}) has no listing at that time ` +
        `(not on BookMyShow yet, hidden, or a different start time).`
    );
  }
}
