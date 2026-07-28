"use client";

import { useEffect, useState } from "react";
import { differenceInSeconds, parseISO } from "date-fns";

interface Props {
  startDate: string;
}

export default function Countdown({ startDate }: Props) {
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

  return (
    <div className="inline-flex rounded-full bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-300">
      {text}
    </div>
  );
}
