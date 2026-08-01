"use client";

import { useEffect } from "react";

export default function MidnightRefresh() {
  useEffect(() => {
    const now = new Date();

    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);

    const ms = nextMidnight.getTime() - now.getTime();

    const timer = setTimeout(() => {
      window.location.reload();
    }, ms);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
