/** Pure time maths for the countdown, kept apart from React so it can be tested. */

export interface Remaining {
  /** whole seconds left, never negative; rounds UP so 0 means "started" */
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export type Urgency = "far" | "soon" | "imminent";

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function remaining(startMs: number, nowMs: number): Remaining {
  const ms = startMs - nowMs;
  const totalSeconds = ms > 0 ? Math.ceil(ms / 1000) : 0;

  return {
    totalSeconds,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** "07:14:32", or "2d 07:14:32" once it is a day or more away */
export function formatClock(r: Remaining): string {
  const clock = `${pad2(r.hours)}:${pad2(r.minutes)}:${pad2(r.seconds)}`;

  return r.days > 0 ? `${r.days}d ${clock}` : clock;
}

/** drives the colour: calm yellow -> orange in the last hour -> red in the last 10 min */
export function urgency(totalSeconds: number): Urgency {
  if (totalSeconds < 600) return "imminent";
  if (totalSeconds < 3600) return "soon";
  return "far";
}

/** Screen-reader text. Deliberately coarse so it isn't re-announced every second. */
export function spokenLabel(r: Remaining): string {
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  if (r.totalSeconds === 0) return "Starting now";
  if (r.days > 0) return `Starts in ${unit(r.days, "day")} ${unit(r.hours, "hour")}`;
  if (r.hours > 0) return `Starts in ${unit(r.hours, "hour")} ${unit(r.minutes, "minute")}`;

  return `Starts in ${unit(Math.max(r.minutes, 1), "minute")}`;
}
