"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MidnightRefresh() {
  const router = useRouter();

  useEffect(() => {
    function scheduleRefresh() {
      const now = new Date();

      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);

      const ms = nextMidnight.getTime() - now.getTime();

      const timer = setTimeout(() => {
        router.refresh();
      }, ms);

      return () => clearTimeout(timer);
    }

    return scheduleRefresh();
  }, [router]);

  return null;
}
