import { Show } from "@/types/show";

export async function loadShows(): Promise<Show[]> {
  // During development this fetches the static file.
  // Later it will still work after the scraper updates it.

  const res = await fetch("/shows.json", {
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  const data: Show[] = await res.json();

  return data;
}
