/**
 * Rules that keep the scrape India-only and Ministry-of-Comedy-only.
 * Pure functions (no Playwright, no network) so they can be tested offline.
 *
 * Why this exists: the venue page also lists other clubs' evergreen events, and
 * BookMyShow decides the region from a cookie + IP. Both used to be trusted
 * blindly; a blacklist of event ids can never keep up with either.
 */

export interface VenueConfig {
  /** display name, used when an event page doesn't carry one */
  name: string;
  /** BookMyShow venue code, e.g. "MCBK" */
  code: string;
  /** lower-case text the venue name must contain, e.g. "ministry of comedy" */
  nameIncludes: string;
  /** only this BookMyShow host is accepted, e.g. "in.bookmyshow.com" */
  host: string;
  /** contents of BookMyShow's `rgn` cookie for the city we scrape */
  region: { regionCode: string; countryCode: string; [key: string]: string };
}

export interface CardLike {
  title?: string;
  eventId?: string;
  bookingUrl: string;
  /** analytics.region_code on the venue-page card, e.g. "BANG" */
  regionCode?: string;
}

export interface EventLike {
  eventId?: string;
  venue?: string;
  address?: string;
  currency?: string;
}

// ---------------------------------------------------------------------------
// India / Bengaluru
// ---------------------------------------------------------------------------

/**
 * Cookies that tell BookMyShow "Bengaluru, India, chosen manually". Written
 * into the browser on every run, so a missing, expired or overwritten state
 * file can no longer change which country/city we scrape.
 */
export function regionCookies(cfg: VenueConfig, now = Date.now()) {
  const expires = Math.floor(now / 1000) + 365 * 24 * 3600;
  const base = { domain: cfg.host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const };

  return [
    {
      ...base,
      name: "rgn",
      value: encodeURIComponent(JSON.stringify(cfg.region)),
      expires,
    },
    {
      ...base,
      name: "geolocation",
      value: encodeURIComponent(
        JSON.stringify({
          "x-location-shared": false,
          "x-location-selection": "manual",
          timestamp: now,
        })
      ),
      expires: -1,
    },
  ];
}

/**
 * Venue-page cards: keep only this host and (when the card says) this region.
 * A card with no region information is kept; one that names another region
 * or host is dropped.
 */
export function filterVenueCards<T extends CardLike>(cards: T[], cfg: VenueConfig) {
  const kept: T[] = [];
  const dropped: { card: T; reason: string }[] = [];

  for (const card of cards) {
    let host = "";

    try {
      host = new URL(card.bookingUrl).host;
    } catch {
      /* unparseable url -> host stays "" */
    }

    if (host !== cfg.host) {
      dropped.push({ card, reason: `host "${host || card.bookingUrl}" is not ${cfg.host}` });
    } else if (card.regionCode && card.regionCode !== cfg.region.regionCode) {
      dropped.push({ card, reason: `region ${card.regionCode}, expected ${cfg.region.regionCode}` });
    } else {
      kept.push(card);
    }
  }

  return { kept, dropped };
}

// ---------------------------------------------------------------------------
// Ministry of Comedy only
// ---------------------------------------------------------------------------

/**
 * Is this event (as described by its own page) a Ministry of Comedy show in
 * India? Uses the event's venue name, address and currency.
 */
export function isAtVenue(
  event: EventLike,
  cfg: VenueConfig,
  allowedEvents: string[] = []
): { ok: boolean; reason: string } {
  if (event.eventId && allowedEvents.includes(event.eventId)) {
    return { ok: true, reason: "listed in allowedEvents" };
  }

  const venue = (event.venue ?? "").trim();

  if (!venue) return { ok: false, reason: "event page names no venue" };

  if (!venue.toLowerCase().includes(cfg.nameIncludes.toLowerCase())) {
    return { ok: false, reason: `venue is "${venue}"` };
  }

  if (event.currency && event.currency !== "INR") {
    return { ok: false, reason: `currency is ${event.currency}, not INR` };
  }

  const address = event.address ?? "";

  if (address && !/bengaluru|bangalore|karnataka/i.test(address)) {
    return { ok: false, reason: `address is outside Bengaluru ("${address.slice(0, 50)}")` };
  }

  return { ok: true, reason: "venue matches" };
}

/** "…/ET0001/date-time/MCBK" -> "MCBK" (null when the url has no venue part) */
export function venueCodeFromUrl(url: string): string | null {
  return url.match(/\/date-time\/([A-Za-z0-9]+)/)?.[1]?.toUpperCase() ?? null;
}
