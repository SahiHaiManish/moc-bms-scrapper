/**
 * The WhatsApp message for /tonight. No file access here (unlike
 * ./tonight.ts), so the page can rebuild it in the browser as you tick
 * BOGO / sold out.
 */

import type { Tonight } from "./tonight";

const PUBLIC_SITE = "https://ministryofcomedy.in";

/** Opening line of the WhatsApp message, one per night. */
const HELLO: Record<string, string> = {
  Friday: "Friday night, sorted 🎤",
  Saturday: "Saturday plans? Laugh first, decide later 🎤",
  Sunday: "Sunday funday, the actual fun part 🎤",
};

/** Show positions (in tonight.shows) with BOGO on, or sold out. */
export interface CaptionFlags {
  bogo?: number[];
  soldOut?: number[];
}

/** The WhatsApp message that goes with the poster. */
export function tonightCaption(t: Tonight, flags: CaptionFlags = {}): string {
  if (!t.shows.length) {
    return [
      `No shows tonight (${t.weekday}, ${t.dayMonth}). The mics are resting. 😴`,
      "",
      `Here's what's coming up: ${PUBLIC_SITE}`,
    ].join("\n");
  }

  const blocks = t.shows.map((s, i) => {
    const sold = flags.soldOut ? flags.soldOut.includes(i) : s.soldOut;
    // "X feat. Nishant Tanwar" + "with Nishant Tanwar" says it twice.
    const title = s.performers.length ? s.title.replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/i, "") : s.title;
    const lines = [`*${s.time} · ${title}*`];
    lines.push(s.performers.length ? `with ${s.performers.join(", ")}` : "with some surprise acts 👀");
    if (sold) lines.push("🚫 SOLD OUT. See you at the next one!");
    else {
      if (flags.bogo?.includes(i)) lines.push("🎉 Buy 1, Get 1 FREE tonight");
      lines.push(`🎟️ ${s.bookingUrl}`);
    }
    return lines.join("\n");
  });

  const hello = HELLO[t.weekday] ?? "Comedy on a weeknight? Bold. We love it 🎤";

  return [
    `*${hello}*`,
    `Here's who's on at Ministry of Comedy tonight, ${t.weekday} ${t.dayMonth}:`,
    "",
    blocks.join("\n\n"),
    "",
    "📍 80 Feet Road, 4th Block, Koramangala",
    "Bring friends. Bring enemies. We'll handle the jokes.",
  ].join("\n");
}
