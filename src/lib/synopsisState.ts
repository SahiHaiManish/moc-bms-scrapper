/**
 * Reads an event page's own data (window.__INITIAL_STATE__) and cleans page
 * titles. Used when the page has no event JSON-LD, or when the JSON-LD is
 * missing a field (image, price): the venue-card/JSON-LD route stays the main
 * one, this fills the gaps instead of leaving a 0 price, a broken image or a
 * "…comedy-shows Event Tickets Bengaluru - BookMyShow" title.
 */

export interface SynopsisInfo {
  eventId: string;
  title: string;
  /** BookMyShow's own category, e.g. "Comedy Shows" */
  category: string;
  /** lowest price shown on the page, 0 when none is shown (sold out, free) */
  price: number;
  image: string;
  /** ISO with the India offset, "" when absent */
  startDate: string;
  endDate: string;
}

// ---- page title -------------------------------------------------------------

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * "Ministry of Comedy Presents! (Koramangala) comedy-shows Event Tickets Bengaluru - BookMyShow"
 *   -> "Ministry of Comedy Presents! (Koramangala)"
 * A title that has no such junk is returned unchanged.
 */
export function cleanPageTitle(raw: string): string {
  return decodeEntities(raw)
    .replace(/\s*[-–|]\s*BookMyShow.*$/i, "")
    .replace(/\s+[a-z]+-shows\b.*$/i, "") // "comedy-shows Event Tickets Bengaluru": category slug + city
    .replace(/\s+(?:[A-Za-z]+\s+)?Shows?\s+Event\s+Tickets\b.*$/i, "") // "Comedy Shows Event Tickets"
    .replace(/\s+Event\s+Tickets\b.*$/i, "")
    .replace(/\s+Tickets$/i, "") // "... Hindi Storytelling Play Tickets"
    .replace(/\s+/g, " ")
    .trim();
}

/** True for titles that are really the browser tab text, not the show name. */
export function looksLikePageTitle(title: string): boolean {
  return /BookMyShow|\bEvent Tickets\b|\b[a-z]+-shows\b/i.test(title);
}

// ---- __INITIAL_STATE__ ------------------------------------------------------

function readState(html: string): any | null {
  const marker = "window.__INITIAL_STATE__ = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const end = html.indexOf("</script>", start);
  if (end === -1) return null;

  const text = html.slice(start + marker.length, end).trim().replace(/;$/, "");

  try {
    return JSON.parse(text);
  } catch {
    // not strict JSON (undefined, trailing commas...): same approach parseVenuePage uses
    try {
      return new Function(`"use strict"; return (${text});`)();
    } catch {
      return null;
    }
  }
}

/** "20260729|2300" -> "2026-07-29T23:00:00+05:30" (BookMyShow times are India time). */
export function isoFromAnalytics(value: unknown): string {
  const m = typeof value === "string" ? value.match(/^(\d{4})(\d{2})(\d{2})\|(\d{2})(\d{2})$/) : null;

  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30` : "";
}

function firstText(components: any): string {
  return Array.isArray(components)
    ? components.map((c: any) => (typeof c?.text === "string" ? c.text : "")).find(Boolean) ?? ""
    : "";
}

/** "₹199", "₹ 1,499 onwards" -> 199, 1499. */
export function priceFromText(text: string): number {
  const m = text.match(/(?:₹|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i);

  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

/** Last resort for pages without the data block: the lowest rupee amount in the visible text. */
export function priceFromDom(html: string): number {
  const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");

  const amounts = [...text.matchAll(/₹\s?(\d[\d,]*)/g)]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((n) => n > 0);

  return amounts.length ? Math.min(...amounts) : 0;
}

function findEventImage(widgets: any): string {
  const urls: string[] = [];

  const walk = (o: any, depth: number) => {
    if (!o || typeof o !== "object" || depth > 8) return;

    for (const [k, v] of Object.entries(o)) {
      if (k === "url" && typeof v === "string" && /^https?:\/\/.*\/nmcms\/events\//i.test(v)) urls.push(v);
      else walk(v, depth + 1);
    }
  };

  walk(widgets?.EVENT_BANNER ?? widgets, 0);

  return urls[0] ?? "";
}

/**
 * The banner <img> of the rendered page. BookMyShow's server sometimes sends the
 * page's data before the banner section is ready (the state then has no image),
 * but the browser fills the banner in a moment later, so the DOM has it.
 */
export function bannerFromDom(html: string): string {
  const m = html.match(/<img[^>]+src=["'](https?:\/\/[^"']*\/nmcms\/events\/[^"']+)["']/i);

  return m ? decodeEntities(m[1]) : "";
}

/**
 * Everything this page tells us beyond its JSON-LD. Never throws; a field the
 * page doesn't have is "" (or 0), so callers can keep whatever they already know.
 */
export function readEventPage(html: string): SynopsisInfo {
  const state = readState(html);
  const queries = state?.eventsSynopsisApi?.queries;

  const session = queries?.getPrimarySessionData?.data;
  const primary = queries?.getPrimaryData?.data;

  const analytics = session?.meta?.analytics ?? {};

  const pageTitle = cleanPageTitle(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");

  const title = (
    firstText(session?.header?.text?.[0]?.components) ||
    (typeof analytics.title === "string" ? analytics.title : "") ||
    pageTitle
  ).trim();

  const priceTexts: any[] = session?.widgets?.BOOK_CTA?.cards?.[0]?.text ?? [];
  const price =
    priceTexts.map((t) => priceFromText(firstText(t?.components))).find((p) => p > 0) ??
    priceFromDom(html);

  return {
    eventId: typeof analytics.event_code === "string" ? analytics.event_code : "",
    title,
    category: typeof analytics.category === "string" ? analytics.category : "",
    price,
    image: findEventImage(primary?.widgets) || bannerFromDom(html),
    startDate: isoFromAnalytics(analytics.start_date_time),
    endDate: isoFromAnalytics(analytics.end_date_time),
  };
}
