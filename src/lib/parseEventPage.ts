export interface EventDetails {
  eventId: string;

  title: string;
  description: string;

  bookingUrl: string;

  image: string;

  venue: string;
  address: string;

  startDate: string;
  endDate: string;

  duration: string;

  price: number;
  currency: string;

  performers: string[];
  languages: string[];
}

export function parseEventPage(html: string): EventDetails {
  const scripts = [...html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  )];

  for (const [, raw] of scripts) {
    try {
      const json = JSON.parse(raw);

      const items = Array.isArray(json) ? json : [json];

     const event = items.find(
  (item) =>
    typeof item?.startDate === "string" &&
    item?.location &&
    item?.offers
);
 
      if (!event) continue;

      return {
        eventId: event.url.split("/").pop() ?? "",

        title: event.name ?? "",
        description: event.description ?? "",

        bookingUrl: event.url ?? "",

        image: Array.isArray(event.image)
          ? event.image[0]
          : event.image ?? "",

        venue: event.location?.name ?? "",
        address: event.location?.address?.streetAddress ?? "",

        startDate: event.startDate ?? "",
        endDate: event.endDate ?? "",

        duration: event.duration ?? "",

        price: Number(event.offers?.lowPrice ?? 0),
        currency: event.offers?.priceCurrency ?? "",

        performers: (event.performer ?? []).map(
          (p: any) => p.name
        ),

        languages: event.inLanguage ?? [],
      };
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }

  throw new Error("ComedyEvent JSON-LD not found.");
}
