"use client";

import { useEffect, useState } from "react";

import {
  Remaining,
  Urgency,
  formatClock,
  pad2,
  remaining,
  spokenLabel,
  urgency,
} from "@/lib/countdown";

interface Props {
  startDate: string;
  /** small chip for sitting on top of a card's poster */
  compact?: boolean;
}

const digitTone: Record<Urgency, string> = {
  far: "text-yellow-300",
  soon: "text-orange-300",
  imminent: "text-red-300",
};

/** pulsing red "live" dot */
function Dot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:animate-none" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-[2.6rem] rounded-lg bg-black/60 px-2 py-1 text-center font-mono text-2xl font-bold tabular-nums">
        {pad2(value)}
      </span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </span>
    </div>
  );
}

function Large({ r }: { r: Remaining }) {
  const tone = digitTone[urgency(r.totalSeconds)];

  return (
    <div
      role="timer"
      aria-label={spokenLabel(r)}
      className="inline-flex items-center gap-4 rounded-2xl bg-zinc-900/80 px-4 py-3 ring-1 ring-white/10"
    >
      <div className="flex items-center gap-2">
        <Dot />
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
          Starts in
        </span>
      </div>

      <div className={`flex items-start gap-1.5 ${tone}`}>
        {r.days > 0 && (
          <>
            <Segment value={r.days} label="Days" />
            <span className="pt-1 font-mono text-2xl font-bold">:</span>
          </>
        )}
        <Segment value={r.hours} label="Hrs" />
        <span className="pt-1 font-mono text-2xl font-bold">:</span>
        <Segment value={r.minutes} label="Min" />
        <span className="pt-1 font-mono text-2xl font-bold">:</span>
        <Segment value={r.seconds} label="Sec" />
      </div>
    </div>
  );
}

export default function Countdown({ startDate, compact = false }: Props) {
  // null until mounted: the server can't know the visitor's clock, and
  // rendering nothing avoids a hydration mismatch.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());

    // Re-read the real clock each tick (not "subtract one second"), so a
    // throttled background tab catches up instead of drifting.
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  if (now === null) return null;

  const r = remaining(Date.parse(startDate), now);

  if (!compact) return <Large r={r} />;

  if (r.totalSeconds === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white sm:px-3 sm:text-xs">
        <Dot />
        Starting now
      </span>
    );
  }

  return (
    <span
      role="timer"
      aria-label={spokenLabel(r)}
      className="inline-flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 ring-1 ring-white/15 backdrop-blur sm:gap-2 sm:px-3"
    >
      <Dot />

      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:text-[10px]">
        Starts in
      </span>

      <span
        className={`font-mono text-[11px] font-bold tabular-nums sm:text-xs ${
          digitTone[urgency(r.totalSeconds)]
        }`}
      >
        {formatClock(r)}
      </span>
    </span>
  );
}
