import { istParts, labelFromIso } from "./sessions";

export interface ShowLike {
  eventId: string;
  title?: string;
  startDate?: string;
  sessionId?: string;
  image?: string;
  price?: number;
  [key: string]: unknown;
}

export interface Clash<T extends ShowLike = ShowLike> {
  startMs: number;
  label: string;
  shows: T[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Records scraped before sessions existed have no sessionId: derive it. */
export function sessionIdOf(show: ShowLike): string {
  if (typeof show.sessionId === "string" && show.sessionId) {
    return show.sessionId;
  }

  const p = istParts(new Date(String(show.startDate)));

  return `${show.eventId}@${p.y}${pad(p.m)}${pad(p.d)}T${pad(p.h)}${pad(p.mi)}`;
}

/** "Thu 8 Oct 11:00 PM" */
export function slotLabel(startDate: string): string {
  const p = istParts(new Date(startDate));
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;

  return `${labelFromIso(startDate).replace(/ \d{4}$/, "")} ${h12}:${pad(
    p.mi
  )} ${p.h >= 12 ? "PM" : "AM"}`;
}

/**
 * Same venue + same start time but different listings = the same show listed
 * more than once. Returned in chronological order.
 */
export function findClashes<T extends ShowLike>(shows: T[]): Clash<T>[] {
  const bySlot = new Map<number, T[]>();

  for (const show of shows) {
    if (!show.startDate) continue;

    const key = Date.parse(show.startDate);
    const list = bySlot.get(key) ?? [];

    list.push(show);
    bySlot.set(key, list);
  }

  return [...bySlot]
    .filter(([, list]) => new Set(list.map((s) => s.eventId)).size > 1)
    .sort((a, b) => a[0] - b[0])
    .map(([startMs, list]) => ({
      startMs,
      label: slotLabel(String(list[0].startDate)),
      shows: list,
    }));
}
