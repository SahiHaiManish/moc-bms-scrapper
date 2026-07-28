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

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flatten(input: any): any[] {
  if (Array.isArray(input)) {
    return input.flatMap(flatten);
  }

  return [input];
}

function scoreEvent(event: any): number {
  const venue =
    event?.location?.name?.toLowerCase() ?? "";

  if (
    venue.includes("ministry of comedy") &&
    venue.includes("koramangala")
  ) {
    return 100;
  }

  if (venue.includes("ministry of comedy")) {
    return 90;
  }

  return 0;
}

export function parseEventPage(
  html: string
): EventDetails {

  const scripts = [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];

  const events: any[] = [];

  for (const [, raw] of scripts) {
    try {
     console.log("JSON length:", raw.length);
console.log(raw.substring(0, 80));
      const json = JSON.parse(raw);
console.log("Parsed JSON");

      const items = flatten(json);

console.log(
  "Items:",
  items.length,
  items.map(i => i?.["@type"])
);


      for (const item of items) {

        if (
          !item ||
          typeof item !== "object"
        ) {
          continue;
        }

        if (
          item.startDate &&
          item.location
        ) {
          events.push(item);
console.log(
  "Found event:",
  item.name,
  item.location?.name
);
        }
      }

    } catch (err){
console.error(err);
      //
      // Ignore malformed JSON-LD
      //
    }
  }

  if (events.length) {

    events.sort(
      (a, b) => scoreEvent(b) - scoreEvent(a)
    );

    const event = events[0];

    return {

      eventId:
        typeof event.url === "string"
          ? event.url.split("/").pop() ?? ""
          : "",

      title: event.name ?? "",

      description: stripHtml(
        event.description ?? ""
      ),

      bookingUrl:
        event.url ?? "",

      image: Array.isArray(event.image)
        ? event.image[0] ?? ""
        : event.image ?? "",

      venue:
        event.location?.name ?? "",

      address:
        event.location?.address?.streetAddress ??
        event.location?.address?.name ??
        "",

      startDate:
        event.startDate ?? "",

      endDate:
        event.endDate ?? "",

      duration:
        event.duration ?? "",

      price: Number(
        event.offers?.lowPrice ??
        event.offers?.price ??
        0
      ),

      currency:
        event.offers?.priceCurrency ??
        "",

      performers:
        Array.isArray(event.performer)
          ? event.performer
              .map((p: any) => p?.name)
              .filter(Boolean)
          : [],

      languages:
        Array.isArray(event.inLanguage)
          ? event.inLanguage
          : event.inLanguage
          ? [event.inLanguage]
          : [],
    };
  }

  console.warn(
    "⚠️ No usable JSON-LD found. Returning partial event."
  );

  const title =
    html.match(/<title>(.*?)<\/title>/i)?.[1]
      ?.replace(/\s*\|.*$/, "")
      ?.trim() ?? "";

  const description =
    html.match(
      /<meta\s+name="description"\s+content="([^"]+)"/i
    )?.[1] ?? "";

  const image =
    html.match(
      /<meta\s+property="og:image"\s+content="([^"]+)"/i
    )?.[1] ?? "";

  return {
    eventId: "",

    title,

    description,

    bookingUrl: "",

    image,

    venue: "",

    address: "",

    startDate: "",

    endDate: "",

    duration: "",

    price: 0,

    currency: "",

    performers: [],

    languages: [],
  };
}
