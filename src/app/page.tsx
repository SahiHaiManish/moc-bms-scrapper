"use client";

import { useEffect, useState } from "react";

import Hero from "@/components/Hero";
import ShowSection from "@/components/ShowSection";

import { Show } from "@/types/show";

import { loadShows } from "@/lib/loadShows";
import { categorizeShows } from "@/lib/categorizeShows";

export default function Home() {

  const [shows, setShows] = useState<Show[]>([]);

  useEffect(() => {

    loadShows().then(setShows);

  }, []);

  const sections = categorizeShows(shows);

  return (

    <main>

      <Hero />

      <div
        id="shows"
        className="mx-auto max-w-7xl px-6 pb-24"
      >

        <ShowSection
          title="🔥 Tonight"
          shows={sections.tonight}
        />

        <ShowSection
          title="🎤 Friday"
          shows={sections.friday}
        />

        <ShowSection
          title="😂 Saturday"
          shows={sections.saturday}
        />

        <ShowSection
          title="🍻 Sunday"
          shows={sections.sunday}
        />

        <ShowSection
          title="✨ Coming Soon"
          shows={sections.comingSoon}
        />

      </div>

    </main>

  );

}
