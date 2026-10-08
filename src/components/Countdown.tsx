"use client";

import { useEffect, useState } from "react";
import { differenceInSeconds, parseISO } from "date-fns";

interface Props {
  startDate: string;
  /** small chip for sitting on top of a card's poster */
  compact?: boolean;
}

export default function Countdown({ startDate, compact = false }: Props) {
  const [text, setText] = useState("");

  useEffect(() => {
    function update() {
      const start = parseISO(startDate);

      const secs = differenceInSeconds(start, new Date());

      if (secs <= 0) {
        setText("🎭 Live Now");
        return;
      }

      const days = Math.floor(secs / 86400);
      const hours = Math.floor((secs % 86400) / 3600);
      const mins = Math.floor((secs % 3600) / 60);

      if (days > 0) {
        setText(`🔴 Starts in ${days}d ${hours}h`);
      } else if (hours > 0) {
        setText(`🔴 Starts in ${hours}h ${mins}m`);
      } else {
        setText(`🟡 Starts in ${mins}m`);
      }
    }

    update();

    const timer = setInterval(update, 1000 * 30);

    return () => clearInterval(timer);
  }, [startDate]);

  if (compact) {
    // The text is filled in after hydration; render nothing until then
    // rather than an empty pill.
    if (!text) return null;

    return (
      <span className="rounded-full bg-black/70 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-300 backdrop-blur sm:px-3 sm:py-1 sm:text-xs">
        {text}
      </span>
    );
  }

  return (
    <div className="inline-flex rounded-full bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-300">
      {text}
    </div>
  );
}
