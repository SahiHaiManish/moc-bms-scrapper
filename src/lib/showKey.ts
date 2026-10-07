import type { Show } from "@/lib/groupShows";

/**
 * Stable unique id for one card. A listing (eventId) can have many sessions,
 * so eventId alone is not unique; sessionId is, when the scraper produced it.
 */
export const showKey = (show: Pick<Show, "sessionId" | "eventId" | "startDate">) =>
  show.sessionId ?? `${show.eventId}-${show.startDate}`;
