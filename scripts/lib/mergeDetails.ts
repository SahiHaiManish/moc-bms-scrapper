import { cleanPageTitle, looksLikePageTitle } from "../../src/lib/synopsisState";

/**
 * Combines what the venue page knows about a listing (`summary`: clean title,
 * poster, category, language) with what the event page says (`details`).
 *
 * The event page used to overwrite the venue card with whatever it had, even
 * an empty image or a 0 price, or a browser-tab title such as
 * "... comedy-shows Event Tickets Bengaluru - BookMyShow". Now a detail only
 * wins when it actually holds something.
 */

const hasValue = (v: unknown) =>
  v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

export function mergeListing<S extends object, D extends object>(summary: S, details: D) {
  const out: Record<string, any> = { ...summary };

  for (const [key, value] of Object.entries(details)) {
    if (key === "price") {
      if (typeof value === "number" && value > 0) out.price = value;
    } else if (key !== "title" && hasValue(value)) {
      out[key] = value;
    } else if (Array.isArray(value) && !(key in out)) {
      // an empty list is still a list: `performers: []`, never a missing field
      out[key] = value;
    }
  }

  const card = String((summary as any).title ?? "").trim();
  const detail = String((details as any).title ?? "").trim();

  // The event page's title wins, unless it is really the browser-tab text.
  out.title =
    detail && !looksLikePageTitle(detail) ? detail : card || cleanPageTitle(detail);

  return out;
}

/** The first price above 0, or 0 when nobody knows one. */
export function firstPrice(...candidates: unknown[]): number {
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}
